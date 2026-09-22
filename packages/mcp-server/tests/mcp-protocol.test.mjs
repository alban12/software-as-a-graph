import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { McpServer, SERVER_METADATA } from '../src/server.js';

describe('SaaG MCP Server — JSON-RPC 2.0 Protocol & Stdio Lifecycle', () => {

  it('Protocol Handshake: Handles initialize request with correct capabilities and version', async () => {
    const server = new McpServer();
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-agent', version: '1.0.0' }
      }
    };

    const response = await server.handleRequest(initRequest);
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 1);
    assert.ok(response.result);
    assert.equal(response.result.protocolVersion, '2024-11-05');
    assert.equal(response.result.serverInfo.name, SERVER_METADATA.name);
    assert.ok(response.result.capabilities.tools);
    assert.ok(response.result.capabilities.resources);
    assert.ok(response.result.capabilities.prompts);
    assert.equal(server.isInitialized, true);
  });

  it('Notifications: Silently processes notifications/initialized without response', async () => {
    const server = new McpServer();
    const notif = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    const response = await server.handleRequest(notif);
    assert.equal(response, null);
    assert.equal(server.isInitialized, true);
  });

  it('Liveness: Responds to ping request with empty object', async () => {
    const server = new McpServer();
    const pingRequest = {
      jsonrpc: '2.0',
      id: 42,
      method: 'ping'
    };

    const response = await server.handleRequest(pingRequest);
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 42);
    assert.deepEqual(response.result, {});
  });

  it('Error Handling: Returns -32601 for unknown methods', async () => {
    const server = new McpServer();
    const unknownRequest = {
      jsonrpc: '2.0',
      id: 99,
      method: 'unknown/nonexistent_method',
      params: {}
    };

    const response = await server.handleRequest(unknownRequest);
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 99);
    assert.ok(response.error);
    assert.equal(response.error.code, -32601);
    assert.match(response.error.message, /Method not found/);
  });

  it('Error Handling: Returns -32600 for invalid JSON-RPC format', async () => {
    const server = new McpServer();
    const invalidRequest = {
      id: 100,
      method: 'ping'
      // missing jsonrpc: '2.0'
    };

    const response = await server.handleRequest(invalidRequest);
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 100);
    assert.ok(response.error);
    assert.equal(response.error.code, -32600);
  });

  it('Stream Framing: Handles sequential line-delimited messages through stdio stream', async () => {
    const server = new McpServer();
    const input = new PassThrough();
    const output = new PassThrough();

    server.start(input, output);

    const receivedLines = [];
    output.on('data', (chunk) => {
      const lines = chunk.toString().trim().split('\n');
      receivedLines.push(...lines);
    });

    // Send 2 sequential requests in stream
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) + '\n');
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');

    // Give microtask tick to process streams
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(receivedLines.length, 2);
    const res1 = JSON.parse(receivedLines[0]);
    const res2 = JSON.parse(receivedLines[1]);
    assert.equal(res1.id, 1);
    assert.equal(res2.id, 2);
  });

  it('Stream Framing: Handles malformed JSON line with -32700 Parse error', async () => {
    const server = new McpServer();
    const input = new PassThrough();
    const output = new PassThrough();

    server.start(input, output);

    const receivedLines = [];
    output.on('data', (chunk) => {
      receivedLines.push(...chunk.toString().trim().split('\n'));
    });

    input.write('{ not valid json }\n');

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(receivedLines.length, 1);
    const parsed = JSON.parse(receivedLines[0]);
    assert.equal(parsed.error.code, -32700);
    assert.match(parsed.error.message, /Parse error/);
  });
});
