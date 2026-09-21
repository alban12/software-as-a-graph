import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculateModelMemoryFootprint,
  analyzeMlConstraints
} from '../src/analysis/mlConstraintEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

test.describe('ML Systems & Hardware Constraint Engine', () => {
  const mlPipelineGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/ml-pipeline-graph.json'), 'utf8')
  );

  test('calculateModelMemoryFootprint computes accurate weights, optimizer, and activation VRAM', () => {
    const modelNode = mlPipelineGraph.nodes.node_llama3_backbone;
    const adapterNode = mlPipelineGraph.nodes.node_lora_adapter;
    const optimizerNode = mlPipelineGraph.nodes.node_adamw_optimizer;

    const footprint = calculateModelMemoryFootprint(modelNode, adapterNode, optimizerNode);

    // 8.03B parameters in BF16 = ~16.06 GB
    assert.strictEqual(Math.round(footprint.weightsVramGb), 16, '8B model in BF16 requires ~16GB weights');
    assert.ok(footprint.adapterVramGb > 0, 'LoRA adapter allocates lightweight overhead');
    assert.ok(footprint.activationVramGb > 0, 'Activation memory is calculated');
    assert.strictEqual(footprint.hasGradientCheckpointing, true, 'Respects gradient checkpointing flag');
    assert.strictEqual(footprint.isLoraOnly, true, 'Identifies LoRA PEFT adapter setup');
  });

  test('analyzeMlConstraints: Clean status on 8x H100 with NVLink and cuDF', () => {
    const analysis = analyzeMlConstraints(mlPipelineGraph);

    // With 8x H100 80GB SXM5 + NVLink + cuDF, there should be 0 critical OOM errors
    assert.strictEqual(analysis.stats.criticalCount, 0, 'No critical OOM errors on 8x H100 80GB cluster');
    assert.strictEqual(analysis.stats.warningCount, 0, 'No interconnect or data starvation warnings on NVLink + cuDF');
  });

  test('analyzeMlConstraints: Accurately detects predicted CUDA OOM when VRAM is constrained', () => {
    // Clone graph and target a small 16GB GPU without ZeRO
    const constrainedGraph = JSON.parse(JSON.stringify(mlPipelineGraph));
    constrainedGraph.nodes.node_h100_cluster.hardwareMeta.vramPerGpuGb = 16.0;
    constrainedGraph.nodes.node_h100_cluster.hardwareMeta.gpuCount = 1;
    constrainedGraph.nodes.node_adamw_optimizer.mlMeta.zeroStage = 0;
    constrainedGraph.nodes.node_adamw_optimizer.mlMeta.gradientCheckpointing = false;

    const analysis = analyzeMlConstraints(constrainedGraph);
    assert.ok(analysis.stats.criticalCount >= 1, 'Flags critical VRAM OOM error');

    const oomIssue = analysis.issues.find((i) => i.category === 'VRAM_OOM');
    assert.ok(oomIssue, 'Includes VRAM_OOM issue');
    assert.strictEqual(oomIssue.severity, 'critical');
    assert.ok(oomIssue.remedies.length >= 2, 'Suggests actionable remedies (ZeRO-3, checkpointing, LoRA)');
  });

  test('analyzeMlConstraints: Flags PCIe interconnect bottleneck on multi-GPU training', () => {
    const pcieGraph = JSON.parse(JSON.stringify(mlPipelineGraph));
    pcieGraph.nodes.node_h100_cluster.hardwareMeta.interconnect = 'PCIe Gen5 (64 GB/s)';
    pcieGraph.nodes.node_nvlink_interconnect.hardwareMeta.interconnectType = 'PCIe Gen5';
    pcieGraph.nodes.node_nvlink_interconnect.hardwareMeta.bidirectionalBandwidthGbps = 64;

    const analysis = analyzeMlConstraints(pcieGraph);
    const pcieIssue = analysis.issues.find((i) => i.category === 'INTERCONNECT_BOTTLENECK');
    assert.ok(pcieIssue, 'Identifies PCIe bandwidth bottleneck on multi-GPU training');
    assert.strictEqual(pcieIssue.severity, 'warning');
  });

  test('analyzeMlConstraints: Flags CPU Pandas data starvation when feeding high-speed GPUs', () => {
    const pandasGraph = JSON.parse(JSON.stringify(mlPipelineGraph));
    pandasGraph.nodes.node_cudf_preprocessor.mlMeta.framework = 'Pandas (CPU)';

    const analysis = analyzeMlConstraints(pandasGraph);
    const starvationIssue = analysis.issues.find((i) => i.category === 'DATA_STARVATION');
    assert.ok(starvationIssue, 'Identifies CPU Pandas data loader starvation');
    assert.strictEqual(starvationIssue.severity, 'warning');
  });
});
