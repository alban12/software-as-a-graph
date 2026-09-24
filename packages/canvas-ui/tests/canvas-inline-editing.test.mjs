process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { app } from '../server.js';
import { WebSocket } from 'ws';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to bundle JSX component for Node.js test runtime
async function bundleComponent(relPath) {
  const entryPath = path.resolve(__dirname, relPath);
  const bundle = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'cjs',
    write: false,
    external: ['react', 'react-dom', '@xyflow/react']
  });
  const code = bundle.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', code);
  fn(require, mod, mod.exports);
  return mod.exports.default || mod.exports;
}

test.describe('Canvas Inline Click-to-Edit for Swift AST UI Elements Suite (Option 1)', () => {
  let server;
  let baseUrl;
  let testSwiftFile;
  let originalSwiftContent;
  let testGraphFile;
  let originalGraphContent;

  const realSwiftPath = path.resolve(
    __dirname,
    '../../../benchmarks/Landmarks/Landmarks/Views/ContentView.swift'
  );
  const realGraphPath = path.resolve(
    __dirname,
    '../../../benchmarks/landmarks-graph.json'
  );

  test.before(async () => {
    // Backup real files before any test mutations
    if (fs.existsSync(realSwiftPath)) {
      originalSwiftContent = fs.readFileSync(realSwiftPath, 'utf8');
    }
    if (fs.existsSync(realGraphPath)) {
      originalGraphContent = fs.readFileSync(realGraphPath, 'utf8');
    }

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
    // Restore real files to clean state
    if (originalSwiftContent && fs.existsSync(realSwiftPath)) {
      fs.writeFileSync(realSwiftPath, originalSwiftContent, 'utf8');
    }
    if (originalGraphContent && fs.existsSync(realGraphPath)) {
      fs.writeFileSync(realGraphPath, originalGraphContent, 'utf8');
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function apiRequest(endpoint, body) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  test('1. POST /api/update-view-element validates required parameters', async () => {
    const resMissingBoth = await apiRequest('/api/update-view-element', {});
    assert.equal(resMissingBoth.status, 400);
    assert.match(resMissingBoth.data.error, /Missing required parameters/);

    const resMissingLabel = await apiRequest('/api/update-view-element', {
      filePath: 'Landmarks/Views/ContentView.swift'
    });
    assert.equal(resMissingLabel.status, 400);

    const resMissingFile = await apiRequest('/api/update-view-element', {
      filePath: '/nonexistent/path/RandomView.swift',
      oldLabel: 'Old',
      newLabel: 'New'
    });
    assert.equal(resMissingFile.status, 404);
  });

  test('2. POST /api/update-view-element mutates Swift file in-place and returns elementId', async () => {
    const currentSwift = fs.readFileSync(realSwiftPath, 'utf8');
    const labelMatch = currentSwift.match(/Label\("([^"]+)",\s*systemImage:\s*"star"\)/);
    assert.ok(labelMatch, 'Expected ContentView.swift to contain star Label');
    const originalLabel = labelMatch[1];
    const testLabel = originalLabel === 'TEST_LABEL' ? 'EXPLORE' : 'TEST_LABEL';

    // Update originalLabel -> testLabel
    const updateRes = await apiRequest('/api/update-view-element', {
      filePath: 'Landmarks/Views/ContentView.swift',
      elementId: 'el_contentview_tab_1',
      oldLabel: originalLabel,
      newLabel: testLabel,
      lineSpan: { startLine: 30, endLine: 40 }
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.success, true);
    assert.equal(updateRes.data.newLabel, testLabel);
    assert.equal(updateRes.data.elementId, 'el_contentview_tab_1');

    // Verify Swift file on disk
    const modifiedSwift = fs.readFileSync(realSwiftPath, 'utf8');
    assert.ok(modifiedSwift.includes(`Label("${testLabel}", systemImage: "star")`), `Swift source must have "${testLabel}"`);
    assert.ok(!modifiedSwift.includes(`Label("${originalLabel}", systemImage: "star")`), `Old label "${originalLabel}" must be replaced`);

    // Restore back to originalLabel
    const restoreRes = await apiRequest('/api/update-view-element', {
      filePath: 'Landmarks/Views/ContentView.swift',
      elementId: 'el_contentview_tab_1',
      oldLabel: testLabel,
      newLabel: originalLabel,
      lineSpan: { startLine: 30, endLine: 40 }
    });

    assert.equal(restoreRes.status, 200);
    const restoredSwift = fs.readFileSync(realSwiftPath, 'utf8');
    assert.ok(restoredSwift.includes(`Label("${originalLabel}", systemImage: "star")`), `Swift source must be restored to "${originalLabel}"`);
  });

  test('3. ScreenPreview component renders interactive tabs with inline edit titles', async () => {
    const ScreenPreview = await bundleComponent('../src/components/ScreenPreview.jsx');

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ScreenPreview, {
        nodeName: 'ContentView',
        nodeId: 'node_contentview',
        filePath: 'Landmarks/Views/ContentView.swift',
        viewElements: [
          { id: 'el_tab_1', type: 'tab', label: 'ALBAN', systemImage: 'star', tag: 'featured' },
          { id: 'el_tab_2', type: 'tab', label: 'List', systemImage: 'list.bullet', tag: 'list' }
        ]
      })
    );

    assert.ok(html.includes('ALBAN'), 'Rendered preview must include "ALBAN" label');
    assert.ok(html.includes('List'), 'Rendered preview must include "List" label');
    assert.ok(html.includes('ios-tab-bar'), 'Rendered preview must include iOS bottom tab bar');
    assert.ok(html.includes('Double-click to edit Swift code inline'), 'Tab bar items must have edit title attribute');
  });

  test('4. DeviceZoomModal renders Interactive Swift AST Elements panel', async () => {
    const DeviceZoomModal = await bundleComponent('../src/components/DeviceZoomModal.jsx');

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DeviceZoomModal, {
        isOpen: true,
        onClose: () => {},
        node: {
          id: 'node_contentview',
          name: 'ContentView',
          sourceAnchor: {
            filePath: 'Landmarks/Views/ContentView.swift',
            startLine: 22,
            endLine: 53
          },
          viewElements: [
            { id: 'el_tab_1', type: 'tab', label: 'ALBAN', systemImage: 'star', startLine: 34 },
            { id: 'el_tab_2', type: 'tab', label: 'List', systemImage: 'list.bullet', startLine: 40 }
          ]
        }
      })
    );

    assert.ok(html.includes('Interactive Swift AST Elements'), 'Modal must render Interactive Swift AST Elements panel');
    assert.ok(html.includes('Update Swift'), 'Modal must have Update Swift buttons');
    assert.ok(html.includes('L34'), 'Modal must display source line pill L34');
    assert.ok(html.includes('L40'), 'Modal must display source line pill L40');
  });
});
