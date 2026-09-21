/**
 * SaaG ML Systems & Constraint Solving Engine
 * 
 * Statically analyzes ML model creation workflows and detects:
 * 1. Predicted CUDA Out-Of-Memory (OOM) before running code (Weights + Optimizer + Activations vs GPU VRAM)
 * 2. Hardware Interconnect Bottlenecks (e.g. Tensor Parallelism on PCIe vs NVLink)
 * 3. Data Pipeline Starvation (e.g. CPU Pandas vs GPU cuDF throughput)
 */

export function calculateModelMemoryFootprint(modelNode, adapterNode = null, optimizerNode = null) {
  const modelMeta = modelNode?.mlMeta || {};
  const adapterMeta = adapterNode?.mlMeta || {};
  const optMeta = optimizerNode?.mlMeta || {};

  // Extract parameters in billions (default 8B if unspecified)
  let paramCountB = 8.0;
  if (modelMeta.paramCount) {
    const raw = String(modelMeta.paramCount).toUpperCase().replace('B', '').trim();
    paramCountB = parseFloat(raw) || 8.0;
  }

  // Precision bytes per parameter for weights
  const precision = (modelMeta.precision || 'BF16').toUpperCase();
  let bytesPerParam = 2.0; // BF16 / FP16 default
  if (precision === 'FP32') bytesPerParam = 4.0;
  else if (precision === 'FP8') bytesPerParam = 1.0;
  else if (precision === 'INT4' || precision === 'AWQ' || precision === 'GPTQ') bytesPerParam = 0.5;

  const weightsVramGb = paramCountB * bytesPerParam;

  // Adapter overhead (LoRA typically 0.2 - 0.8 GB)
  const adapterVramGb = adapterMeta.vramOverheadGb || (adapterMeta.rank ? 0.4 : 0.0);

  // Optimizer state memory
  const optType = (optMeta.optimizerType || 'AdamW').toLowerCase();
  const zeroStage = optMeta.zeroStage ?? 0;
  let optBytesPerParam = 12.0; // Standard 32-bit AdamW (momentum + variance = 8 bytes, master weights = 4 bytes)
  if (optType.includes('8bit') || optType.includes('8-bit')) {
    optBytesPerParam = 4.0;
  } else if (optType.includes('sgd')) {
    optBytesPerParam = 4.0;
  }

  // If training only LoRA, optimizer states apply only to trainable adapter params
  const isLoraOnly = Boolean(adapterNode);
  const trainableParamFraction = isLoraOnly ? 0.01 : 1.0;
  let optimizerVramGb = (paramCountB * trainableParamFraction) * optBytesPerParam;

  // Activation memory calculation based on batch size and context length
  const batchSize = modelMeta.batchSize || optMeta.batchSize || 4;
  const contextLen = modelMeta.contextLength || 4096;
  const hasGradientCheckpointing = Boolean(optMeta.gradientCheckpointing);

  // Approximate transformer activation footprint
  let activationVramGb = (batchSize * contextLen * 4096 * 32 * 2) / (1024 * 1024 * 1024);
  if (hasGradientCheckpointing) {
    activationVramGb *= 0.25; // Checkpointing drops activation memory by ~75%
  }

  return {
    weightsVramGb,
    adapterVramGb,
    optimizerVramGb,
    activationVramGb,
    totalVramGb: weightsVramGb + adapterVramGb + optimizerVramGb + activationVramGb,
    isLoraOnly,
    hasGradientCheckpointing,
    zeroStage
  };
}

