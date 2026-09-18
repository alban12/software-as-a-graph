import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateEdgeConnection,
  inferEdgeContract,
  GUARDRAIL_RULES
} from '../src/utils/edgeGuardrails.js';

test.describe('Architectural Edge Guardrails & Contract Inference', () => {
  const mockGraph = {
    nodes: {
      node_loginview: { id: 'node_loginview', name: 'LoginView', kind: 'view' },
      node_authvm: { id: 'node_authvm', name: 'AuthViewModel', kind: 'viewModel' },
      node_authservice: {
        id: 'node_authservice',
        name: 'AuthService',
        kind: 'service',
        inputs: [{ id: 'port_auth_login', name: 'login', typeAnnotation: '(Credentials) -> Session', isAsync: true }]
      },
      node_keychainrepo: { id: 'node_keychainrepo', name: 'KeychainRepository', kind: 'repository' }
    },
    edges: {
      edge_1: { id: 'edge_1', source: 'node_loginview', target: 'node_authvm' }
    }
  };

  test('Prevents Self-Loops', () => {
    const res = validateEdgeConnection(
      { source: 'node_authvm', target: 'node_authvm' },
      mockGraph
    );
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.rule, GUARDRAIL_RULES.SELF_LOOP);
  });

  test('Prevents Duplicate Connections', () => {
    const res = validateEdgeConnection(
      { source: 'node_loginview', target: 'node_authvm' },
      mockGraph,
      [{ source: 'node_loginview', target: 'node_authvm' }]
    );
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.rule, GUARDRAIL_RULES.DUPLICATE_EDGE);
  });

  test('Enforces Layer Separation: View cannot bypass ViewModel to call Repository', () => {
    const res = validateEdgeConnection(
      { source: 'node_loginview', target: 'node_keychainrepo' },
      mockGraph
    );
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.rule, GUARDRAIL_RULES.LAYER_VIEW_TO_REPOSITORY);
    assert.ok(res.reason.includes('cannot directly access Repository'));
  });

  test('Enforces Layer Separation: Service cannot directly drive View', () => {
    const res = validateEdgeConnection(
      { source: 'node_authservice', target: 'node_loginview' },
      mockGraph
    );
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.rule, GUARDRAIL_RULES.LAYER_SERVICE_TO_VIEW);
  });

  test('Allows Clean Architecture connections: View -> ViewModel -> Service', () => {
    const viewToVm = validateEdgeConnection(
      { source: 'node_loginview', target: 'node_authvm' },
      mockGraph,
      []
    );
    assert.strictEqual(viewToVm.isValid, true);

    const vmToService = validateEdgeConnection(
      { source: 'node_authvm', target: 'node_authservice' },
      mockGraph,
      []
    );
    assert.strictEqual(vmToService.isValid, true);
  });

  test('Enforces Agent Scope boundary freezing', () => {
    const activeScope = {
      lockedNodeIds: ['node_authvm', 'node_authservice'],
      frozenBoundaryPorts: [
        { nodeId: 'node_authservice', portId: 'port_frozen_out' }
      ]
    };

    // Attempting to route a frozen port to an outside node (node_loginview)
    const res = validateEdgeConnection(
      { source: 'node_authservice', sourceHandle: 'port_frozen_out', target: 'node_loginview' },
      mockGraph,
      [],
      activeScope
    );
    assert.strictEqual(res.isValid, false);
  });

  test('inferEdgeContract accurately deduces execution mode, latency, and payload type', () => {
    const source = mockGraph.nodes.node_authvm;
    const target = mockGraph.nodes.node_authservice;

    const contract = inferEdgeContract(source, target, 'port_auth_login');
    assert.strictEqual(contract.edgeKind, 'call');
    assert.strictEqual(contract.executionMode, 'async');
    assert.strictEqual(contract.contract.payloadType, '(Credentials) -> Session');
    assert.strictEqual(contract.perfMeta.isCriticalPath, true);
    assert.strictEqual(contract.perfMeta.averageLatencyMs, 380);
  });
});
