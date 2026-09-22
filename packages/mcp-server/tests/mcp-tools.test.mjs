import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '../src/server.js';

describe('SaaG MCP Server — Tools Implementation & Execution Suite', () => {

  it('tools/list: Returns 5 registered architectural tools with valid schemas', async () => {
    const server = new McpServer();
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    assert.equal(res.id, 1);
    assert.ok(Array.isArray(res.result.tools));
    assert.equal(res.result.tools.length, 5);

    const toolNames = res.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('get_architecture_graph'));
    assert.ok(toolNames.includes('get_node_contract'));
    assert.ok(toolNames.includes('validate_architecture'));
    assert.ok(toolNames.includes('simulate_dataflow'));
    assert.ok(toolNames.includes('apply_architectural_refactor'));
  });

  it('tools/call: get_architecture_graph retrieves and filters graph by abstraction level', async () => {
    const server = new McpServer();

    // Call with L1 level
    const resL1 = await server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_architecture_graph',
        arguments: { project: 'landmarks', level: 'L1' }
      }
    });

    assert.equal(resL1.id, 2);
    assert.equal(resL1.result.isError, undefined);
    const dataL1 = JSON.parse(resL1.result.content[0].text);
    assert.equal(dataL1.projectId, 'landmarks');
    assert.equal(dataL1.domain, 'ios');
    assert.equal(dataL1.abstractionLevel, 'L1');
    assert.ok(dataL1.nodeCount > 0);
    assert.ok(dataL1.edgeCount > 0);

    // Call with L2 level (Components) should contain more or equal nodes than L1
    const resL2 = await server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_architecture_graph',
        arguments: { project: 'landmarks', level: 'L2' }
      }
    });

    const dataL2 = JSON.parse(resL2.result.content[0].text);
    assert.ok(dataL2.nodeCount >= dataL1.nodeCount);
  });

  it('tools/call: get_architecture_graph retrieves Autonomous Agent and ML graphs', async () => {
    const server = new McpServer();

    // Agent Swarm
    const resAgent = await server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_architecture_graph',
        arguments: { project: 'agent-orchestrator' }
      }
    });
    const agentData = JSON.parse(resAgent.result.content[0].text);
    assert.equal(agentData.domain, 'agent');
    assert.ok(Object.values(agentData.nodes).some((n) => n.kind === 'agent' || n.kind === 'tool'));

    // ML Pipeline
    const resMl = await server.handleRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'get_architecture_graph',
        arguments: { project: 'ml-pipeline' }
      }
    });
    const mlData = JSON.parse(resMl.result.content[0].text);
    assert.equal(mlData.domain, 'ml');
    assert.ok(Object.values(mlData.nodes).some((n) => n.kind === 'hardware' || n.kind === 'gpu'));
  });

  it('tools/call: get_node_contract inspects interface sockets, properties, and layer rules', async () => {
    const server = new McpServer();

    // Query LoginView in auth-sample
    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'get_node_contract',
        arguments: { project: 'auth-sample', nodeId: 'node_loginview' }
      }
    });

    assert.equal(res.id, 6);
    const contract = JSON.parse(res.result.content[0].text);
    assert.equal(contract.name, 'LoginView');
    assert.equal(contract.kind, 'view');
    assert.ok(Array.isArray(contract.stateProps));
    assert.ok(contract.sockets?.inputs);
    assert.ok(contract.sockets?.outputs);
    assert.ok(contract.architecturalGuardrails?.allowedDownstream?.includes('viewModel'));
    assert.ok(contract.architecturalGuardrails?.forbiddenDownstream?.includes('repository'));
  });

  it('tools/call: get_node_contract disambiguates by case-insensitive component name', async () => {
    const server = new McpServer();

    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'get_node_contract',
        arguments: { project: 'landmarks', nodeId: 'modeldata' }
      }
    });

    assert.equal(res.id, 7);
    const contract = JSON.parse(res.result.content[0].text);
    assert.equal(contract.name, 'ModelData');
    assert.equal(contract.kind, 'viewModel');
    assert.ok(contract.activeConnections.incoming.length > 0);
  });

  it('tools/call: validate_architecture identifies blast radius and clean architecture health', async () => {
    const server = new McpServer();

    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'validate_architecture',
        arguments: { project: 'landmarks', maxBlastRadius: 5 }
      }
    });

    assert.equal(res.id, 8);
    const audit = JSON.parse(res.result.content[0].text);
    assert.equal(audit.projectId, 'landmarks');
    assert.equal(audit.passed, true); // No critical errors in Landmarks
    assert.ok(audit.warnings.length > 0); // ModelData has blast radius fanout warning
    assert.ok(audit.markdownSummary.includes('ModelData'));
  });

  it('tools/call: simulate_dataflow executes happy path and validation error traces', async () => {
    const server = new McpServer();

    // 1. Happy path
    const resHappy = await server.handleRequest({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'simulate_dataflow',
        arguments: { project: 'auth-sample', scenarioId: 'happy_path' }
      }
    });

    assert.equal(resHappy.id, 9);
    const happyTrace = JSON.parse(resHappy.result.content[0].text);
    assert.equal(happyTrace.finalStatus, 'success');
    assert.ok(happyTrace.totalSteps >= 3);

    // 2. Validation error (halts before network)
    const resVal = await server.handleRequest({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'simulate_dataflow',
        arguments: { project: 'auth-sample', scenarioId: 'validation_error' }
      }
    });

    const valTrace = JSON.parse(resVal.result.content[0].text);
    assert.ok(valTrace.finalStatus === 'error' || valTrace.finalStatus === 'halted');
  });

  it('tools/call: apply_architectural_refactor atomically creates, edits, and deletes files in sandbox', async () => {
    const server = new McpServer();
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-mcp-test-'));
    const initialGraph = {
      projectId: 'sandbox-project',
      projectName: 'Sandbox Project',
      domain: 'ios',
      nodes: {
        node_view: { id: 'node_view', name: 'SandboxView', kind: 'view' }
      },
      edges: {}
    };
    const sandboxGraphPath = path.join(sandboxDir, 'graph.json');
    fs.writeFileSync(sandboxGraphPath, JSON.stringify(initialGraph, null, 2), 'utf8');

    // Create an existing file to modify and another to delete
    const existingFile = path.join(sandboxDir, 'Existing.swift');
    fs.writeFileSync(existingFile, '// Original content\n', 'utf8');
    const deleteCandidate = path.join(sandboxDir, 'Obsolete.swift');
    fs.writeFileSync(deleteCandidate, '// Obsolete\n', 'utf8');

    const res = await server.handleRequest({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'apply_architectural_refactor',
        arguments: {
          project: sandboxGraphPath,
          changes: [
            {
              action: 'create',
              filePath: path.join(sandboxDir, 'Sources/NewFeature.swift'),
              content: 'import SwiftUI\nstruct NewFeature: View {}\n'
            },
            {
              action: 'modify',
              filePath: existingFile,
              content: '// Updated content\n'
            },
            {
              action: 'delete',
              filePath: deleteCandidate
            }
          ],
          graphPatch: {
            nodes: {
              node_new_feature: { id: 'node_new_feature', name: 'NewFeature', kind: 'view' }
            }
          }
        }
      }
    });

    assert.equal(res.id, 11);
    const result = JSON.parse(res.result.content[0].text);
    assert.equal(result.success, true);
    assert.equal(result.filesAffected, 3);

    // Verify disk changes
    assert.ok(fs.existsSync(path.join(sandboxDir, 'Sources/NewFeature.swift')));
    assert.equal(fs.readFileSync(existingFile, 'utf8'), '// Updated content\n');
    assert.equal(fs.existsSync(deleteCandidate), false);

    // Verify graph patch persisted
    const updatedGraph = JSON.parse(fs.readFileSync(sandboxGraphPath, 'utf8'));
    assert.ok(updatedGraph.nodes.node_new_feature);

    // Cleanup
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  });
});
