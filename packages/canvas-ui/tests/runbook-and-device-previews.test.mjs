process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createRequire } from 'node:module';

import { PRESET_SCENARIOS } from '../src/simulation/engine.js';
import { generateRunbookMarkdown } from '../src/simulation/runbookGenerator.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

let ScreenPreviewBundle = null;
async function getScreenPreviewModule() {
  if (ScreenPreviewBundle) return ScreenPreviewBundle;
  const entryPath = path.resolve(__dirname, '../src/components/ScreenPreview.jsx');
  const bundle = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'cjs',
    write: false,
    external: ['react', 'react-dom']
  });
  const code = bundle.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', code);
  fn(require, mod, mod.exports);
  ScreenPreviewBundle = mod.exports;
  return ScreenPreviewBundle;
}

test.describe('SaaG Architectural Runbook & Multi-Device Previews Suite', () => {
  const authSampleGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'examples/ios-auth-sample/.saag/graph.json'), 'utf8')
  );

  test('generateRunbookMarkdown: Graceful fallback on null or empty simulation', () => {
    const emptyOutput = generateRunbookMarkdown(null, authSampleGraph);
    assert.match(emptyOutput, /No active simulation trace available/);

    const emptyStepsOutput = generateRunbookMarkdown({ steps: [] }, authSampleGraph);
    assert.match(emptyStepsOutput, /Executive Summary/);
  });

  test('generateRunbookMarkdown: Generates valid Mermaid sequence diagram and markdown tables for Happy Path', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'happy_path');
    assert.ok(scenario);

    const steps = scenario.traceGenerator(authSampleGraph);
    const simulation = {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      steps
    };

    const markdown = generateRunbookMarkdown(simulation, authSampleGraph);

    // Document header
    assert.match(markdown, /# 🏛️ SaaG Architectural Runbook: Happy Path/);
    assert.match(markdown, /> \*\*System Under Test:\*\* (ios-auth-sample|AuthSample)/);
    assert.match(markdown, /> \*\*Status:\*\* ✅ \*\*ALL GUARDS VERIFIED\*\*/);

    // Mermaid Sequence Diagram
    assert.match(markdown, /```mermaid\nsequenceDiagram\n  autonumber/);
    assert.match(markdown, /participant node_loginview as 📱 LoginView/);
    assert.match(markdown, /participant node_authviewmodel as 🗄️ AuthViewModel/);
    assert.match(markdown, /node_loginview->>/);
    assert.match(markdown, /->>node_authviewmodel:/);

    // Execution Table
    assert.match(markdown, /## 3\. Step-by-Step Chronological Execution Log/);
    assert.match(markdown, /\| Step \| Node \| Event \/ Port \| Latency \| Status \| Key State Mutation \|/);
    assert.match(markdown, /\| \*\*1\*\* \| `LoginView` \|/);
    assert.match(markdown, /\| \*\*3\*\* \| `AuthViewModel` \|/);

    // Payloads and state mutations
    assert.match(markdown, /## 4\. Detailed Socket Payloads & State Transitions/);
    assert.match(markdown, /alban@example\.com/);
    assert.match(markdown, /password123/);
    assert.match(markdown, /jwt_mock_token_abc123/);
  });

  test('generateRunbookMarkdown: Accurately flags and logs error halt in Validation Error scenario', () => {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === 'validation_error');
    assert.ok(scenario);

    const steps = scenario.traceGenerator(authSampleGraph);
    const simulation = {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      steps
    };

    const markdown = generateRunbookMarkdown(simulation, authSampleGraph);

    // Halted status
    assert.match(markdown, /> \*\*Status:\*\* ❌ \*\*EXECUTION HALTED \/ ERROR\*\*/);
    assert.match(markdown, /❌ Halts: /);
    assert.match(markdown, /❌ Error/);
    assert.match(markdown, /errorMessage/);
  });

  test('ScreenPreview & DevicePreviewContext: Renders iPhone, iPad, and Watch chassis with Light and Dark schemes', async () => {
    const screenMod = await getScreenPreviewModule();
    const ScreenPreview = screenMod.default;
    const DevicePreviewContext = screenMod.DevicePreviewContext;

    assert.ok(ScreenPreview, 'ScreenPreview component must be exported');
    assert.ok(DevicePreviewContext, 'DevicePreviewContext must be exported');

    // 1. iPhone 16 Pro Dark Mode
    const htmlIphoneDark = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ScreenPreview, {
        nodeName: 'LoginView',
        size: 'full',
        deviceType: 'iphone',
        colorScheme: 'dark'
      })
    );
    assert.ok(htmlIphoneDark.includes('chassis-iphone'), 'Must render iPhone chassis');
    assert.ok(htmlIphoneDark.includes('dynamic-island'), 'Must render Dynamic Island');
    assert.ok(htmlIphoneDark.includes('scheme-dark'), 'Must render Dark scheme');

    // 2. iPad Pro 11" Light Mode
    const htmlIpadLight = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ScreenPreview, {
        nodeName: 'ContentView',
        size: 'full',
        deviceType: 'ipad',
        colorScheme: 'light'
      })
    );
    assert.ok(htmlIpadLight.includes('chassis-ipad'), 'Must render iPad chassis');
    assert.ok(htmlIpadLight.includes('ipad-camera-dot'), 'Must render iPad camera dot');
    assert.ok(htmlIpadLight.includes('scheme-light'), 'Must render Light scheme');

    // 3. Apple Watch Ultra 2
    const htmlWatch = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ScreenPreview, {
        nodeName: 'ProfileHost',
        size: 'full',
        deviceType: 'watch',
        colorScheme: 'dark'
      })
    );
    assert.ok(htmlWatch.includes('chassis-watch'), 'Must render Apple Watch chassis');
    assert.ok(htmlWatch.includes('watch-digital-crown'), 'Must render Watch Digital Crown');
    assert.ok(htmlWatch.includes('watch-action-button'), 'Must render Watch Action Button');
  });
});
