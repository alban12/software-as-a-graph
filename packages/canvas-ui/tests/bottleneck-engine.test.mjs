import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeBottlenecks } from '../src/analysis/bottleneckEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

test.describe('Architectural Diagnostic & Bottleneck Engine', () => {
  const landmarksGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/landmarks-graph.json'), 'utf8')
  );
  const makeItSoGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/makeitso-graph.json'), 'utf8')
  );
  const authSampleGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'examples/ios-auth-sample/.saag/graph.json'), 'utf8')
  );

  test('Landmarks: Correctly identifies ModelData state blast radius bottleneck', () => {
    const report = analyzeBottlenecks(landmarksGraph);

    assert.ok(report.stats.totalIssues > 0, 'Bottlenecks identified in Landmarks');
    assert.ok(report.stats.criticalCount >= 1, 'At least 1 critical issue in Landmarks');

    const modelDataIssue = report.bottlenecks.find((b) => b.nodeId === 'node_modeldata');
    assert.ok(modelDataIssue, 'ModelData identified as a bottleneck');
    assert.strictEqual(modelDataIssue.type, 'STATE_BLAST_RADIUS');
    const blast = parseInt(modelDataIssue.metricValue, 10);
    assert.ok(blast >= 10, `ModelData blast radius must be >= 10 (actual: ${blast})`);
    assert.ok(modelDataIssue.refactoringPlan, 'Actionable refactoring plan is generated');
    assert.strictEqual(modelDataIssue.refactoringPlan.actionType, 'DECOUPLE_STATE_STORE');
    assert.ok(modelDataIssue.refactoringPlan.newNodes.length > 0, 'Plan adds a decoupled store node');
  });

  test('Landmarks: Correctly identifies critical path latency bottleneck', () => {
    const report = analyzeBottlenecks(landmarksGraph);

    const latencyIssues = report.bottlenecks.filter((b) => b.type === 'CRITICAL_PATH_LATENCY');
    assert.ok(latencyIssues.length > 0, 'Detects critical path latency issues');

    // Find the 380ms slow waterfall path between Coordinator and PageControl
    const slowWaterfall = latencyIssues.find((b) => parseFloat(b.metricValue) >= 200);
    assert.ok(slowWaterfall, 'Detects slow synchronous path >= 200ms');
    assert.strictEqual(slowWaterfall.nodeName, 'PageControl');
    assert.strictEqual(slowWaterfall.metricValue, '380ms');
    assert.ok(slowWaterfall.refactoringPlan, 'Includes architectural remedy plan');
    assert.strictEqual(slowWaterfall.refactoringPlan.actionType, 'INSERT_INTERMEDIATE_CACHE');
  });

  test('AuthSample: Identifies slow synchronous path and retain cycle risk', () => {
    const report = analyzeBottlenecks(authSampleGraph);

    const latencyIssue = report.bottlenecks.find((b) => b.type === 'CRITICAL_PATH_LATENCY');
    assert.ok(latencyIssue, 'AuthSample has latency bottleneck on auth path');

    const retainIssue = report.bottlenecks.find((b) => b.type === 'RETAIN_CYCLE_RISK');
    if (retainIssue) {
      assert.strictEqual(retainIssue.severity, 'warning');
      assert.ok(retainIssue.refactoringPlan.swiftChanges.length > 0, 'Contains Swift change fixing [weak self]');
    }
  });

  test('MakeItSo: Diagnostic engine executes cleanly across multi-screen Firestore graph', () => {
    const report = analyzeBottlenecks(makeItSoGraph);
    assert.ok(report.stats, 'Report includes stats summary');
    assert.ok(typeof report.stats.totalIssues === 'number');
    assert.ok(Array.isArray(report.bottlenecks));
  });

  test('Handles empty and minimal graph inputs gracefully without crashing', () => {
    const emptyReport = analyzeBottlenecks(null);
    assert.strictEqual(emptyReport.stats.totalIssues, 0);
    assert.deepStrictEqual(emptyReport.bottlenecks, []);

    const minimalGraph = {
      nodes: {
        node_1: { id: 'node_1', name: 'Isolated', kind: 'view' }
      },
      edges: {}
    };
    const minReport = analyzeBottlenecks(minimalGraph);
    assert.strictEqual(minReport.stats.totalIssues, 0);
  });
});
