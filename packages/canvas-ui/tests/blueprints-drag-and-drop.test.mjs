process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  app,
  server as saagServer
} from '../server.js';
import { CAPABILITY_BLUEPRINTS } from '../src/blueprints/blueprintsRegistry.js';
import { SINGLE_NODE_TEMPLATES } from '../src/blueprints/singleNodesRegistry.js';
import { instantiateBlueprint } from '../src/blueprints/blueprintInstantiator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Capability Blueprints & Drag-and-Drop Scaffolding Suite', () => {
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
    if (saagServer.listening) {
      await new Promise((resolve) => saagServer.close(resolve));
    }
  });

  test.describe('1. Blueprints Registry Completeness & Architecture Integrity', () => {
    test('contains all 4 requested domain capability blueprints', () => {
      const blueprintIds = CAPABILITY_BLUEPRINTS.map((b) => b.id);
      assert.ok(blueprintIds.includes('blueprint_stripe_checkout'), 'Should include Stripe Checkout (iOS)');
      assert.ok(blueprintIds.includes('blueprint_firebase_auth'), 'Should include Firebase Auth (iOS)');
      assert.ok(blueprintIds.includes('blueprint_tabular_preprocessing'), 'Should include Tabular Preprocessing (ML)');
      assert.ok(blueprintIds.includes('blueprint_supervisor_swarm'), 'Should include Supervisor-Worker Swarm (Agents)');
    });

    test('Stripe Checkout follows iOS Native Clean Architecture (View -> ViewModel -> Service)', () => {
      const stripe = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_stripe_checkout');
      assert.ok(stripe, 'Stripe blueprint must exist');
      assert.equal(stripe.domain, 'ios');
      assert.equal(stripe.relativeNodes.length, 3);

      const kinds = stripe.relativeNodes.map((n) => n.kind);
      assert.deepEqual(kinds, ['view', 'viewModel', 'service']);

      // Validate starter code templates
      const viewNode = stripe.relativeNodes.find((n) => n.kind === 'view');
      assert.ok(viewNode.codeTemplate.includes('struct StripeCheckoutView: View'));
      assert.ok(viewNode.sourceFile.endsWith('.swift'));

      const vmNode = stripe.relativeNodes.find((n) => n.kind === 'viewModel');
      assert.ok(vmNode.codeTemplate.includes('class StripeCheckoutViewModel'));

      const serviceNode = stripe.relativeNodes.find((n) => n.kind === 'service');
      assert.ok(serviceNode.codeTemplate.includes('class StripePaymentService'));

      // Validate pre-wired edges
      assert.equal(stripe.relativeEdges.length, 2);
      assert.equal(stripe.relativeEdges[0].sourceSuffix, 'view');
      assert.equal(stripe.relativeEdges[0].targetSuffix, 'vm');
      assert.equal(stripe.relativeEdges[1].sourceSuffix, 'vm');
      assert.equal(stripe.relativeEdges[1].targetSuffix, 'service');
    });

    test('Tabular Preprocessing Pipeline defines complete 5-stage ML workflow', () => {
      const ml = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_tabular_preprocessing');
      assert.ok(ml, 'ML blueprint must exist');
      assert.equal(ml.domain, 'ml');
      assert.equal(ml.relativeNodes.length, 5);

      const nodeNames = ml.relativeNodes.map((n) => n.name);
      assert.ok(nodeNames.includes('ParquetDataIngestion'));
      assert.ok(nodeNames.includes('GPUNullImputer'));
      assert.ok(nodeNames.includes('CategoricalTargetEncoder'));
      assert.ok(nodeNames.includes('GPUStandardScaler'));
      assert.ok(nodeNames.includes('CUDATensorBatchLoader'));

      // Validate Python code templates
      const ingestion = ml.relativeNodes.find((n) => n.name === 'ParquetDataIngestion');
      assert.ok(ingestion.codeTemplate.includes('cudf.read_parquet'));
      assert.ok(ingestion.sourceFile.endsWith('.py'));

      // Validate dataflow pipeline edges
      assert.equal(ml.relativeEdges.length, 4);
      ml.relativeEdges.forEach((e) => {
        assert.equal(e.edgeKind, 'dataflow');
        assert.ok(e.contract);
      });
    });

    test('Supervisor-Worker Swarm defines localized agent topology with approval gate', () => {
      const swarm = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_supervisor_swarm');
      assert.ok(swarm, 'Swarm blueprint must exist');
      assert.equal(swarm.domain, 'agents');
      assert.equal(swarm.relativeNodes.length, 5);

      const kinds = swarm.relativeNodes.map((n) => n.kind);
      assert.ok(kinds.includes('router'));
      assert.ok(kinds.includes('agent'));
      assert.ok(kinds.includes('gate'));

      const gateNode = swarm.relativeNodes.find((n) => n.kind === 'gate');
      assert.equal(gateNode.name, 'HumanInTheLoopGate');
      assert.ok(gateNode.description.toLowerCase().includes('human'));
    });
  });

  test.describe('2. Blueprint Canvas Instantiator & Coordinate Translation', () => {
    test('instantiates blueprint nodes with offset positions matching drop point', () => {
      const stripe = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_stripe_checkout');
      const dropPoint = { x: 450, y: 320 };

      const instantiated = instantiateBlueprint(stripe, dropPoint, []);
      assert.equal(instantiated.blueprintId, 'blueprint_stripe_checkout');
      assert.equal(instantiated.nodes.length, 3);
      assert.equal(instantiated.edges.length, 2);

      // Verify node positions translate relative offsets from drop point
      const viewNode = instantiated.nodes.find((n) => n.data.kind === 'view');
      assert.equal(viewNode.position.x, 450 + 0);
      assert.equal(viewNode.position.y, 320 + 0);
      assert.equal(viewNode.type, 'saagNode');
      assert.deepEqual(viewNode.data.canvasMeta.position, viewNode.position);

      const vmNode = instantiated.nodes.find((n) => n.data.kind === 'viewModel');
      assert.equal(vmNode.position.x, 450 + 360);
      assert.equal(vmNode.position.y, 320 + 0);

      const serviceNode = instantiated.nodes.find((n) => n.data.kind === 'service');
      assert.equal(serviceNode.position.x, 450 + 720);
      assert.equal(serviceNode.position.y, 320 + 0);
    });

    test('re-wires edge source and target IDs to match newly instantiated node IDs', () => {
      const stripe = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_stripe_checkout');
      const instantiated = instantiateBlueprint(stripe, { x: 100, y: 100 }, []);

      const viewNode = instantiated.nodes.find((n) => n.data.kind === 'view');
      const vmNode = instantiated.nodes.find((n) => n.data.kind === 'viewModel');
      const serviceNode = instantiated.nodes.find((n) => n.data.kind === 'service');

      const firstEdge = instantiated.edges[0];
      assert.equal(firstEdge.source, viewNode.id);
      assert.equal(firstEdge.target, vmNode.id);

      const secondEdge = instantiated.edges[1];
      assert.equal(secondEdge.source, vmNode.id);
      assert.equal(secondEdge.target, serviceNode.id);
    });

    test('avoids ID collisions when blueprint nodes already exist on canvas', () => {
      const stripe = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_stripe_checkout');
      const existing = ['node_stripecheckoutview', 'node_stripecheckoutviewmodel'];

      const instantiated = instantiateBlueprint(stripe, { x: 200, y: 200 }, existing);
      const viewNode = instantiated.nodes.find((n) => n.data.kind === 'view');

      assert.notEqual(viewNode.id, 'node_stripecheckoutview');
      assert.ok(viewNode.id.startsWith('node_stripecheckoutview_'));
    });

    test('extracts starter files for code scaffolding', () => {
      const fbAuth = CAPABILITY_BLUEPRINTS.find((b) => b.id === 'blueprint_firebase_auth');
      const instantiated = instantiateBlueprint(fbAuth, { x: 100, y: 100 }, []);

      assert.ok(instantiated.filesToScaffold.length >= 3);
      instantiated.filesToScaffold.forEach((f) => {
        assert.ok(f.filePath, 'Must have filePath');
        assert.ok(f.content && f.content.length > 50, 'Must have substantive starter code content');
        assert.ok(f.nodeId, 'Must link to instantiated node ID');
      });
    });
  });

  test.describe('3. Backend Scaffolding API (/api/scaffold-blueprint)', () => {
    test('rejects request missing blueprintId with 400', async () => {
      const res = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error.includes('blueprintId'));
    });

    test('blocks path traversal attacks attempting to write outside workspace', async () => {
      const res = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'test-exploit',
          scaffoldCode: true,
          files: [
            {
              filePath: '../../../../../../../../../../tmp/malicious.sh',
              content: 'echo "hacked"'
            }
          ]
        })
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.ok(body.error.includes('Access denied'));
    });

    test('supports scaffoldCode: false to instantiate on canvas without touching disk files', async () => {
      const res = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'blueprint_stripe_checkout',
          scaffoldCode: false,
          files: [
            {
              filePath: 'Views/TestSkipped.swift',
              content: 'struct TestSkipped {}'
            }
          ],
          newNodes: [{ id: 'test_node_temp', name: 'Temp' }],
          newEdges: []
        })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.scaffoldedFiles.length, 0, 'No files should be written when scaffoldCode is false');
    });

    test('broadcasts real-time WebSocket event when blueprint is scaffolded', async () => {
      // Connect test WebSocket client
      const ws = new WebSocket(wsUrl);
      await new Promise((resolve) => ws.on('open', resolve));

      const messagePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WebSocket broadcast timeout')), 5000);
        ws.on('message', (raw) => {
          try {
            const parsed = JSON.parse(raw.toString());
            const isScaffold =
              parsed.type === 'GRAPH_UPDATED' &&
              (parsed.source === 'BLUEPRINT_SCAFFOLD' || parsed.meta?.source === 'BLUEPRINT_SCAFFOLD');
            if (isScaffold) {
              clearTimeout(timeout);
              resolve(parsed);
            }
          } catch (_) {}
        });
      });

      // Scaffold a test blueprint
      await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: 'blueprint_supervisor_swarm',
          scaffoldCode: false,
          newNodes: [{ id: 'node_ws_swarm_test', name: 'TestSwarmNode' }],
          newEdges: []
        })
      });

      const broadcastMsg = await messagePromise;
      const bpId = broadcastMsg.blueprintId || broadcastMsg.meta?.blueprintId;
      assert.equal(bpId, 'blueprint_supervisor_swarm');
      ws.close();
    });
  });

  test.describe('4. Single Architectural Nodes Catalog & Palette Integration', () => {
    test('contains comprehensive building blocks across iOS, Agents, and ML domains', () => {
      assert.ok(SINGLE_NODE_TEMPLATES.length >= 12, 'Must have at least 12 curated building blocks');

      const iosNodes = SINGLE_NODE_TEMPLATES.filter((n) => n.domain === 'ios');
      const agentNodes = SINGLE_NODE_TEMPLATES.filter((n) => n.domain === 'agents');
      const mlNodes = SINGLE_NODE_TEMPLATES.filter((n) => n.domain === 'ml');

      assert.ok(iosNodes.length >= 4, 'Should include iOS View, ViewModel, Service, Repository');
      assert.ok(agentNodes.length >= 4, 'Should include Agent, Tool, Router, Gate');
      assert.ok(mlNodes.length >= 4, 'Should include Preprocessor, Model, Dataset, Hardware');
    });

    test('validates single node contracts: code template, typed sockets, and source file path', () => {
      SINGLE_NODE_TEMPLATES.forEach((template) => {
        assert.ok(template.id, 'Template must have an id');
        assert.ok(template.name, `Template ${template.id} must have a name`);
        assert.ok(template.kind, `Template ${template.id} must have a kind`);
        assert.ok(template.domain, `Template ${template.id} must specify domain`);
        assert.ok(template.level, `Template ${template.id} must specify abstraction level`);
        assert.ok(template.sourceFile, `Template ${template.id} must define sourceFile`);
        assert.ok(template.codeTemplate, `Template ${template.id} must define codeTemplate`);
        assert.ok(Array.isArray(template.inputs), `Template ${template.id} must have inputs array`);
        assert.ok(Array.isArray(template.outputs), `Template ${template.id} must have outputs array`);
      });
    });

    test('single node template can be scaffolded via /api/scaffold-blueprint', async () => {
      const nodeTemplate = SINGLE_NODE_TEMPLATES.find((n) => n.id === 'template_ios_viewmodel');
      assert.ok(nodeTemplate);

      const res = await fetch(`${baseUrl}/api/scaffold-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: nodeTemplate.id,
          blueprintTitle: nodeTemplate.name,
          scaffoldCode: false,
          files: [
            {
              filePath: nodeTemplate.sourceFile,
              content: nodeTemplate.codeTemplate,
              nodeId: 'node_test_vm'
            }
          ],
          newNodes: [
            {
              id: 'node_test_vm',
              name: nodeTemplate.name,
              kind: nodeTemplate.kind,
              position: { x: 400, y: 300 }
            }
          ],
          newEdges: []
        })
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    });
  });
});
