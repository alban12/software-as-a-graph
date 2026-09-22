import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliBin = path.resolve(__dirname, '../bin/saag-mcp.js');

describe('SaaG CI/CD Architectural Linter — CLI & Verification Suite', () => {

  it('CLI --help: Prints help manual and exits with code 0', () => {
    const output = execSync(`node "${cliBin}" --help`, { encoding: 'utf8' });
    assert.match(output, /SaaG Model Context Protocol/);
    assert.match(output, /USAGE:/);
    assert.match(output, /OPTIONS FOR "verify":/);
  });

  it('CLI list-tools: Prints all 5 architectural tools in formatted table', () => {
    const output = execSync(`node "${cliBin}" list-tools`, { encoding: 'utf8' });
    assert.match(output, /Registered SaaG MCP Tools \(5\)/);
    assert.match(output, /get_architecture_graph/);
    assert.match(output, /validate_architecture/);
    assert.match(output, /apply_architectural_refactor/);
  });

  it('CLI verify: Successfully passes Clean Architecture checks on Landmarks (exit code 0)', () => {
    const output = execSync(`node "${cliBin}" verify --project landmarks`, { encoding: 'utf8' });
    assert.match(output, /SaaG Architectural Verification Report/);
    assert.match(output, /STATUS: PASSED/);
  });

  it('CLI verify: Successfully passes Clean Architecture checks on AuthSample (exit code 0)', () => {
    const output = execSync(`node "${cliBin}" verify --project auth-sample`, { encoding: 'utf8' });
    assert.match(output, /ARCHITECTURE VERIFIED|STATUS: PASSED/);
  });

  it('CLI verify: Correctly flags layer separation violation and exits with code 1', () => {
    // Create a temporary graph fixture with an illegal View -> Repository connection
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-violation-test-'));
    const violationGraphPath = path.join(tempDir, 'violation-graph.json');

    const invalidGraph = {
      projectId: 'violation-test',
      projectName: 'Violation Test Project',
      domain: 'ios',
      nodes: {
        node_my_view: { id: 'node_my_view', name: 'MyViolatingView', kind: 'view' },
        node_my_repo: { id: 'node_my_repo', name: 'DirectRepository', kind: 'repository' }
      },
      edges: {
        edge_illegal: {
          id: 'edge_illegal',
          sourceNodeId: 'node_my_view',
          targetNodeId: 'node_my_repo',
          edgeKind: 'call'
        }
      }
    };

    fs.writeFileSync(violationGraphPath, JSON.stringify(invalidGraph, null, 2), 'utf8');

    let failed = false;
    try {
      execSync(`node "${cliBin}" verify --project "${violationGraphPath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      failed = true;
      assert.equal(err.status, 1);
      const combinedOutput = (err.stdout || '') + (err.stderr || '');
      assert.match(combinedOutput, /LAYER_SEPARATION/);
      assert.match(combinedOutput, /connects directly to Repository/);
      assert.match(combinedOutput, /STATUS: FAILED/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    assert.equal(failed, true, 'Linter should fail with exit code 1 on layer separation violation');
  });

  it('CLI verify --json: Outputs structured JSON for automated CI machine ingestion', () => {
    const output = execSync(`node "${cliBin}" verify --project landmarks --json`, { encoding: 'utf8' });
    const parsed = JSON.parse(output);
    assert.equal(parsed.projectId, 'landmarks');
    assert.equal(parsed.passed, true);
    assert.ok(Array.isArray(parsed.errors));
    assert.ok(Array.isArray(parsed.warnings));
    assert.ok(parsed.summary.nodeCount > 0);
  });

  it('CLI verify --markdown: Outputs GitHub PR comment format', () => {
    const output = execSync(`node "${cliBin}" verify --project landmarks --markdown`, { encoding: 'utf8' });
    assert.match(output, /## 🏛️ SaaG Architectural Verification: Landmarks iOS/);
    assert.match(output, /Status:/);
    assert.match(output, /Software as a Graph \(SaaG\)/);
  });
});