export function analyzeMlConstraints(graph) {
  if (!graph || !graph.nodes) {
    return { issues: [], stats: { totalIssues: 0, criticalCount: 0, warningCount: 0 } };
  }

  const nodes = Object.values(graph.nodes);
  const edges = Object.values(graph.edges || {});
  const issues = [];

  // Identify nodes by kind
  const modelNodes = nodes.filter((n) => n.kind === 'model');
  const adapterNodes = nodes.filter((n) => n.kind === 'adapter');
  const optimizerNodes = nodes.filter((n) => n.kind === 'optimizer');
  const hardwareNodes = nodes.filter((n) => n.kind === 'hardware');
  const preprocessorNodes = nodes.filter((n) => n.kind === 'preprocessor');
  const interconnectNodes = nodes.filter((n) => n.kind === 'interconnect');

  const primaryModel = modelNodes[0] || null;
  const primaryAdapter = adapterNodes[0] || null;
  const primaryOptimizer = optimizerNodes[0] || null;
  const primaryHardware = hardwareNodes[0] || null;
  const primaryPreprocessor = preprocessorNodes[0] || null;
  const primaryInterconnect = interconnectNodes[0] || null;

  // 1. Static VRAM & OOM Constraint Check
  if (primaryModel && primaryHardware) {
    const memory = calculateModelMemoryFootprint(primaryModel, primaryAdapter, primaryOptimizer);
    const hwMeta = primaryHardware.hardwareMeta || {};
    const gpuVramGb = hwMeta.vramPerGpuGb || (hwMeta.totalVramGb && hwMeta.gpuCount ? hwMeta.totalVramGb / hwMeta.gpuCount : 80.0);
    const gpuCount = hwMeta.gpuCount || 1;

    // Effective VRAM requirement per GPU accounting for ZeRO-3 sharding
    let requiredVramPerGpu = memory.totalVramGb;
    if (memory.zeroStage === 3 && gpuCount > 1) {
      // ZeRO-3 shards optimizer states and weights across GPUs
      requiredVramPerGpu = (memory.weightsVramGb + memory.optimizerVramGb) / gpuCount + memory.activationVramGb + memory.adapterVramGb;
    }

    if (requiredVramPerGpu > gpuVramGb) {
      const deficitGb = requiredVramPerGpu - gpuVramGb;
      const remedies = [];
      if (!memory.hasGradientCheckpointing) remedies.push('Enable Gradient Checkpointing on Optimizer node (-75% activation memory)');
      if (memory.zeroStage < 3 && gpuCount > 1) remedies.push(`Enable DeepSpeed ZeRO-3 sharding across all ${gpuCount} GPUs`);
      if (!primaryAdapter) remedies.push('Switch to Parameter-Efficient Fine-Tuning (LoRA / QLoRA adapter)');
      remedies.push('Reduce per-device micro-batch size');

      issues.push({
        id: 'issue_vram_oom',
        severity: 'critical',
        category: 'VRAM_OOM',
        nodeId: primaryHardware.id,
        nodeName: primaryHardware.name,
        metric: `Required: ${requiredVramPerGpu.toFixed(1)} GB / GPU > Available: ${gpuVramGb.toFixed(1)} GB`,
        message: `Predicted CUDA Out Of Memory (OOM): Training job exceeds GPU HBM by ${deficitGb.toFixed(1)} GB per device.`,
        remedies,
        details: {
          weightsVramGb: memory.weightsVramGb,
          optimizerVramGb: memory.optimizerVramGb,
          activationVramGb: memory.activationVramGb,
          requiredVramPerGpu,
          gpuVramGb
        }
      });
    }
  }

  // 2. Hardware Interconnect Bottleneck Check
  if (primaryHardware && primaryHardware.hardwareMeta?.gpuCount > 1) {
    const hwMeta = primaryHardware.hardwareMeta;
    const interconnect = primaryInterconnect?.hardwareMeta || {};
    const isPcie = (hwMeta.interconnect || interconnect.interconnectType || '').toLowerCase().includes('pcie');

    if (isPcie) {
      issues.push({
        id: 'issue_interconnect_pcie',
        severity: 'warning',
        category: 'INTERCONNECT_BOTTLENECK',
        nodeId: primaryHardware.id,
        nodeName: primaryHardware.name,
        metric: `Bandwidth: ${interconnect.bidirectionalBandwidthGbps || 64} GB/s (PCIe)`,
        message: 'Distributed Tensor Parallelism over PCIe bus will cause high all-reduce synchronization stalls (~65-80% compute idle time).',
        remedies: [
          'Switch hardware topology to NVLink 4.0 mesh (900 GB/s)',
          'Switch from Tensor Parallelism (TP) to Pipeline / Data Parallelism (DP/FSDP) to minimize all-reduce traffic'
        ]
      });
    }
  }

  // 3. Data Pipeline Starvation Check
  if (primaryPreprocessor && primaryHardware) {
    const prepMeta = primaryPreprocessor.mlMeta || {};
    const framework = (prepMeta.framework || '').toLowerCase();
    const isCpuPandas = framework.includes('pandas') && !framework.includes('cudf');

    if (isCpuPandas) {
      issues.push({
        id: 'issue_data_starvation',
        severity: 'warning',
        category: 'DATA_STARVATION',
        nodeId: primaryPreprocessor.id,
        nodeName: primaryPreprocessor.name,
        metric: 'CPU Bound: ~800 samples/sec vs GPU Consumer: ~12,500 samples/sec',
        message: 'Host CPU Pandas data loader cannot saturate GPU Tensor Cores, creating an I/O starvation bottleneck.',
        remedies: [
          'Upgrade preprocessor node to GPU-accelerated cuDF (RAPIDS)',
          'Enable pinned host memory and asynchronous prefetch_factor >= 4'
        ]
      });
    }
  }

  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    stats: {
      totalIssues: issues.length,
      criticalCount,
      warningCount
    }
  };
}
