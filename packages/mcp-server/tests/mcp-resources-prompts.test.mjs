import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '../src/server.js';

describe('SaaG MCP Server — Resources & Prompts Registry Suite', () => {

  it('resources/list: Enumerates saag:// project URIs across all 3 domains', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'resources/list'
    });

    assert.equal(res.id, 1);
    const resources = res.result.resources;
    assert.ok(Array.isArray(resources));
    assert.ok(resources.some((r) => r.uri === 'saag://projects'));
    assert.ok(resources.some((r) => r.uri === 'saag://ios/landmarks/graph'));
    assert.ok(resources.some((r) => r.uri === 'saag://agent/agent-orchestrator/graph'));
    assert.ok(resources.some((r) => r.uri === 'saag://ml/ml-pipeline/graph'));
  });

  it('resources/read: Reads saag://projects directory', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/read',
      params: { uri: 'saag://projects' }
    });

    assert.equal(res.id, 2);
    assert.ok(res.result.contents);
    const text = res.result.contents[0].text;
    const parsed = JSON.parse(text);
    assert.ok(parsed.landmarks);
    assert.ok(parsed['agent-orchestrator']);
    assert.ok(parsed['ml-pipeline']);
  });

  it('resources/read: Reads project graph via saag://<domain>/<id>/graph', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/read',
      params: { uri: 'saag://ios/landmarks/graph' }
    });

    assert.equal(res.id, 3);
    const graph = JSON.parse(res.result.contents[0].text);
    assert.ok(graph.nodes);
    assert.ok(graph.edges);
  });

  it('resources/read: Reads individual node via saag://<domain>/<id>/nodes/<nodeId>', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: 'saag://ios/landmarks/nodes/node_landmarkdetail' }
    });

    assert.equal(res.id, 4);
    const node = JSON.parse(res.result.contents[0].text);
    assert.equal(node.name, 'LandmarkDetail');
    assert.equal(node.kind, 'view');
  });

  it('resources/read: Returns -32603 or error message for non-existent URI', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: { uri: 'saag://unknown/invalid/uri' }
    });

    assert.equal(res.id, 5);
    assert.ok(res.error);
    assert.match(res.error.message, /Resource not found/);
  });

  it('prompts/list: Returns architectural prompt templates', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'prompts/list'
    });

    assert.equal(res.id, 6);
    const prompts = res.result.prompts;
    assert.ok(prompts.some((p) => p.name === 'implement_scoped_feature'));
    assert.ok(prompts.some((p) => p.name === 'architectural_audit'));
  });

  it('prompts/get: Materializes implement_scoped_feature with immutable socket contracts', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 7,
      method: 'prompts/get',
      params: {
        name: 'implement_scoped_feature',
        arguments: {
          project: 'landmarks',
          nodeId: 'node_landmarkdetail',
          featureDescription: 'Add support for sharing landmark location'
        }
      }
    });

    assert.equal(res.id, 7);
    const promptMsg = res.result.messages[0].content.text;
    assert.match(promptMsg, /LandmarkDetail/);
    assert.match(promptMsg, /BOUNDARY SPECIFICATION/);
    assert.match(promptMsg, /Add support for sharing landmark location/);
    assert.match(promptMsg, /PRESERVE IMMUTABLE SOCKET INTERFACES/);
  });

  it('prompts/get: Materializes architectural_audit prompt', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 8,
      method: 'prompts/get',
      params: {
        name: 'architectural_audit',
        arguments: { project: 'landmarks' }
      }
    });

    assert.equal(res.id, 8);
    const promptMsg = res.result.messages[0].content.text;
    assert.match(promptMsg, /State Blast Radius/);
    assert.match(promptMsg, /Layer Violations/);
    assert.match(promptMsg, /Retain Cycle Risks/);
  });
});
