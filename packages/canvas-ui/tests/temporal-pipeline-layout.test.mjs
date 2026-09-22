import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeTemporalPipelineLayout } from '../src/analysis/pipelineEngine.js';
import { getNodeDimensions, detectCollisions } from '../src/analysis/treeEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksDir = path.resolve(__dirname, '../../../benchmarks');

function loadGraph(filename) {
  const fullPath = path.join(benchmarksDir, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('SaaG Left-to-Right Temporal Pipeline Engine Suite', () => {

  it('Causal Invariant: Forward edges strictly flow Left-to-Right (X_source < X_target)', () => {
    const graph = loadGraph('landmarks-graph.json');
    const nodes = Object.values(graph.nodes);

    const result = computeTemporalPipelineLayout(nodes, graph);
    const positions = result.positions;
    const feedbackSet = new Set(result.feedbackEdges);

    assert.ok(result.stages.length >= 3, 'Pipeline should produce at least 3 temporal stage columns');

    // For every forward (non-feedback) edge, target X must be strictly greater than or equal to source X
    let forwardEdgeCount = 0;
    Object.values(graph.edges).forEach((edge) => {
      if (feedbackSet.has(edge.id)) return;
      const sourcePos = positions[edge.sourceNodeId];
      const targetPos = positions[edge.targetNodeId];

      if (sourcePos && targetPos && edge.sourceNodeId !== edge.targetNodeId) {
        // Source should be to the left of target (or in same column if parallel branches)
        assert.ok(
          sourcePos.x <= targetPos.x,
          `Forward edge "${edge.id}" violated left-to-right ordering: source X (${sourcePos.x}) > target X (${targetPos.x})`
        );
        forwardEdgeCount++;
      }
    });

    assert.ok(forwardEdgeCount > 10, 'Should verify at least 10 forward edges');
  });

  it('Topological Rank: Anonymous graph without hardcoded names positions nodes strictly by causality', () => {
    // Pure abstract graph: Node_0 -> Node_1 -> Node_2 -> Node_3
    const syntheticGraph = {
      nodes: {
        node_a: { id: 'node_a', name: 'AlphaTrigger', kind: 'trigger' },
        node_b: { id: 'node_b', name: 'BetaFilter', kind: 'processor' },
        node_c: { id: 'node_c', name: 'GammaCompute', kind: 'executor' },
        node_d: { id: 'node_d', name: 'DeltaSink', kind: 'sink' }
      },
      edges: {
        e1: { id: 'e1', sourceNodeId: 'node_a', targetNodeId: 'node_b' },
        e2: { id: 'e2', sourceNodeId: 'node_b', targetNodeId: 'node_c' },
        e3: { id: 'e3', sourceNodeId: 'node_c', targetNodeId: 'node_d' }
      }
    };

    const result = computeTemporalPipelineLayout(Object.values(syntheticGraph.nodes), syntheticGraph);
    const { positions, stageByNodeId } = result;

    assert.equal(stageByNodeId.node_a, 0);
    assert.equal(stageByNodeId.node_b, 1);
    assert.equal(stageByNodeId.node_c, 2);
    assert.equal(stageByNodeId.node_d, 3);

    assert.ok(positions.node_a.x < positions.node_b.x);
    assert.ok(positions.node_b.x < positions.node_c.x);
    assert.ok(positions.node_c.x < positions.node_d.x);
  });

  it('ML as a Graph: Correctly orders ML training stages and anchors hardware shelf at bottom', () => {
    const mlGraph = loadGraph('ml-pipeline-graph.json');
    const nodes = Object.values(mlGraph.nodes);

    const result = computeTemporalPipelineLayout(nodes, mlGraph);
    const { positions, stageByNodeId } = result;

    // Dataset should be at Epoch 0
    assert.equal(stageByNodeId.node_parquet_dataset, 0);

    // Preprocessor should be downstream of Dataset
    assert.ok(stageByNodeId.node_cudf_preprocessor > stageByNodeId.node_parquet_dataset);

    // Model backbone should be downstream of Preprocessor
    assert.ok(stageByNodeId.node_llama3_backbone > stageByNodeId.node_cudf_preprocessor);

    // Hardware cluster should be anchored beneath compute nodes with a higher Y position
    const hwPos = positions.node_h100_cluster;
    const modelPos = positions.node_llama3_backbone;
    assert.ok(hwPos.y > modelPos.y, 'Hardware shelf should sit beneath the compute pipeline');
  });

  it('Autonomous Agents: Correctly ranks Task Ingestion -> Supervisor -> Worker -> Gate', () => {
    const agentGraph = loadGraph('agent-orchestrator-graph.json');
    const nodes = Object.values(agentGraph.nodes);

    const result = computeTemporalPipelineLayout(nodes, agentGraph);
    const { positions, stageByNodeId } = result;

    // Supervisor sits upstream of delegated workers
    assert.ok(stageByNodeId.node_supervisor_agent <= stageByNodeId.node_codewriter_agent);
    assert.ok(positions.node_supervisor_agent.x <= positions.node_codewriter_agent.x);
  });

  it('Zero Collisions: Guarantees 0 bounding box overlaps across all pipeline stages', () => {
    const benchmarks = ['landmarks-graph.json', 'makeitso-graph.json', 'ml-pipeline-graph.json'];

    benchmarks.forEach((file) => {
      const graph = loadGraph(file);
      const nodes = Object.values(graph.nodes);
      const result = computeTemporalPipelineLayout(nodes, graph);

      const nodeMap = {};
      nodes.forEach((n) => { nodeMap[n.id] = n; });

      const collisions = detectCollisions(result.positions, nodeMap, 20, 20);
      assert.equal(
        collisions.length,
        0,
        `Pipeline layout produced ${collisions.length} collision(s) in "${file}": ${JSON.stringify(collisions)}`
      );
    });
  });
});
