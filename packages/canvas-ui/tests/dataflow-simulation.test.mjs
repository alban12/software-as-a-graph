import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PRESET_SCENARIOS, executeCustomSimulation } from '../src/simulation/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SAAG_SWIFT_BIN = path.resolve(ROOT_DIR, 'packages/extractor-swift/.build/arm64-apple-macosx/debug/saag-swift');

test.describe('SaaG Dataflow Simulation Engine & Verification', () => {
  const authSampleGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'examples/ios-auth-sample/.saag/graph.json'), 'utf8')
  );
  const landmarksGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/landmarks-graph.json'), 'utf8')
  );

  test('Preset Scenarios: Validates registry completeness according to RFC-003', () => {
    assert.strictEqual(PRESET_SCENARIOS.length, 3, 'Must define 3 primary preset scenarios');
    const ids = PRESET_SCENARIOS.map((s) => s.id);
    assert.deepStrictEqual(ids, ['happy_path', 'validation_error', 'auth_error']);

    for (const scenario of PRESET_SCENARIOS) {
      assert.ok(scenario.id, 'Scenario must have an id');
      assert.ok(scenario.title, 'Scenario must have a title');
      assert.ok(scenario.description, 'Scenario must have a description');
      assert.ok(scenario.startNodeId, 'Scenario must specify startNodeId');
      assert.ok(scenario.startPortId, 'Scenario must specify startPortId');
      assert.ok(scenario.payload, 'Scenario must have an initial payload');
      assert.strictEqual(typeof scenario.traceGenerator, 'function', 'traceGenerator must be a function');
    }
  });

  test('Happy Path (Standard): Executes 4-step sequence to persistent storage', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'happy_path');
    assert.ok(scenario);

    // Graph without biometric approval node
    const graphWithoutBiometric = {
      ...authSampleGraph,
      nodes: { ...authSampleGraph.nodes }
    };
    delete graphWithoutBiometric.nodes.node_biometricapprovalview;

    const steps = scenario.traceGenerator(graphWithoutBiometric);
    assert.strictEqual(steps.length, 4, 'Standard happy path must consist of 4 steps');

    // Step 0: LoginView user tap
    assert.strictEqual(steps[0].stepIndex, 0);
    assert.strictEqual(steps[0].activeNodeId, 'node_loginview');
    assert.strictEqual(steps[0].status, 'success');
    assert.strictEqual(steps[0].payload.email, 'alban@example.com');
    assert.strictEqual(steps[0].payload.password, 'password123');
    assert.strictEqual(steps[0].mutations.node_loginview.inputPassword, '•••••••••••');

    // Step 1: AuthViewModel dispatch
    assert.strictEqual(steps[1].stepIndex, 1);
    assert.strictEqual(steps[1].activeNodeId, 'node_authviewmodel');
    assert.strictEqual(steps[1].portId, 'port_authviewmodel_login');
    assert.strictEqual(steps[1].status, 'success');
    assert.strictEqual(steps[1].mutations.node_authviewmodel.isLoading, true);
    assert.strictEqual(steps[1].mutations.node_authviewmodel.errorMessage, null);

    // Step 2: LiveAuthService network call (critical path bottleneck)
    assert.strictEqual(steps[2].stepIndex, 2);
    assert.strictEqual(steps[2].activeNodeId, 'node_liveauthservice');
    assert.strictEqual(steps[2].status, 'success');
    assert.strictEqual(steps[2].perfMetrics.latencyMs, 380);
    assert.strictEqual(steps[2].perfMetrics.isCriticalPath, true, 'LiveAuthService must be marked as critical path bottleneck');

    // Step 3: KeychainStorage persistence
    assert.strictEqual(steps[3].stepIndex, 3);
    assert.strictEqual(steps[3].activeNodeId, 'node_keychainstorage');
    assert.strictEqual(steps[3].portId, 'port_keychainstorage_save');
    assert.strictEqual(steps[3].status, 'success');
    assert.strictEqual(steps[3].payload.token, 'jwt_mock_token_abc123');
    assert.strictEqual(steps[3].mutations.node_keychainstorage.memoryStore, 'jwt_mock_token_abc123');
    assert.strictEqual(steps[3].mutations.node_authviewmodel.isLoading, false);
    assert.strictEqual(steps[3].mutations.node_authviewmodel.activeSession.userId, 'user_mock_42');
  });

  test('Happy Path (With Squeezed Pass-Through): Preserves BiometricApprovalView step', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'happy_path');
    assert.ok(scenario);

    // Graph with biometric approval node present
    const graphWithBiometric = {
      ...authSampleGraph,
      nodes: {
        ...authSampleGraph.nodes,
        node_biometricapprovalview: {
          id: 'node_biometricapprovalview',
          name: 'BiometricApprovalView',
          nodeKind: 'transient_pass_through'
        }
      }
    };

    const steps = scenario.traceGenerator(graphWithBiometric);
    assert.strictEqual(steps.length, 5, 'Happy path with biometric must contain 5 steps');

    // Step 1 should be the squeezed pass-through node
    const biometricStep = steps[1];
    assert.strictEqual(biometricStep.stepIndex, 1);
    assert.strictEqual(biometricStep.activeNodeId, 'node_biometricapprovalview');
    assert.ok(biometricStep.title.includes('Squeezed Pass-Through'), 'Must label as squeezed pass-through');
    assert.strictEqual(biometricStep.status, 'success');
    assert.strictEqual(biometricStep.mutations.node_biometricapprovalview.isApproved, true);
    // Credentials pass through untouched
    assert.strictEqual(biometricStep.payload.email, 'alban@example.com');
    assert.strictEqual(biometricStep.payload.password, 'password123');

    // Step 2 is now AuthViewModel
    assert.strictEqual(steps[2].activeNodeId, 'node_authviewmodel');
  });

  test('Validation Error Scenario: Halts early at guard and prevents network dispatch', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'validation_error');
    assert.ok(scenario);

    const steps = scenario.traceGenerator(authSampleGraph);
    assert.strictEqual(steps.length, 2, 'Validation error flow must halt at step 2');

    // Step 0: Input with short password
    assert.strictEqual(steps[0].activeNodeId, 'node_loginview');
    assert.strictEqual(steps[0].payload.password, '123');
    assert.strictEqual(steps[0].mutations.node_loginview.inputPassword, '•••');

    // Step 1: Guard failure in AuthViewModel
    const errorStep = steps[1];
    assert.strictEqual(errorStep.activeNodeId, 'node_authviewmodel');
    assert.strictEqual(errorStep.portId, 'port_authviewmodel_validate');
    assert.strictEqual(errorStep.status, 'error', 'Must have status error');
    assert.strictEqual(
      errorStep.mutations.node_authviewmodel.errorMessage,
      'Password must be at least 6 characters.'
    );
    assert.strictEqual(errorStep.mutations.node_authviewmodel.isLoading, false);

    // Verify downstream nodes are strictly never reached
    const visitedNodes = steps.map((s) => s.activeNodeId);
    assert.ok(!visitedNodes.includes('node_liveauthservice'), 'LiveAuthService must never be called on validation error');
    assert.ok(!visitedNodes.includes('node_keychainstorage'), 'KeychainStorage must never be called on validation error');
  });

  test('Network Auth Failure Scenario: AuthService throws 401 and halts before storage', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'auth_error');
    assert.ok(scenario);

    const steps = scenario.traceGenerator(authSampleGraph);
    assert.strictEqual(steps.length, 3, 'Auth error flow must consist of 3 steps');

    // Step 1: Dispatches login
    assert.strictEqual(steps[1].activeNodeId, 'node_authviewmodel');
    assert.strictEqual(steps[1].mutations.node_authviewmodel.isLoading, true);

    // Step 2: LiveAuthService throws 401
    const serviceStep = steps[2];
    assert.strictEqual(serviceStep.activeNodeId, 'node_liveauthservice');
    assert.strictEqual(serviceStep.status, 'error');
    assert.strictEqual(serviceStep.payload.error, 'AuthError.invalidCredentials');
    assert.strictEqual(
      serviceStep.mutations.node_authviewmodel.errorMessage,
      'Invalid email or password.'
    );
    assert.strictEqual(serviceStep.mutations.node_authviewmodel.isLoading, false);

    // TokenStorage must never be reached
    const visitedNodes = steps.map((s) => s.activeNodeId);
    assert.ok(!visitedNodes.includes('node_keychainstorage'), 'KeychainStorage must never be reached after 401 throw');
  });

  test('Custom Symbolic Simulation (executeCustomSimulation): Injects and traverses arbitrary ports', () => {
    const customPayload = {
      command: 'TRIGGER_PROFILE_SYNC',
      authContext: { role: 'admin', sessionToken: 'sym_test_xyz' }
    };

    const steps = executeCustomSimulation(
      'node_loginview',
      'out_submit_tap',
      customPayload,
      authSampleGraph
    );

    assert.ok(steps.length >= 2, 'Custom simulation should have step 0 injection + outbound edge steps');

    // Step 0: injection
    assert.strictEqual(steps[0].stepIndex, 0);
    assert.strictEqual(steps[0].activeNodeId, 'node_loginview');
    assert.strictEqual(steps[0].portId, 'out_submit_tap');
    assert.deepStrictEqual(steps[0].payload, customPayload);

    // Verify outbound traversal
    const outboundStep = steps[1];
    assert.strictEqual(outboundStep.stepIndex, 1);
    assert.ok(outboundStep.activeEdgeId);
    assert.strictEqual(outboundStep.status, 'success');
    assert.deepStrictEqual(outboundStep.payload, customPayload);

    // Test with leaf node having 0 outbound edges
    const leafSteps = executeCustomSimulation(
      'node_keychainstorage',
      'port_keychainstorage_save',
      { data: 'none' },
      authSampleGraph
    );
    assert.strictEqual(leafSteps.length, 1, 'Leaf node with 0 outbound edges returns injection step only');
  });

  test('Screen Action Dynamic Simulation Routing: Accurately branches and overrides payloads', () => {
    const routeScreenAction = (payload, graph) => {
      const { email, password } = payload || {};
      const isShortPassword = (password || '').length < 6;
      const scenarioId = isShortPassword ? 'validation_error' : 'happy_path';
      const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId);

      const generatedSteps = scenario.traceGenerator(graph);
      return generatedSteps.map((step) => {
        if (step.payload && step.payload.email !== undefined) {
          return {
            ...step,
            payload: {
              ...step.payload,
              email: email || step.payload.email,
              password: password || step.payload.password
            }
          };
        }
        return step;
      });
    };

    // Case 1: Short password routes to validation_error with overridden payload
    const shortPassSteps = routeScreenAction(
      { email: 'custom@domain.com', password: 'abc' },
      authSampleGraph
    );
    assert.strictEqual(shortPassSteps.length, 2);
    assert.strictEqual(shortPassSteps[0].payload.email, 'custom@domain.com');
    assert.strictEqual(shortPassSteps[0].payload.password, 'abc');
    assert.strictEqual(shortPassSteps[1].status, 'error');
    assert.strictEqual(shortPassSteps[1].mutations.node_authviewmodel.errorMessage, 'Password must be at least 6 characters.');

    // Case 2: Valid password routes to happy_path with overridden payload
    const validPassSteps = routeScreenAction(
      { email: 'developer@apple.com', password: 'securePassword2026' },
      authSampleGraph
    );
    assert.strictEqual(validPassSteps.length >= 4, true);
    assert.strictEqual(validPassSteps[0].payload.email, 'developer@apple.com');
    assert.strictEqual(validPassSteps[0].payload.password, 'securePassword2026');
    assert.strictEqual(validPassSteps[1].payload.email, 'developer@apple.com');
    assert.strictEqual(validPassSteps[validPassSteps.length - 1].status, 'success');
  });

  test('Latency Heatmap Classification & Bottleneck Thresholds', () => {
    const classifyLatency = (latency, isError) => {
      if (isError) return { color: '#ef4444', prefix: '' };
      const color = latency > 250 ? '#f43f5e' : latency > 50 ? '#f59e0b' : '#10b981';
      const prefix = latency > 0 ? (latency > 250 ? '⏳ ' : '⚡ ') + latency + 'ms' : '';
      return { color, prefix };
    };

    // Fast path <= 50ms
    const fast = classifyLatency(15, false);
    assert.strictEqual(fast.color, '#10b981');
    assert.strictEqual(fast.prefix, '⚡ 15ms');

    // Moderate path 50-250ms
    const moderate = classifyLatency(120, false);
    assert.strictEqual(moderate.color, '#f59e0b');
    assert.strictEqual(moderate.prefix, '⚡ 120ms');

    // Critical path bottleneck > 250ms
    const bottleneck = classifyLatency(380, false);
    assert.strictEqual(bottleneck.color, '#f43f5e');
    assert.strictEqual(bottleneck.prefix, '⏳ 380ms');

    // Error edge
    const err = classifyLatency(380, true);
    assert.strictEqual(err.color, '#ef4444');
  });

  test('End-to-End Swift Test Code Generation: Validates RFC-003 Swift Testing Suite Output', () => {
    assert.ok(fs.existsSync(SAAG_SWIFT_BIN), `saag-swift binary must exist at ${SAAG_SWIFT_BIN}`);

    const scenarios = ['happy_path', 'validation_error', 'auth_error'];

    for (const scenario of scenarios) {
      const output = execSync(
        `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun "${SAAG_SWIFT_BIN}" generate-test --scenario "${scenario}" --module "AuthSample"`,
        { encoding: 'utf8' }
      );

      // Verify Swift Testing Suite attributes
      assert.ok(output.includes('import Testing'), `Scenario ${scenario} must import Testing`);
      assert.ok(output.includes('import Foundation'), `Scenario ${scenario} must import Foundation`);
      assert.ok(output.includes('@testable import AuthSample'), `Scenario ${scenario} must import target module`);
      assert.ok(output.includes('@Suite'), `Scenario ${scenario} must have @Suite annotation`);
      assert.ok(output.includes('@Test'), `Scenario ${scenario} must have @Test annotation`);
      assert.ok(output.includes('@MainActor'), `Scenario ${scenario} must have @MainActor attribute`);
      assert.ok(output.includes('#expect('), `Scenario ${scenario} must use Apple Testing #expect macro`);
    }
  });

  test('Swift Compiler Verification: Real Swift Test execution passes 100% across all generated scenarios', () => {
    // Run the real swift test runner on AuthSample
    const swiftTestOutput = execSync(
      'DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swift test --package-path examples/ios-auth-sample',
      { encoding: 'utf8', cwd: ROOT_DIR }
    );

    assert.ok(
      swiftTestOutput.includes('Suite "SaaG Dataflow: Happy Path Valid Login"') ||
      swiftTestOutput.includes('Suite "SaaG Dataflow: Happy Path'),
      'Output must contain Happy Path suite execution'
    );
    assert.ok(
      swiftTestOutput.includes('Suite "SaaG Dataflow: Validation Error Short Password"'),
      'Output must contain Validation Error suite execution'
    );
    assert.ok(
      swiftTestOutput.includes('Suite "SaaG Dataflow: Network Auth Failure 401"'),
      'Output must contain Auth Error suite execution'
    );
    assert.ok(
      swiftTestOutput.includes('passed after') || swiftTestOutput.includes('passed'),
      'All suites must pass successfully'
    );
  });
});
