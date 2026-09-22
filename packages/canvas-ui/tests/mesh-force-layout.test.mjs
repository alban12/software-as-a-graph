import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeMeshForceLayout } from '../src/analysis/meshEngine.js';
import { detectCollisions } from '../src/analysis/treeEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksDir = path.resolve(__dirname, '../../../benchmarks');

function loadGraph(filename) {
  const fullPath = path.join(benchmarksDir, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('SaaG Equidistant Force-Directed Mesh Engine Suite', () => {

  it('Zero Collisions: Guarantees 0 bounding box overlaps across all benchmarks', () => {
    const benchmarks = ['landmarks-graph.json', 'makeitso-graph.json', 'ml-pipeline-graph.json', 'agent-orchestrator-graph.json'];

    benchmarks.forEach((file) => {
      const graph = loadGraph(file);
      const nodes = Object.values(graph.nodes);
      const result = computeMeshForceLayout(nodes, graph);

      const nodeMap = {};
      nodes.forEach((n) => { nodeMap[n.id] = n; });

      const collisions = detectCollisions(result.positions, nodeMap, 20, 20);
      assert.equal(
        collisions.length,
        0,
        `Mesh layout produced ${collisions.length} collision(s) in "${file}": ${JSON.stringify(collisions)}`
      );
    });
  });

  it('Determinism: Executing mesh simulation multiple times yields identical coordinates', () => {
    const graph = loadGraph('ml-pipeline-graph.json');
    const nodes = Object.values(graph.nodes);

    const run1 = computeMeshForceLayout(nodes, graph);
    const run2 = computeMeshForceLayout(nodes, graph);

    assert.deepEqual(run1.positions, run2.positions, 'Mesh force layout must be 100% deterministic');
  });

  it('Hub Identification: Accurately identifies highest-degree central hubs', () => {
    // In Landmarks, ModelData is the central state hub with the highest degree
    const landmarksGraph = loadGraph('landmarks-graph.json');
    const landmarksNodes = Object.values(landmarksGraph.nodes);
    const landmarksResult = computeMeshForceLayout(landmarksNodes, landmarksGraph);

    assert.equal(landmarksResult.hubNodeId, 'node_modeldata', 'ModelData should be identified as the central state hub');

    // In Agent Orchestrator, Router/Supervisor is the central coordinator hub
    const agentGraph = loadGraph('agent-orchestrator-graph.json');
    const agentNodes = Object.values(agentGraph.nodes);
    const agentResult = computeMeshForceLayout(agentNodes, agentGraph);

    assert.ok(
      agentResult.hubNodeId === 'node_supervisor_agent' || agentResult.hubNodeId === 'node_intent_router',
      'Router or Supervisor should be identified as the central agent hub'
    );
  });

  it('Organic Clustered Distribution: Connected peers stay within target equilibrium distance', () => {
    const graph = loadGraph('ml-pipeline-graph.json');
    const nodes = Object.values(graph.nodes);
    const result = computeMeshForceLayout(nodes, graph, { idealDistance: 400 });

    const pos = result.positions;
    // Check distance between directly connected nodes (e.g. Dataset -> Preprocessor)
    const datasetPos = pos.node_parquet_dataset;
    const preprocPos = pos.node_cudf_preprocessor;

    const dist = Math.hypot(datasetPos.x - preprocPos.x, datasetPos.y - preprocPos.y);
    assert.ok(dist > 100, 'Nodes must not be too close');
    assert.ok(dist < 1500, 'Directly connected nodes must remain within attractive equilibrium range');
  });
});
