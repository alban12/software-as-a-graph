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
import { app, parseSwiftASTFile, reconcileSwiftASTChange } from '../server.js';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to bundle ScreenPreview component for Node.js runtime verification
let ScreenPreviewComponent = null;
async function getScreenPreview() {
  if (ScreenPreviewComponent) return ScreenPreviewComponent;
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
  ScreenPreviewComponent = mod.exports.default;
  return ScreenPreviewComponent;
}

test.describe('Bi-Directional Swift AST & Screen Preview Synchronization Suite', () => {
  let server;
  let baseUrl;
  let sandboxDir;

  test.before(async () => {
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-bidi-preview-test-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  async function apiRequest(endpoint, body, method = 'POST') {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  // =========================================================================
  // 1. DIRECTION A: Swift Source -> AST Parser -> Graph -> Screen Preview
  // =========================================================================
  test('Direction A: Swift AST parser extracts custom TabView Labels and struct rename', () => {
    const swiftContent = `import SwiftUI

struct ContenttttView: View {
    @State private var selection: Tab = .featured

    enum Tab {
        case featured
        case list
    }

    var body: some View {
        TabView(selection: $selection) {
            CategoryHome()
                .tabItem {
                    Label("ALBANNNN", systemImage: "star")
                }
                .tag(Tab.featured)

            LandmarkList()
                .tabItem {
                    Label("Custom List", systemImage: "list.bullet")
                }
                .tag(Tab.list)
        }
    }
}
`;
    const ast = parseSwiftASTFile(swiftContent, 'ContentView.swift');

    assert.strictEqual(ast.typeName, 'ContenttttView', 'Correctly parsed renamed struct ContenttttView');
    assert.strictEqual(ast.kind, 'view', 'Correctly identified view kind');
    assert.strictEqual(ast.viewElements.length, 2, 'Parsed exactly 2 tab elements');

    // First tab item
    const tab1 = ast.viewElements[0];
    assert.strictEqual(tab1.type, 'tab');
    assert.strictEqual(tab1.label, 'ALBANNNN');
    assert.strictEqual(tab1.systemImage, 'star');
    assert.strictEqual(tab1.tag, 'featured');

    // Second tab item
    const tab2 = ast.viewElements[1];
    assert.strictEqual(tab2.type, 'tab');
    assert.strictEqual(tab2.label, 'Custom List');
    assert.strictEqual(tab2.systemImage, 'list.bullet');
    assert.strictEqual(tab2.tag, 'list');
  });

  test('Direction A: reconcileSwiftASTChange updates node name, symbolPath, and viewElements on graph', () => {
    const swiftFile = path.join(sandboxDir, 'ContentView.swift');
    const swiftContent = `import SwiftUI

struct ContenttttView: View {
    @State private var selection: Tab = .featured

    var body: some View {
        TabView(selection: $selection) {
            CategoryHome()
                .tabItem {
                    Label("ALBANNNN", systemImage: "star")
                }
                .tag(Tab.featured)

            LandmarkList()
                .tabItem {
                    Label("List", systemImage: "list.bullet")
                }
                .tag(Tab.list)
        }
    }
}
`;
    fs.writeFileSync(swiftFile, swiftContent, 'utf8');

    const graph = {
      nodes: {
        node_contentview: {
          id: 'node_contentview',
          name: 'ContentView',
          kind: 'view',
          canvasMeta: { position: { x: 430, y: 1080 } },
          sourceAnchor: {
            filePath: swiftFile,
            symbolPath: 'ContentView',
            startLine: 1,
            endLine: 40
          },
          properties: []
        }
      },
      edges: {}
    };

    const project = { id: 'test_project', sourceDir: sandboxDir };
    const { updated, node } = reconcileSwiftASTChange(swiftFile, graph, project);

    assert.strictEqual(updated, true);
    assert.strictEqual(node.name, 'ContenttttView', 'Node name synchronized with renamed struct');
    assert.strictEqual(node.sourceAnchor.symbolPath, 'ContenttttView', 'SymbolPath synchronized');
    assert.ok(node.viewElements.length >= 2, 'View elements populated');
    assert.strictEqual(node.viewElements[0].label, 'ALBANNNN');
    assert.strictEqual(node.canvasMeta.position.x, 430, 'Visual canvasMeta position preserved');
  });

  test('Direction A: ScreenPreview dynamically renders ALBANNNN label in tab bar & header', async () => {
    const ScreenPreview = await getScreenPreview();

    const viewElements = [
      { id: 'el_tab_1', type: 'tab', label: 'ALBANNNN', systemImage: 'star', tag: 'featured' },
      { id: 'el_tab_2', type: 'tab', label: 'List', systemImage: 'list.bullet', tag: 'list' }
    ];

    const element = React.createElement(ScreenPreview, {
      nodeName: 'ContenttttView',
      nodeId: 'node_contentview',
      filePath: 'Landmarks/Views/ContentView.swift',
      viewElements
    });

    const renderedHtml = ReactDOMServer.renderToString(element);

    // 1. Verify bottom tab bar rendered ALBANNNN
    assert.ok(renderedHtml.includes('ALBANNNN'), 'Rendered HTML must contain ALBANNNN');
    assert.ok(renderedHtml.includes('ios-tab-bar'), 'Rendered HTML has iOS tab bar');

    // 2. Verify CategoryHomeContent header displays ALBANNNN
    assert.ok(renderedHtml.includes('cat-nav-title">ALBANNNN</span>'), 'Top navigation header displays ALBANNNN');

    // 3. Verify it does NOT fall back to "Featured"
    assert.ok(!renderedHtml.includes('<span>Featured</span>'), 'Did not render hardcoded Featured tab label');
  });

  // =========================================================================
  // 2. DIRECTION B: Canvas/UI -> Swift Source Code In-Place Sync
  // =========================================================================
  test('Direction B: POST /api/update-view-element modifies Label in Swift file in-place', async () => {
    const swiftFile = path.join(sandboxDir, 'ContentView.swift');
    const swiftContent = `import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            CategoryHome()
                .tabItem {
                    Label("ALBANNNN", systemImage: "star")
                }
        }
    }
}
`;
    fs.writeFileSync(swiftFile, swiftContent, 'utf8');

    // Simulate UI action: changing "ALBANNNN" to "EXPLORE_ALBAN"
    const response = await apiRequest('/api/update-view-element', {
      filePath: swiftFile,
      elementId: 'el_tab_1',
      oldLabel: 'ALBANNNN',
      newLabel: 'EXPLORE_ALBAN',
      lineSpan: { startLine: 7, endLine: 12 }
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);
    assert.strictEqual(response.data.newLabel, 'EXPLORE_ALBAN');

    // Verify Swift file on disk
    const updatedContent = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(updatedContent.includes('Label("EXPLORE_ALBAN", systemImage: "star")'), 'Swift source updated with new label');
    assert.ok(!updatedContent.includes('Label("ALBANNNN"'), 'Old label removed');
  });

  // =========================================================================
  // 3. FULL BI-DIRECTIONAL ROUND-TRIP: Swift Code <-> Graph & Screen Preview
  // =========================================================================
  test('Bi-Directional Full Round-Trip: Code -> AST -> UI Update -> Swift File -> AST Re-Parse -> Preview', async () => {
    const ScreenPreview = await getScreenPreview();
    const swiftFile = path.join(sandboxDir, 'ContentView.swift');
    const initialSwift = `import SwiftUI

struct ContenttttView: View {
    @State private var selection: Tab = .featured

    var body: some View {
        TabView(selection: $selection) {
            CategoryHome()
                .tabItem {
                    Label("ALBANNNN", systemImage: "star")
                }
                .tag(Tab.featured)

            LandmarkList()
                .tabItem {
                    Label("List", systemImage: "list.bullet")
                }
                .tag(Tab.list)
        }
    }
}
`;
    fs.writeFileSync(swiftFile, initialSwift, 'utf8');

    // Step 1: Initial Swift AST Extraction
    const initialAst = parseSwiftASTFile(fs.readFileSync(swiftFile, 'utf8'), 'ContentView.swift');
    assert.strictEqual(initialAst.typeName, 'ContenttttView');
    assert.strictEqual(initialAst.viewElements[0].label, 'ALBANNNN');

    // Step 2: Render initial preview
    const initialHtml = ReactDOMServer.renderToString(
      React.createElement(ScreenPreview, {
        nodeName: initialAst.typeName,
        nodeId: 'node_contentview',
        filePath: swiftFile,
        viewElements: initialAst.viewElements
      })
    );
    assert.ok(initialHtml.includes('ALBANNNN'), 'Initial screen preview renders ALBANNNN');

    // Step 3: UI initiates bidirectional update: change "ALBANNNN" to "DISCOVERY_MODE"
    const updateRes = await apiRequest('/api/update-view-element', {
      filePath: swiftFile,
      elementId: initialAst.viewElements[0].id,
      oldLabel: 'ALBANNNN',
      newLabel: 'DISCOVERY_MODE',
      lineSpan: { startLine: 10, endLine: 16 }
    });
    assert.strictEqual(updateRes.status, 200);

    // Step 4: Verify Swift file was patched in-place
    const modifiedSwift = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(modifiedSwift.includes('Label("DISCOVERY_MODE", systemImage: "star")'));

    // Step 5: Swift File Watcher / Reconciler parses the updated file
    const reconciledAst = parseSwiftASTFile(modifiedSwift, 'ContentView.swift');
    assert.strictEqual(reconciledAst.viewElements[0].label, 'DISCOVERY_MODE');

    // Step 6: Render ScreenPreview with reconciled AST
    const reconciledHtml = ReactDOMServer.renderToString(
      React.createElement(ScreenPreview, {
        nodeName: reconciledAst.typeName,
        nodeId: 'node_contentview',
        filePath: swiftFile,
        viewElements: reconciledAst.viewElements
      })
    );
    assert.ok(reconciledHtml.includes('DISCOVERY_MODE'), 'Updated screen preview renders DISCOVERY_MODE');
    assert.ok(!reconciledHtml.includes('ALBANNNN'), 'Old label no longer rendered');

    // Step 7: Complete the loop in reverse: edit Swift file back to "ALBANNNN"
    const finalSwift = modifiedSwift.replace('DISCOVERY_MODE', 'ALBANNNN');
    fs.writeFileSync(swiftFile, finalSwift, 'utf8');

    const finalAst = parseSwiftASTFile(fs.readFileSync(swiftFile, 'utf8'), 'ContentView.swift');
    assert.strictEqual(finalAst.viewElements[0].label, 'ALBANNNN');

    const finalHtml = ReactDOMServer.renderToString(
      React.createElement(ScreenPreview, {
        nodeName: finalAst.typeName,
        nodeId: 'node_contentview',
        filePath: swiftFile,
        viewElements: finalAst.viewElements
      })
    );
    assert.ok(finalHtml.includes('ALBANNNN'), 'Reverse round-trip completes with 100% fidelity');
  });
});
