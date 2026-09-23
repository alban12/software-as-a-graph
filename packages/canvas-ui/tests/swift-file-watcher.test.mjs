import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSwiftASTFile, reconcileSwiftASTChange } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Real-Time Swift AST Parser & File Watcher Reconciler', () => {
  const sampleSwiftView = `import SwiftUI

struct TestProfileView: View {
    @State private var isEditing: Bool = false
    @Environment(ModelData.self) var modelData
    @Binding var username: String

    var body: some View {
        VStack {
            Text("User Profile")
            Button("Toggle Edit") {
                isEditing.toggle()
            }
            Button("Save Profile") {
                save()
            }
        }
    }

    func save() {
        print("Saved")
    }

    func reset(to defaultName: String) -> Bool {
        return true
    }
}
`;

  test('parseSwiftASTFile extracts struct type, kind, properties, and methods', () => {
    const ast = parseSwiftASTFile(sampleSwiftView, 'TestProfileView.swift');
    assert.strictEqual(ast.typeName, 'TestProfileView');
    assert.strictEqual(ast.kind, 'view');
    assert.strictEqual(ast.startLine, 3);
    assert.ok(ast.endLine >= 25);

    // Properties
    assert.strictEqual(ast.properties.length, 3);
    const isEditing = ast.properties.find((p) => p.name === 'isEditing');
    assert.ok(isEditing);
    assert.strictEqual(isEditing.decorator, '@State');
    assert.strictEqual(isEditing.isState, true);

    const modelData = ast.properties.find((p) => p.name === 'modelData');
    assert.ok(modelData);
    assert.strictEqual(modelData.decorator, '@Environment');

    // Methods
    const saveMethod = ast.methods.find((m) => m.name === 'save');
    assert.ok(saveMethod);
    assert.strictEqual(saveMethod.direction, 'input');

    const resetMethod = ast.methods.find((m) => m.name === 'reset');
    assert.ok(resetMethod);
    assert.ok(resetMethod.typeAnnotation.includes('defaultName: String'));

    // View Elements
    assert.strictEqual(ast.viewElements.length, 2);
    assert.strictEqual(ast.viewElements[0].label, 'Toggle Edit');
    assert.strictEqual(ast.viewElements[1].label, 'Save Profile');
  });

  test('parseSwiftASTFile detects Observable ViewModel and App types', () => {
    const vmSource = `import Foundation
@Observable
class UserViewModel: ObservableObject {
    var count = 0
    func increment() {}
}
`;
    const vmAst = parseSwiftASTFile(vmSource, 'UserViewModel.swift');
    assert.strictEqual(vmAst.kind, 'viewModel');
    assert.strictEqual(vmAst.typeName, 'UserViewModel');

    const appSource = `import SwiftUI
@main
struct LandmarksApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
`;
    const appAst = parseSwiftASTFile(appSource, 'LandmarksApp.swift');
    assert.strictEqual(appAst.kind, 'app');
  });

  test('reconcileSwiftASTChange updates graph node line spans and properties while preserving visual canvasMeta', () => {
    const mockGraph = {
      nodes: {
        node_testprofileview: {
          id: 'node_testprofileview',
          name: 'TestProfileView',
          kind: 'view',
          canvasMeta: {
            position: { x: 350, y: 420 },
            isCollapsed: false
          },
          sourceAnchor: {
            filePath: 'Landmarks/Views/TestProfileView.swift',
            startLine: 1,
            endLine: 10
          },
          properties: []
        }
      },
      edges: {}
    };

    // Use Landmarks actual file to test real filesystem reconciliation
    const actualFilePath = path.resolve(__dirname, '../../../benchmarks/Landmarks/Landmarks/Views/Categories/CategoryHome.swift');
    const mockProject = {
      id: 'landmarks',
      sourceDir: path.resolve(__dirname, '../../../benchmarks/Landmarks')
    };

    const graphWithLandmark = {
      nodes: {
        node_categoryhome: {
          id: 'node_categoryhome',
          name: 'CategoryHome',
          kind: 'view',
          canvasMeta: {
            position: { x: 120, y: 250 },
            isCollapsed: false
          },
          sourceAnchor: {
            filePath: 'Landmarks/Views/Categories/CategoryHome.swift',
            startLine: 1,
            endLine: 20
          },
          properties: []
        }
      },
      edges: {}
    };

    const res = reconcileSwiftASTChange(actualFilePath, graphWithLandmark, mockProject);
    assert.strictEqual(res.updated, true);
    assert.strictEqual(res.nodeId, 'node_categoryhome');

    // Preserved canvasMeta
    assert.strictEqual(res.node.canvasMeta.position.x, 120);
    assert.strictEqual(res.node.canvasMeta.position.y, 250);

    // Reconciled start and end lines
    assert.ok(res.node.sourceAnchor.endLine > 20);
    assert.ok(res.node.sourceAnchor.startLine >= 1);
  });

  test('parseSwiftASTFile and reconcileSwiftASTChange extract TabView Labels and sync struct rename', () => {
    const tabSource = `import SwiftUI

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
    const ast = parseSwiftASTFile(tabSource, 'ContentView.swift');
    assert.strictEqual(ast.typeName, 'ContenttttView');
    assert.strictEqual(ast.viewElements.length, 2);
    assert.strictEqual(ast.viewElements[0].type, 'tab');
    assert.strictEqual(ast.viewElements[0].label, 'ALBANNNN');
    assert.strictEqual(ast.viewElements[0].systemImage, 'star');
    assert.strictEqual(ast.viewElements[0].tag, 'featured');
    assert.strictEqual(ast.viewElements[1].label, 'List');

    // Test reconciliation updating node.name and node.viewElements in a hermetic temp file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swift-ast-test-'));
    const tmpFile = path.join(tmpDir, 'ContentView.swift');
    fs.writeFileSync(tmpFile, tabSource, 'utf8');

    const mockGraph = {
      nodes: {
        node_contentview: {
          id: 'node_contentview',
          name: 'ContentView',
          kind: 'view',
          canvasMeta: { position: { x: 400, y: 500 } },
          sourceAnchor: {
            filePath: 'ContentView.swift',
            symbolPath: 'ContentView'
          }
        }
      }
    };

    const mockProject = {
      id: 'test_project',
      sourceDir: tmpDir
    };

    try {
      const res = reconcileSwiftASTChange(tmpFile, mockGraph, mockProject);
      assert.strictEqual(res.updated, true);
      assert.strictEqual(res.node.name, 'ContenttttView');
      assert.strictEqual(res.node.sourceAnchor.symbolPath, 'ContenttttView');
      assert.ok(res.node.viewElements.length >= 2);
      const albanTab = res.node.viewElements.find((e) => e.label === 'ALBANNNN');
      assert.ok(albanTab, 'Should have extracted ALBANNNN tab label');
      assert.strictEqual(albanTab.type, 'tab');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
