import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScopeContract } from '../src/utils/scopeContract.js';

test.describe('Interactive Visual Agent Scope & Bounded Contexts Suite', () => {
  const mockGraph = {
    nodes: {
      node_loginview: {
        id: 'node_loginview',
        name: 'LoginView',
        kind: 'view',
        sourceAnchor: { filePath: 'Sources/Views/LoginView.swift' },
        inputs: [{ id: 'port_login_body', name: 'body', typeAnnotation: 'some View' }],
        outputs: [{ id: 'port_login_submit', name: 'onSubmit', typeAnnotation: 'Credentials' }]
      },
      node_authviewmodel: {
        id: 'node_authviewmodel',
        name: 'AuthViewModel',
        kind: 'viewModel',
        sourceAnchor: { filePath: 'Sources/ViewModels/AuthViewModel.swift' },
        inputs: [
          { id: 'port_vm_authenticate', name: 'authenticate', typeAnnotation: '(Credentials) -> Void' }
        ],
        outputs: [
          { id: 'port_vm_state', name: 'authState', typeAnnotation: 'AuthState' },
          { id: 'port_vm_tokenservice', name: 'tokenRequest', typeAnnotation: 'TokenRequest' }
        ]
      },
      node_authservice: {
        id: 'node_authservice',
        name: 'LiveAuthService',
        kind: 'service',
        sourceAnchor: { filePath: 'Sources/Services/LiveAuthService.swift' },
        inputs: [
          { id: 'port_srv_request', name: 'executeAuth', typeAnnotation: '(Credentials) async -> Session' }
        ],
        outputs: [
          { id: 'port_srv_result', name: 'sessionResult', typeAnnotation: 'Session' }
        ]
      },
      node_keychainstorage: {
        id: 'node_keychainstorage',
        name: 'KeychainStorage',
        kind: 'repository',
        sourceAnchor: { filePath: 'Sources/Storage/KeychainStorage.swift' },
        inputs: [
          { id: 'port_storage_save', name: 'saveToken', typeAnnotation: '(String) -> Bool' }
        ],
        outputs: []
      }
    },
    edges: {
      edge_1: {
        id: 'edge_1',
        sourceNodeId: 'node_loginview',
        sourcePortId: 'port_login_submit',
        targetNodeId: 'node_authviewmodel',
        targetPortId: 'port_vm_authenticate',
        edgeType: 'eventEmit'
      },
      edge_2: {
        id: 'edge_2',
        sourceNodeId: 'node_authviewmodel',
        sourcePortId: 'port_vm_state',
        targetNodeId: 'node_loginview',
        targetPortId: 'port_login_body',
        edgeType: 'stateBinding'
      },
      edge_3: {
        id: 'edge_3',
        sourceNodeId: 'node_authviewmodel',
        sourcePortId: 'port_vm_tokenservice',
        targetNodeId: 'node_authservice',
        targetPortId: 'port_srv_request',
        edgeType: 'call'
      },
      edge_4: {
        id: 'edge_4',
        sourceNodeId: 'node_authservice',
        sourcePortId: 'port_srv_result',
        targetNodeId: 'node_keychainstorage',
        targetPortId: 'port_storage_save',
        edgeType: 'call'
      }
    }
  };

  test('generateScopeContract freezes boundary interfaces and separates inbound vs outbound ports', () => {
    // Lock AuthViewModel and LiveAuthService into an Agent Scope
    const scope = generateScopeContract(
      ['node_authviewmodel', 'node_authservice'],
      mockGraph,
      'Authentication Core Scope'
    );

    assert.ok(scope);
    assert.strictEqual(scope.name, 'Authentication Core Scope');
    assert.strictEqual(scope.lockedNodeIds.length, 2);

    // Authorized files must match scoped nodes
    assert.strictEqual(scope.allowedFilePaths.length, 2);
    assert.ok(scope.allowedFilePaths.includes('Sources/ViewModels/AuthViewModel.swift'));
    assert.ok(scope.allowedFilePaths.includes('Sources/Services/LiveAuthService.swift'));

    // Forbidden files must include other components
    assert.ok(scope.forbiddenFilePaths.includes('Sources/Views/LoginView.swift'));
    assert.ok(scope.forbiddenFilePaths.includes('Sources/Storage/KeychainStorage.swift'));

    // Inbound Boundary: LoginView -> AuthViewModel.authenticate
    assert.ok(scope.inboundBoundaryPorts.length >= 1);
    const inbound = scope.inboundBoundaryPorts.find((p) => p.portName === 'authenticate');
    assert.ok(inbound);
    assert.strictEqual(inbound.nodeName, 'AuthViewModel');
    assert.strictEqual(inbound.connectedToNodeName, 'LoginView');

    // Outbound Boundary: LiveAuthService.sessionResult -> KeychainStorage
    assert.ok(scope.outboundBoundaryPorts.length >= 1);
    const outbound = scope.outboundBoundaryPorts.find((p) => p.portName === 'sessionResult');
    assert.ok(outbound);
    assert.strictEqual(outbound.nodeName, 'LiveAuthService');
    assert.strictEqual(outbound.connectedToNodeName, 'KeychainStorage');
  });

  test('generateScopeContract calculates External Downstream Blast Radius accurately', () => {
    const scope = generateScopeContract(
      ['node_authviewmodel', 'node_authservice'],
      mockGraph,
      'Auth Scope'
    );

    assert.ok(scope.externalBlastRadius);
    // External nodes affected by AuthViewModel & LiveAuthService: LoginView (via stateBinding) & KeychainStorage (via call)
    assert.strictEqual(scope.externalBlastRadius.count, 2);
    const impactedIds = scope.externalBlastRadius.impactedNodes.map((n) => n.id);
    assert.ok(impactedIds.includes('node_loginview'));
    assert.ok(impactedIds.includes('node_keychainstorage'));
  });

  test('generateScopeContract embeds task objective and architectural rules into agentPrompt', () => {
    const taskObjective = 'Implement biometric authentication fallback with Keychain caching';
    const scope = generateScopeContract(
      ['node_authviewmodel'],
      mockGraph,
      'AuthViewModel Scope',
      { taskObjective }
    );

    assert.strictEqual(scope.taskObjective, taskObjective);
    assert.ok(scope.agentPrompt.includes('🎯 Task Objective & Scope Boundary'));
    assert.ok(scope.agentPrompt.includes('Implement biometric authentication fallback with Keychain caching'));
    assert.ok(scope.agentPrompt.includes('IMMUTABLE INTERFACES'));
    assert.ok(scope.agentPrompt.includes('Sources/ViewModels/AuthViewModel.swift'));
  });

  test('Boundary Edge Crossing Logic detects cross-perimeter edges', () => {
    const scopedNodeIds = ['node_authviewmodel', 'node_authservice'];

    const checkEdgeBoundary = (src, tgt) => {
      const srcIn = scopedNodeIds.includes(src);
      const tgtIn = scopedNodeIds.includes(tgt);
      return srcIn !== tgtIn;
    };

    // Edge from LoginView (outside) -> AuthViewModel (inside): Boundary
    assert.strictEqual(checkEdgeBoundary('node_loginview', 'node_authviewmodel'), true);

    // Edge from AuthViewModel (inside) -> LiveAuthService (inside): Internal, NOT boundary
    assert.strictEqual(checkEdgeBoundary('node_authviewmodel', 'node_authservice'), false);

    // Edge from LiveAuthService (inside) -> KeychainStorage (outside): Boundary
    assert.strictEqual(checkEdgeBoundary('node_authservice', 'node_keychainstorage'), true);
  });
});
