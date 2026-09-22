process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { app } from '../server.js';

test.describe('Bidirectional API E2E & Edge Case Suite', () => {
  let server;
  let baseUrl;
  let sandboxDir;

  test.before(async () => {
    // Start test server on ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  test.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-api-test-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  // Helper for making JSON HTTP requests
  async function apiRequest(endpoint, body, method = 'POST') {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  // =========================================================================
  // 1. POST /api/update-view-element Edge Cases
  // =========================================================================
  test.describe('POST /api/update-view-element', () => {
    test('Edge Case 1: Reconciles label accurately within exact lineSpan', async () => {
      const swiftFile = path.join(sandboxDir, 'DetailView.swift');
      const swiftCode = [
        'import SwiftUI',
        '',
        'public struct DetailView: View {',
        '    public var body: some View {',
        '        VStack {',
        '            Text("Header")',
        '            Button("Confirm Order") {',
        '                // action',
        '            }',
        '        }',
        '    }',
        '}'
      ].join('\n');
      fs.writeFileSync(swiftFile, swiftCode, 'utf8');

      const response = await apiRequest('/api/update-view-element', {
        filePath: swiftFile,
        elementId: 'btn_confirm',
        oldLabel: 'Confirm Order',
        newLabel: 'Place Order Now',
        lineSpan: { startLine: 6, endLine: 10 }
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.newLabel, 'Place Order Now');

      const updatedCode = fs.readFileSync(swiftFile, 'utf8');
      assert.ok(updatedCode.includes('Button("Place Order Now")'));
      assert.ok(!updatedCode.includes('Button("Confirm Order")'));
    });

    test('Edge Case 2: Disambiguates identical labels using lineSpan targeting', async () => {
      const swiftFile = path.join(sandboxDir, 'FormView.swift');
      const swiftCode = [
        'import SwiftUI',
        '',
        'public struct FormView: View {',
        '    public var body: some View {',
        '        VStack {',
        '            Button("Submit") { step1() }', // line 6
        '            Spacer()',
        '            Button("Submit") { finalStep() }', // line 8
        '        }',
        '    }',
        '}'
      ].join('\n');
      fs.writeFileSync(swiftFile, swiftCode, 'utf8');

      // Target ONLY the second button at lines 7-9
      const response = await apiRequest('/api/update-view-element', {
        filePath: swiftFile,
        elementId: 'btn_final',
        oldLabel: 'Submit',
        newLabel: 'Finalize All',
        lineSpan: { startLine: 7, endLine: 9 }
      });

      assert.strictEqual(response.status, 200);
      const lines = fs.readFileSync(swiftFile, 'utf8').split('\n');
      assert.strictEqual(lines[5], '            Button("Submit") { step1() }', 'First button unchanged');
      assert.strictEqual(lines[7], '            Button("Finalize All") { finalStep() }', 'Second button renamed');
    });

    test('Edge Case 3: Handles emojis, unicode, and symbols in labels', async () => {
      const swiftFile = path.join(sandboxDir, 'HeroView.swift');
      const swiftCode = 'struct HeroView: View { var body: some View { Button("✨ Start Journey 🚀") {} } }';
      fs.writeFileSync(swiftFile, swiftCode, 'utf8');

      const response = await apiRequest('/api/update-view-element', {
        filePath: swiftFile,
        elementId: 'btn_hero',
        oldLabel: '✨ Start Journey 🚀',
        newLabel: '🌟 Explore Universe 🪐',
        lineSpan: { startLine: 1, endLine: 1 }
      });

      assert.strictEqual(response.status, 200);
      const updatedCode = fs.readFileSync(swiftFile, 'utf8');
      assert.ok(updatedCode.includes('"🌟 Explore Universe 🪐"'));
    });

    test('Edge Case 4: Rejects with 404 when target file does not exist', async () => {
      const response = await apiRequest('/api/update-view-element', {
        filePath: path.join(sandboxDir, 'NonExistentView.swift'),
        elementId: 'btn_none',
        oldLabel: 'Old',
        newLabel: 'New'
      });

      assert.strictEqual(response.status, 404);
      assert.ok(response.data.error.includes('Source file not found'));
    });

    test('Edge Case 5: Rejects with 400 when old label is not found in file', async () => {
      const swiftFile = path.join(sandboxDir, 'SimpleView.swift');
      fs.writeFileSync(swiftFile, 'struct SimpleView: View { var body: some View { Text("Hello") } }', 'utf8');

      const response = await apiRequest('/api/update-view-element', {
        filePath: swiftFile,
        elementId: 'btn_missing',
        oldLabel: 'Does Not Exist',
        newLabel: 'New'
      });

      assert.strictEqual(response.status, 400);
      assert.ok(response.data.error.includes('Could not find'));
    });

    test('Edge Case 6: Validates missing required payload parameters with 400', async () => {
      const responseNoFile = await apiRequest('/api/update-view-element', { newLabel: 'New' });
      assert.strictEqual(responseNoFile.status, 400);

      const responseNoLabel = await apiRequest('/api/update-view-element', { filePath: 'Some.swift' });
      assert.strictEqual(responseNoLabel.status, 400);
    });
  });

  // =========================================================================
  // 2. POST /api/apply-refactor Edge Cases
  // =========================================================================
  test.describe('POST /api/apply-refactor', () => {
    test('Edge Case 7: Creates files in non-existent nested directories', async () => {
      const plan = {
        id: 'plan_nested_create',
        baseDir: sandboxDir,
        swiftChanges: [
          {
            filePath: 'Sources/Features/Authentication/Repositories/AuthRepository.swift',
            action: 'create',
            code: 'public final class AuthRepository { public init() {} }'
          }
        ],
        architecturalChanges: {
          newNodes: [
            { id: 'node_auth_repo', name: 'AuthRepository', kind: 'repository' }
          ]
        }
      };

      const response = await apiRequest('/api/apply-refactor', { plan });
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
      assert.strictEqual(response.data.writtenFiles.length, 1);

      const createdFile = path.join(sandboxDir, 'Sources/Features/Authentication/Repositories/AuthRepository.swift');
      assert.ok(fs.existsSync(createdFile), 'Nested file created on disk');
      assert.ok(fs.readFileSync(createdFile, 'utf8').includes('AuthRepository'));
    });

    test('Edge Case 8: Modifies existing file and supports action: delete', async () => {
      const deprecatedFile = path.join(sandboxDir, 'OldService.swift');
      const activeFile = path.join(sandboxDir, 'AppCoordinator.swift');
      fs.writeFileSync(deprecatedFile, '// deprecated logic', 'utf8');
      fs.writeFileSync(activeFile, '// v1 logic', 'utf8');

      const plan = {
        id: 'plan_mod_and_delete',
        baseDir: sandboxDir,
        swiftChanges: [
          {
            filePath: activeFile,
            action: 'modify',
            code: '// v2 refactored logic'
          },
          {
            filePath: deprecatedFile,
            action: 'delete'
          }
        ]
      };

      const response = await apiRequest('/api/apply-refactor', { plan });
      assert.strictEqual(response.status, 200);

      assert.strictEqual(fs.existsSync(deprecatedFile), false, 'Deprecated file was unlinked');
      assert.strictEqual(fs.readFileSync(activeFile, 'utf8'), '// v2 refactored logic', 'Active file was modified');
    });

    test('Edge Case 9: Rejects malformed refactoring plans with 400', async () => {
      const response = await apiRequest('/api/apply-refactor', {});
      assert.strictEqual(response.status, 400);
      assert.ok(response.data.error.includes('Missing refactoring plan'));
    });
  });

  // =========================================================================
  // 3. POST /api/graph Edge Cases
  // =========================================================================
  test.describe('POST /api/graph', () => {
    test('Edge Case 10: Saves graph and handles empty or minimal nodes cleanly', async () => {
      const sandboxGraphPath = path.join(sandboxDir, 'test-graph.json');
      const testGraph = {
        targetPath: sandboxGraphPath,
        metadata: { schemaVersion: '1.0.0', projectName: 'E2ETest' },
        nodes: {},
        edges: {}
      };

      const response = await apiRequest('/api/graph', testGraph);
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
      assert.ok(response.data.timestamp);
      assert.ok(fs.existsSync(sandboxGraphPath), 'Graph file was written to sandbox');
    });
  });

  // =========================================================================
  // 4. POST /api/save-test & Dynamic Project Target Paths
  // =========================================================================
  test.describe('POST /api/save-test', () => {
    test('Edge Case 11: Saves generated Swift test to custom target path in sandbox', async () => {
      const targetPath = path.join(sandboxDir, 'GeneratedLandmarksDataflowTests.swift');
      const testCode = `// Generated Landmarks Test\nimport Testing\n@testable import Landmarks\n\n@Suite struct LandmarksDataflowTests {}\n`;

      const response = await apiRequest('/api/save-test', {
        code: testCode,
        targetPath
      });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.success, true);
      assert.ok(fs.existsSync(targetPath));
      assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), testCode);
    });

    test('Edge Case 12: Rejects save-test with 400 when test code is missing', async () => {
      const response = await apiRequest('/api/save-test', {});
      assert.strictEqual(response.status, 400);
      assert.ok(response.data.error.includes('Missing test code'));
    });
  });

  // =========================================================================
  // 5. Multi-Project Simulation Engine Scenario Mapping
  // =========================================================================
  test.describe('Multi-Project Simulation Scenarios', () => {
    test('Edge Case 13: Maps Landmarks and MakeItSo graphs to tailored scenarios', async () => {
      const { getScenariosForGraph } = await import('../src/simulation/engine.js');

      // 1. Landmarks Graph
      const landmarksGraph = { metadata: { projectName: 'Landmarks' }, nodes: { node_landmarksapp: {} } };
      const landmarkScenarios = getScenariosForGraph(landmarksGraph);
      assert.ok(landmarkScenarios.length >= 3);
      assert.ok(landmarkScenarios.some((s) => s.id === 'landmarks_favorite_toggle'));
      assert.ok(landmarkScenarios.some((s) => s.id === 'landmarks_profile_edit'));

      // 2. MakeItSo Graph
      const makeItSoGraph = { metadata: { projectName: 'MakeItSo' }, nodes: { node_makeitsoapp: {} } };
      const makeItSoScenarios = getScenariosForGraph(makeItSoGraph);
      assert.ok(makeItSoScenarios.length >= 1);
      assert.ok(makeItSoScenarios.some((s) => s.id === 'makeitso_create_reminder'));

      // 3. Fallback AuthSample Graph
      const defaultGraph = { metadata: { projectName: 'AuthSample' }, nodes: {} };
      const defaultScenarios = getScenariosForGraph(defaultGraph);
      assert.strictEqual(defaultScenarios.length, 3);
      assert.ok(defaultScenarios.some((s) => s.id === 'happy_path'));
    });
  });
});
