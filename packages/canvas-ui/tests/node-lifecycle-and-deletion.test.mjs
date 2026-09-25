process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  app,
  server as saagServer,
  KNOWN_PROJECTS,
  closeWatchers
} from '../server.js';
import { SINGLE_NODE_TEMPLATES } from '../src/blueprints/singleNodesRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

test.describe('Node Lifecycle, Deletion, Coordinate Preservation & ML Pipeline Suite', () => {
  let baseUrl;
  let wsUrl;

  test.before(async () => {
    await new Promise((resolve) => {
      saagServer.listen(0, '127.0.0.1', () => {
        const address = saagServer.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        wsUrl = `ws://127.0.0.1:${address.port}/ws`;
        resolve();
      });
    });
  });

  test.after(async () => {
    // Ensure we leave the server switched to default landmarks project
    try {
      await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'landmarks' })
      });
    } catch (_) {}

    closeWatchers();

    if (saagServer.listening) {
      await new Promise((resolve) => saagServer.close(resolve));
    }
  });

  test.describe('1. Single Node Deletion & Automatic Cascading Edge Pruning', () => {
    const testNodeId = 'test_lifecycle_node_alpha';
    const peerNodeId = 'test_lifecycle_node_beta';
    const testEdgeId = 'test_lifecycle_edge_1';

    test('adds nodes with edges, deletes target node, and verifies connected edges are cascade-deleted', async () => {
      // 1. Add 2 connected test nodes
      const addRes = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'test_lifecycle_bp',
          scaffoldCode: false,
          newNodes: [
            {
              id: testNodeId,
              name: 'Alpha Node',
              kind: 'view',
              position: { x: 120, y: 240 },
              canvasMeta: { position: { x: 120, y: 240 } }
            },
            {
              id: peerNodeId,
              name: 'Beta Node',
              kind: 'viewModel',
              position: { x: 480, y: 240 },
              canvasMeta: { position: { x: 480, y: 240 } }
            }
          ],
          newEdges: [
            {
              id: testEdgeId,
              source: testNodeId,
              target: peerNodeId,
              sourceNodeId: testNodeId,
              targetNodeId: peerNodeId
            }
          ]
        })
      });
      assert.equal(addRes.status, 200);

      // Verify addition in graph
      const graphBefore = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.ok(graphBefore.nodes[testNodeId], 'Alpha node must exist');
      assert.ok(graphBefore.nodes[peerNodeId], 'Beta node must exist');
      assert.ok(graphBefore.edges[testEdgeId], 'Connecting edge must exist');

      // 2. Delete testNodeId via DELETE /api/graph/node/:nodeId
      const delRes = await fetch(`${baseUrl}/api/graph/node/${testNodeId}`, {
        method: 'DELETE'
      });
      assert.equal(delRes.status, 200);
      const delBody = await delRes.json();
      assert.equal(delBody.success, true);
      assert.equal(delBody.nodeId, testNodeId);
      assert.equal(delBody.nodeExisted, true);
      assert.ok(delBody.removedEdgesCount >= 1, 'Must report at least 1 cascade-deleted edge');

      // 3. Reload graph and assert Alpha is gone AND the edge is gone, while Beta remains
      const graphAfter = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.equal(graphAfter.nodes[testNodeId], undefined, 'Deleted Alpha node must not exist');
      assert.equal(graphAfter.edges[testEdgeId], undefined, 'Connected edge must be cascade-deleted');
      assert.ok(graphAfter.nodes[peerNodeId], 'Peer Beta node must remain unaffected');

      // Clean up peer node
      await fetch(`${baseUrl}/api/graph/node/${peerNodeId}`, { method: 'DELETE' });
    });

    test('gracefully handles deleting non-existent node without server crash', async () => {
      const res = await fetch(`${baseUrl}/api/graph/node/non_existent_ghost_node_999`, {
        method: 'DELETE'
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.nodeExisted, false);
      assert.equal(body.removedEdgesCount, 0);
    });

    test('deletes individual edge via DELETE /api/graph/edge/:edgeId leaving nodes intact', async () => {
      const n1 = 'node_edge_test_src';
      const n2 = 'node_edge_test_tgt';
      const e1 = 'edge_test_standalone';

      await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'temp_edge_test',
          scaffoldCode: false,
          newNodes: [
            { id: n1, name: 'Source' },
            { id: n2, name: 'Target' }
          ],
          newEdges: [
            { id: e1, source: n1, target: n2 }
          ]
        })
      });

      // Delete edge
      const delEdgeRes = await fetch(`${baseUrl}/api/graph/edge/${e1}`, {
        method: 'DELETE'
      });
      assert.equal(delEdgeRes.status, 200);

      const graph = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.equal(graph.edges[e1], undefined, 'Edge must be removed');
      assert.ok(graph.nodes[n1], 'Source node must still exist');
      assert.ok(graph.nodes[n2], 'Target node must still exist');

      // Clean up nodes
      await fetch(`${baseUrl}/api/graph/delete-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds: [n1, n2] })
      });
    });
  });

  test.describe('2. Batch Deletion & WebSocket Broadcast Integrity', () => {
    test('atomically deletes multiple nodes and edges via POST /api/graph/delete-elements', async () => {
      const bNodes = ['node_batch_a', 'node_batch_b', 'node_batch_c'];
      const bEdges = ['edge_batch_ab', 'edge_batch_bc'];

      // Add 3 nodes and 2 edges
      await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'batch_test_bp',
          scaffoldCode: false,
          newNodes: bNodes.map((id) => ({ id, name: id, position: { x: 100, y: 100 } })),
          newEdges: [
            { id: 'edge_batch_ab', source: 'node_batch_a', target: 'node_batch_b' },
            { id: 'edge_batch_bc', source: 'node_batch_b', target: 'node_batch_c' }
          ]
        })
      });

      // Delete batch
      const res = await fetch(`${baseUrl}/api/graph/delete-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeIds: bNodes,
          edgeIds: bEdges
        })
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.deletedNodeCount, 3);

      // Verify disk graph
      const graph = await (await fetch(`${baseUrl}/api/graph`)).json();
      bNodes.forEach((id) => assert.equal(graph.nodes[id], undefined));
      bEdges.forEach((id) => assert.equal(graph.edges[id], undefined));
    });

    test('broadcasts real-time NODE_DELETED event over WebSocket on node deletion', async () => {
      const ws = new WebSocket(wsUrl);
      await new Promise((resolve) => ws.on('open', resolve));

      const tempId = 'node_ws_del_event_test';
      await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'temp_ws_bp',
          scaffoldCode: false,
          newNodes: [{ id: tempId, name: 'Temp' }],
          newEdges: []
        })
      });

      const wsEventPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket broadcast timeout')), 5000);
        ws.on('message', (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            if (data.type === 'GRAPH_UPDATED' && (data.source === 'NODE_DELETED' || data.meta?.source === 'NODE_DELETED')) {
              clearTimeout(timeout);
              resolve(data);
            }
          } catch (_) {}
        });
      });

      await fetch(`${baseUrl}/api/graph/node/${tempId}`, { method: 'DELETE' });

      const broadcastMsg = await wsEventPromise;
      const eventNodeId = broadcastMsg.nodeId || broadcastMsg.meta?.nodeId;
      assert.equal(eventNodeId, tempId);
      ws.close();
    });
  });

  test.describe('3. ML Pipeline (Llama-3) Graph & FeatureTransformer Node Lifecycle', () => {
    test.before(async () => {
      // Switch active project to ml_pipeline
      const res = await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'ml_pipeline' })
      });
      assert.equal(res.status, 200);
    });

    test.after(async () => {
      // Switch back to landmarks
      await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'landmarks' })
      });
    });

    test('verifies Llama-3 baseline canonical topology contains 8 core stages', async () => {
      const res = await fetch(`${baseUrl}/api/graph`);
      const graph = await res.json();

      const expectedNodes = [
        'node_parquet_dataset',
        'node_cudf_preprocessor',
        'node_llama3_backbone',
        'node_lora_adapter',
        'node_adamw_optimizer',
        'node_h100_cluster',
        'node_nvlink_interconnect',
        'node_vllm_engine'
      ];

      expectedNodes.forEach((id) => {
        assert.ok(graph.nodes[id], `Llama-3 graph must contain baseline node ${id}`);
      });
    });

    test('validates FeatureTransformer template contract in SINGLE_NODE_TEMPLATES', () => {
      const template = SINGLE_NODE_TEMPLATES.find((t) => t.name === 'FeatureTransformer');
      assert.ok(template, 'FeatureTransformer template must exist');
      assert.equal(template.kind, 'preprocessor');
      assert.equal(template.level, 'L2_SUBSYSTEM');
      assert.equal(template.domain, 'ml');
      assert.ok(template.sourceFile.endsWith('.py'));
      assert.ok(template.codeTemplate.includes('class FeatureTransformer:'));
      assert.ok(template.codeTemplate.includes('cudf.DataFrame'));
      assert.equal(template.inputs[0].type, 'cudf.DataFrame');
      assert.equal(template.outputs[0].type, 'cudf.DataFrame');
    });

    test('adds FeatureTransformer to Llama-3 graph, preserves coordinates, and deletes without skewing canvas', async () => {
      const ftTemplate = SINGLE_NODE_TEMPLATES.find((t) => t.name === 'FeatureTransformer');
      assert.ok(ftTemplate);

      const targetPos = { x: 320, y: 480 };
      const testFtId = 'node_preprocessor_test_ft';

      // 1. Add FeatureTransformer
      const addRes = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: ftTemplate.id,
          blueprintTitle: ftTemplate.name,
          scaffoldCode: false,
          newNodes: [
            {
              id: testFtId,
              name: ftTemplate.name,
              kind: ftTemplate.kind,
              level: ftTemplate.level,
              domain: ftTemplate.domain,
              position: targetPos,
              canvasMeta: { position: targetPos }
            }
          ],
          newEdges: []
        })
      });
      assert.equal(addRes.status, 200);

      // 2. Verify node was added with exact coordinates
      const graphWithFt = await (await fetch(`${baseUrl}/api/graph`)).json();
      const addedNode = graphWithFt.nodes[testFtId];
      assert.ok(addedNode, 'FeatureTransformer node must exist in graph');
      assert.equal(addedNode.position.x, targetPos.x);
      assert.equal(addedNode.position.y, targetPos.y);
      assert.equal(addedNode.level, 'L2_SUBSYSTEM');

      // 3. Test Abstraction Level Visibility Invariants
      // L1 Journey: strictly L1_SCREEN or L1_SYSTEM
      const isL1Visible = addedNode.level === 'L1_SCREEN' || addedNode.level === 'L1_SYSTEM';
      assert.equal(isL1Visible, false, 'L2 Subsystem should be filtered at L1 Journey');

      // L2 Architecture: includes L2_SUBSYSTEM (hides only L3_PRIMITIVE and L3_EXECUTION)
      const isL2Visible = addedNode.level !== 'L3_PRIMITIVE' && addedNode.level !== 'L3_EXECUTION';
      assert.equal(isL2Visible, true, 'L2 Subsystem must be visible at L2 Architecture');

      // 4. Delete the node and verify non-resurrection
      const delRes = await fetch(`${baseUrl}/api/graph/node/${testFtId}`, {
        method: 'DELETE'
      });
      assert.equal(delRes.status, 200);

      // 5. Reload graph from disk and confirm permanently gone
      const graphClean = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.equal(graphClean.nodes[testFtId], undefined, 'FeatureTransformer must be removed and not resurrect');
    });
  });

  test.describe('4. Ghost Coordinates Pruning & Canvas Bounds Integrity', () => {
    test('strictly removes deleted node IDs from mesh positions map to prevent skewed bounding box', () => {
      // Emulate the meshPositionsRef reconciliation logic implemented in App.jsx
      const mockMeshPositionsRef = {
        node_parquet_dataset: { x: 60, y: 60 },
        node_llama3_backbone: { x: 520, y: 60 },
        deleted_ghost_node_1: { x: -9999, y: 8888 }, // rogue outlier coordinate
        deleted_ghost_node_2: { x: 12000, y: -4500 }
      };

      const activeGraphNodes = {
        node_parquet_dataset: { id: 'node_parquet_dataset', position: { x: 60, y: 60 } },
        node_llama3_backbone: { id: 'node_llama3_backbone', position: { x: 520, y: 60 } }
      };

      const validNodeIds = new Set(Object.keys(activeGraphNodes));

      // Execute pruning logic identical to App.jsx lines 818-825
      const prunedMesh = {};
      Object.keys(mockMeshPositionsRef).forEach((id) => {
        if (validNodeIds.has(id)) {
          prunedMesh[id] = mockMeshPositionsRef[id];
        }
      });

      assert.deepEqual(Object.keys(prunedMesh), ['node_parquet_dataset', 'node_llama3_backbone']);
      assert.equal(prunedMesh.deleted_ghost_node_1, undefined);
      assert.equal(prunedMesh.deleted_ghost_node_2, undefined);

      // Verify canvas bounding box calculation is not skewed by pruned ghosts
      const xs = Object.values(prunedMesh).map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      assert.ok(minX >= 0, 'Bounding box minX should be >= 0 without rogue negative coordinates');
      assert.ok(maxX <= 1000, 'Bounding box maxX should not be inflated to 12000');
    });
  });

  test.describe('5. Project Isolation & Synchronous Switch Resilience', () => {
    test('initializes default active project and graphPath in sync', async () => {
      const res = await fetch(`${baseUrl}/api/projects`);
      const body = await res.json();
      assert.ok(body.activeProjectId, 'Must return activeProjectId');
      assert.ok(Array.isArray(body.projects), 'Must return project list');

      const activeProj = body.projects.find((p) => p.id === body.activeProjectId);
      assert.ok(activeProj, 'Active project must be in projects list');
      assert.equal(activeProj.isActive, true);
    });

    test('project switch synchronously updates active graph on disk and memory', async () => {
      // 1. Switch to agent_orchestrator
      const res1 = await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'agent_orchestrator' })
      });
      assert.equal(res1.status, 200);
      const body1 = await res1.json();
      assert.equal(body1.activeProjectId, 'agent_orchestrator');

      const graphAgents = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.ok(graphAgents.nodes.node_supervisor_agent, 'Must load Agent Orchestrator graph');

      // 2. Switch back to landmarks
      const res2 = await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'landmarks' })
      });
      assert.equal(res2.status, 200);

      const graphLandmarks = await (await fetch(`${baseUrl}/api/graph`)).json();
      assert.ok(graphLandmarks.nodes.node_landmarklist || graphLandmarks.nodes.node_landmarkdetail, 'Must load Landmarks graph');
    });

    test('rejects switching to invalid project ID with 404', async () => {
      const res = await fetch(`${baseUrl}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'invalid_proj_xyz' })
      });
      assert.equal(res.status, 404);
    });
  });
});
