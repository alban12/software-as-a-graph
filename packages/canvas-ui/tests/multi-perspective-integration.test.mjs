import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decomposeAppTree, computeAdaptiveTreeLayout, detectCollisions } from '../src/analysis/treeEngine.js';
import { computeTemporalPipelineLayout } from '../src/analysis/pipelineEngine.js';
import { computeMeshForceLayout } from '../src/analysis/meshEngine.js';
import { executeGetArchitectureGraph } from '../../../packages/mcp-server/src/tools/getArchitectureGraph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksDir = path.resolve(__dirname, '../../../benchmarks');

function loadGraph(filename) {
  const fullPath = path.join(benchmarksDir, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('SaaG Fluid 3-Lens Multi-Perspective Engine Suite', () => {

  it('Same Graph, Three Distinct Spatial Semantics: Tree (Y), Pipeline (X), Mesh (2D)', () => {
    const graph = loadGraph('landmarks-graph.json');
    const nodes = Object.values(graph.nodes);

    // 1. Tree Lens
    const treeData = decomposeAppTree(graph);
    const treePos = computeAdaptiveTreeLayout(nodes, treeData, graph);
    const rootPos = treePos.node_landmarksapp;
    const detailPos = treePos.node_landmarkdetail;
    assert.ok(rootPos.y < detailPos.y, 'Tree lens must preserve top-to-bottom hierarchy');

    // 2. Temporal Pipeline Lens
    const pipelineRes = computeTemporalPipelineLayout(nodes, graph);
    const pipelinePos = pipelineRes.positions;
    assert.ok(pipelineRes.stages.length >= 3);
    // LandmarkList is upstream of LandmarkDetail in the user journey
    assert.ok(
      pipelinePos.node_landmarklist.x <= pipelinePos.node_landmarkdetail.x,
      'Pipeline lens must preserve left-to-right causal progression'
    );

    // 3. Equidistant Mesh Lens
    const meshRes = computeMeshForceLayout(nodes, graph);
    const meshPos = meshRes.positions;
    assert.equal(meshRes.hubNodeId, 'node_modeldata', 'Mesh lens identifies ModelData hub');

    // All 3 layouts must position every single node without omissions
    nodes.forEach((n) => {
      assert.ok(treePos[n.id], `Tree missing node "${n.id}"`);
      assert.ok(pipelinePos[n.id], `Pipeline missing node "${n.id}"`);
      assert.ok(meshPos[n.id], `Mesh missing node "${n.id}"`);
    });
  });

  it('Zero Collisions Guaranteed across ALL 3 Lenses on Landmarks & MakeItSo', () => {
    const testCases = ['landmarks-graph.json', 'makeitso-graph.json'];

    testCases.forEach((file) => {
      const graph = loadGraph(file);
      const nodes = Object.values(graph.nodes);
      const nodeMap = {};
      nodes.forEach((n) => { nodeMap[n.id] = n; });

      // Lens 1: Tree
      const treeData = decomposeAppTree(graph);
      const treePos = computeAdaptiveTreeLayout(nodes, treeData, graph);
      const treeCollisions = detectCollisions(treePos, nodeMap, 20, 20);
      assert.equal(treeCollisions.length, 0, `Tree collision in ${file}`);

      // Lens 2: Pipeline
      const pipelineRes = computeTemporalPipelineLayout(nodes, graph);
      const pipeCollisions = detectCollisions(pipelineRes.positions, nodeMap, 20, 20);
      assert.equal(pipeCollisions.length, 0, `Pipeline collision in ${file}`);

      // Lens 3: Mesh
      const meshRes = computeMeshForceLayout(nodes, graph);
      const meshCollisions = detectCollisions(meshRes.positions, nodeMap, 20, 20);
      assert.equal(meshCollisions.length, 0, `Mesh collision in ${file}`);
    });
  });

  it('MCP Tool Integration: get_architecture_graph seamlessly returns coordinates for requested layoutMode', async () => {
    // 1. Pipeline mode over MCP
    const mcpPipeline = await executeGetArchitectureGraph({
      project: 'landmarks',
      level: 'L1',
      layoutMode: 'pipeline'
    });

    assert.equal(mcpPipeline.layoutMode, 'pipeline');
    assert.ok(mcpPipeline.nodes.node_landmarklist.position.x > 0);

    // 2. Mesh mode over MCP
    const mcpMesh = await executeGetArchitectureGraph({
      project: 'landmarks',
      level: 'L1',
      layoutMode: 'mesh'
    });

    assert.equal(mcpMesh.layoutMode, 'mesh');
    assert.ok(mcpMesh.nodes.node_landmarklist.position.x > 0);

    // 3. Tree mode over MCP
    const mcpTree = await executeGetArchitectureGraph({
      project: 'landmarks',
      level: 'L1',
      layoutMode: 'tree'
    });

    assert.equal(mcpTree.layoutMode, 'tree');
    assert.ok(mcpTree.nodes.node_landmarklist.position.y > 0);
  });
});
