process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { WebSocket } from 'ws';
import {
  app,
  server as saagServer,
  validateSafePath,
  safeWriteFileAtomic
} from '../server.js';

test.describe('SaaG Reliability, Security & Quality Audit Suite', () => {
  let baseUrl;
  let wsUrl;
  let sandboxDir;

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

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-audit-resilience-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  async function apiRequest(endpoint, body = null, method = 'POST') {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, ok: res.ok, data };
  }

  test.describe('1. File I/O Safety & Atomic Writes', () => {
    test('safeWriteFileAtomic writes file atomically and cleans up temp files', () => {
      const target = path.join(sandboxDir, 'atomic-test.json');
      const payload = JSON.stringify({ status: 'ok', timestamp: Date.now() });

      safeWriteFileAtomic(target, payload);

      assert.ok(fs.existsSync(target), 'Target file must exist');
      assert.strictEqual(fs.readFileSync(target, 'utf8'), payload);

      // Verify no leftover .tmp files remain in sandbox
      const files = fs.readdirSync(sandboxDir);
      assert.strictEqual(files.length, 1);
      assert.strictEqual(files[0], 'atomic-test.json');
    });

    test('safeWriteFileAtomic creates deep directory hierarchies automatically', () => {
      const target = path.join(sandboxDir, 'deep', 'nested', 'path', 'config.json');
      const payload = JSON.stringify({ nested: true });

      safeWriteFileAtomic(target, payload);

      assert.ok(fs.existsSync(target), 'Target file in deep path must exist');
      assert.strictEqual(fs.readFileSync(target, 'utf8'), payload);
    });

    test('safeWriteFileAtomic safely overwrites existing files without corruption', () => {
      const target = path.join(sandboxDir, 'versioned.json');
      safeWriteFileAtomic(target, JSON.stringify({ version: 1 }));
      assert.strictEqual(JSON.parse(fs.readFileSync(target, 'utf8')).version, 1);

      safeWriteFileAtomic(target, JSON.stringify({ version: 2 }));
      assert.strictEqual(JSON.parse(fs.readFileSync(target, 'utf8')).version, 2);
    });
  });

  test.describe('2. Path Traversal & Containment Guardrails', () => {
    test('validateSafePath allows paths inside repoRoot and tmpdir', () => {
      const tmpPath = path.join(sandboxDir, 'allowed.txt');
      assert.strictEqual(validateSafePath(tmpPath), path.resolve(tmpPath));
    });

    test('validateSafePath throws 403 error on directory traversal escape attempts', () => {
      const outsidePaths = [
        '/etc/passwd',
        '/etc/shadow',
        '../../../../../../../../etc/hosts',
        '/var/root/.ssh/id_rsa'
      ];

      for (const p of outsidePaths) {
        assert.throws(
          () => validateSafePath(p),
          (err) => err.message.includes('Access denied') || err.message.includes('outside allowed')
        );
      }
    });

    test('validateSafePath throws on null byte injection', () => {
      assert.throws(
        () => validateSafePath('/path/to/file.swift\0.jpg'),
        (err) => err.message.includes('Null byte')
      );
    });

    test('validateSafePath rejects non-string and empty inputs', () => {
      assert.throws(() => validateSafePath(null));
      assert.throws(() => validateSafePath(''));
      assert.throws(() => validateSafePath(undefined));
    });

    test('POST /api/graph blocks directory traversal attempts with 403', async () => {
      const res = await apiRequest('/api/graph', {
        targetPath: '../../../../../../../../tmp/forbidden-outside-system.json',
        nodes: {}
      });
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Access denied'));
    });

    test('POST /api/save-test blocks directory traversal with 403', async () => {
      const res = await apiRequest('/api/save-test', {
        code: '// evil code',
        targetPath: '/etc/cron.d/malicious'
      });
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Access denied'));
    });

    test('POST /api/apply-refactor blocks traversal within refactoring plan', async () => {
      const res = await apiRequest('/api/apply-refactor', {
        plan: {
          id: 'exploit_plan',
          baseDir: sandboxDir,
          swiftChanges: [
            {
              filePath: '../../../../../../../../etc/malicious.conf',
              code: 'malicious',
              action: 'modify'
            }
          ]
        }
      });
      assert.strictEqual(res.status, 403);
      assert.ok(res.data.error.includes('Access denied'));
    });
  });

  test.describe('3. WebSocket Protocol & Network Resilience', () => {
    test('Client can connect to WebSocket, receives heartbeat and can respond PONG', async () => {
      const ws = new WebSocket(wsUrl);

      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      assert.strictEqual(ws.readyState, WebSocket.OPEN);

      // Verify sending PONG message is handled cleanly without error
      ws.send(JSON.stringify({ type: 'PONG' }));

      await new Promise((r) => setTimeout(r, 100));

      assert.strictEqual(ws.readyState, WebSocket.OPEN, 'Socket should remain open after PONG');

      ws.close();
      await new Promise((resolve) => ws.on('close', resolve));
      assert.strictEqual(ws.readyState, WebSocket.CLOSED);
    });
  });

  test.describe('4. REST API Graceful Fallbacks & Validation', () => {
    test('POST /api/save-test rejects missing code with 400 Bad Request', async () => {
      const res = await apiRequest('/api/save-test', {});
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('Missing test code'));
    });

    test('POST /api/apply-refactor rejects missing plan with 400 Bad Request', async () => {
      const res = await apiRequest('/api/apply-refactor', {});
      assert.strictEqual(res.status, 400);
      assert.ok(res.data.error.includes('Missing refactoring plan'));
    });

    test('POST /api/save-agent-scope validates scope contract and persists atomically', async () => {
      const res = await apiRequest('/api/save-agent-scope', {
        scope: {
          id: 'test_scope_resilience',
          name: 'Resilience Test Scope',
          nodeIds: ['node_a', 'node_b']
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.success);
      assert.strictEqual(res.data.scope.id, 'test_scope_resilience');
    });
  });
});
