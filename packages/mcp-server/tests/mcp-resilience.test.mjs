import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '../src/server.js';
import { validateSafePath, safeWriteFileAtomic } from '../src/fsUtils.js';
import { resolveProjectGraph } from '../src/projectResolver.js';

describe('SaaG MCP Server — Hardening, Security & Resilience Suite', () => {
  let sandboxDir;

  beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-mcp-resilience-'));
  });

  afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  describe('1. File I/O Safety & Path Containment', () => {
    it('validateSafePath allows paths inside tmpdir and workspace', () => {
      const allowedFile = path.join(sandboxDir, 'test.swift');
      assert.strictEqual(validateSafePath(allowedFile), path.resolve(allowedFile));
    });

    it('validateSafePath throws on directory traversal attempts', () => {
      const illegalPaths = [
        '/etc/passwd',
        '/var/root/.ssh/id_rsa',
        '../../../../../../../../etc/shadow'
      ];

      for (const p of illegalPaths) {
        assert.throws(
          () => validateSafePath(p),
          (err) => err.message.includes('Access denied') || err.message.includes('outside allowed')
        );
      }
    });

    it('validateSafePath blocks null byte injection', () => {
      assert.throws(
        () => validateSafePath('/app/safe.swift\0.jpg'),
        (err) => err.message.includes('Null byte')
      );
    });

    it('safeWriteFileAtomic writes atomically and cleans up temp files', () => {
      const target = path.join(sandboxDir, 'atomic.json');
      const payload = JSON.stringify({ ok: true, timestamp: Date.now() });

      safeWriteFileAtomic(target, payload);

      assert.ok(fs.existsSync(target));
      assert.strictEqual(fs.readFileSync(target, 'utf8'), payload);

      const files = fs.readdirSync(sandboxDir);
      assert.strictEqual(files.length, 1);
      assert.strictEqual(files[0], 'atomic.json');
    });

    it('safeWriteFileAtomic creates nested parent directories automatically', () => {
      const target = path.join(sandboxDir, 'a', 'b', 'c', 'nested.swift');
      safeWriteFileAtomic(target, '// swift code');
      assert.ok(fs.existsSync(target));
      assert.strictEqual(fs.readFileSync(target, 'utf8'), '// swift code');
    });
  });

  describe('2. MCP Tool Traversal Prevention & Rollback Safety', () => {
    it('apply_architectural_refactor blocks traversal in change filePath with isError: true', async () => {
      const server = new McpServer();
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/call',
        params: {
          name: 'apply_architectural_refactor',
          arguments: {
            project: 'landmarks',
            changes: [
              {
                action: 'modify',
                filePath: '../../../../../../../../etc/malicious.conf',
                content: 'evil'
              }
            ]
          }
        }
      });

      assert.strictEqual(res.id, 101);
      assert.strictEqual(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes('Access denied') || res.result.content[0].text.includes('Refactor failed'));
    });

    it('apply_architectural_refactor rolls back previous changes if a subsequent step fails', async () => {
      const server = new McpServer();
      const testFile1 = path.join(sandboxDir, 'FileOne.swift');
      const originalContent = '// Original FileOne';
      fs.writeFileSync(testFile1, originalContent, 'utf8');

      // Create a mock project graph in sandbox
      const mockGraphPath = path.join(sandboxDir, 'graph.json');
      fs.writeFileSync(mockGraphPath, JSON.stringify({
        schemaVersion: '1.0.0',
        nodes: {},
        edges: {}
      }), 'utf8');

      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'apply_architectural_refactor',
          arguments: {
            project: mockGraphPath,
            changes: [
              {
                action: 'modify',
                filePath: testFile1,
                content: '// Mutated FileOne'
              },
              {
                action: 'modify',
                filePath: path.join(sandboxDir, 'FileTwo.swift'),
                content: null // Missing content will trigger error
              }
            ]
          }
        }
      });

      assert.strictEqual(res.id, 102);
      assert.strictEqual(res.result.isError, true);
      assert.ok(res.result.content[0].text.includes('Refactor failed and was rolled back'));

      // Verify FileOne was rolled back to its original content
      assert.strictEqual(fs.readFileSync(testFile1, 'utf8'), originalContent);
    });

    it('resolveProjectGraph blocks directory traversal for projectRef', () => {
      assert.throws(
        () => resolveProjectGraph('../../../../../../../../etc/passwd'),
        (err) => err.message.includes('Access denied') || err.message.includes('outside allowed')
      );
    });
  });

  describe('3. JSON-RPC 2.0 Error & Protocol Robustness', () => {
    it('returns -32602 when required parameter is missing in tools/call', async () => {
      const server = new McpServer();
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 201,
        method: 'tools/call',
        params: {} // missing "name"
      });

      assert.strictEqual(res.id, 201);
      assert.strictEqual(res.error.code, -32602);
      assert.ok(res.error.message.includes('"name" is required'));
    });

    it('returns -32601 for nonexistent tools', async () => {
      const server = new McpServer();
      const res = await server.handleRequest({
        jsonrpc: '2.0',
        id: 202,
        method: 'tools/call',
        params: {
          name: 'non_existent_tool'
        }
      });

      assert.strictEqual(res.id, 202);
      assert.strictEqual(res.error.code, -32601);
      assert.ok(res.error.message.includes('Unknown tool'));
    });

    it('returns -32600 for non-object requests', async () => {
      const server = new McpServer();
      const res = await server.handleRequest('not an object');
      assert.strictEqual(res.error.code, -32600);
    });
  });
});
