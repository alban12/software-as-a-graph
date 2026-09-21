import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSaagUri,
  formatCrossReferenceLabel
} from '../src/utils/crossReferences.js';

test.describe('Universal Cross-Project Reference System', () => {
  test('parseSaagUri parses iOS app URIs', () => {
    const parsed = parseSaagUri('saag://ios/landmarks/node_landmarkdetail');
    assert.ok(parsed, 'Parses valid URI');
    assert.strictEqual(parsed.projectType, 'ios');
    assert.strictEqual(parsed.projectId, 'landmarks');
    assert.strictEqual(parsed.nodeId, 'node_landmarkdetail');
    assert.strictEqual(parsed.icon, '📱');
    assert.strictEqual(parsed.typeLabel, 'iOS App');
  });

  test('parseSaagUri parses Agents graph URIs', () => {
    const parsed = parseSaagUri('saag://agents/agent_orchestrator/node_supervisor_agent');
    assert.ok(parsed);
    assert.strictEqual(parsed.projectType, 'agents');
    assert.strictEqual(parsed.projectId, 'agent_orchestrator');
    assert.strictEqual(parsed.nodeId, 'node_supervisor_agent');
    assert.strictEqual(parsed.icon, '🤖');
    assert.strictEqual(parsed.typeLabel, 'Agents Graph');
  });

  test('parseSaagUri parses ML graph URIs', () => {
    const parsed = parseSaagUri('saag://ml/ml_pipeline/node_vllm_engine');
    assert.ok(parsed);
    assert.strictEqual(parsed.projectType, 'ml');
    assert.strictEqual(parsed.projectId, 'ml_pipeline');
    assert.strictEqual(parsed.nodeId, 'node_vllm_engine');
    assert.strictEqual(parsed.icon, '🧠');
    assert.strictEqual(parsed.typeLabel, 'ML Graph');
  });

  test('parseSaagUri handles malformed or non-saag URIs gracefully', () => {
    assert.strictEqual(parseSaagUri(null), null);
    assert.strictEqual(parseSaagUri(''), null);
    assert.strictEqual(parseSaagUri('https://example.com'), null);
    assert.strictEqual(parseSaagUri('saag://only-one-part'), null);
  });

  test('formatCrossReferenceLabel formats labels cleanly', () => {
    const customRef = {
      targetUri: 'saag://ml/ml_pipeline/node_vllm_engine',
      label: 'Custom Llama-3 Endpoint'
    };
    assert.strictEqual(formatCrossReferenceLabel(customRef), 'Custom Llama-3 Endpoint');

    const autoRef = {
      targetUri: 'saag://agents/agent_orchestrator/node_supervisor_agent'
    };
    const formatted = formatCrossReferenceLabel(autoRef);
    assert.ok(formatted.includes('🤖'));
    assert.ok(formatted.includes('Agents Graph'));
    assert.ok(formatted.includes('supervisor_agent'));
  });
});
