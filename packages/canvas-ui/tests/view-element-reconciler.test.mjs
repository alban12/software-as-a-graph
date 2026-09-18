import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test.describe('In-Place AST ViewElement Reconciler', () => {
  let sandboxDir;

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-reconciler-test-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  // Reconciler implementation matching server.js logic
  function reconcileViewElement({ filePath, elementId, oldLabel, newLabel, lineSpan, graphPath }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source file not found at: ${filePath}`);
    }

    let sourceContent = fs.readFileSync(filePath, 'utf8');
    const sourceLines = sourceContent.split('\n');

    let updated = false;
    const startLine = lineSpan?.startLine ? lineSpan.startLine - 1 : 0;
    const endLine = lineSpan?.endLine ? lineSpan.endLine : sourceLines.length;

    // Scan strictly within the specified lineSpan
    for (let i = startLine; i < Math.min(endLine, sourceLines.length); i++) {
      if (oldLabel && sourceLines[i].includes(`"${oldLabel}"`)) {
        sourceLines[i] = sourceLines[i].replace(`"${oldLabel}"`, `"${newLabel}"`);
        updated = true;
        break;
      }
    }

    // Fallback if not found in lineSpan
    if (!updated && oldLabel && sourceContent.includes(`"${oldLabel}"`)) {
      sourceContent = sourceContent.replace(`"${oldLabel}"`, `"${newLabel}"`);
      updated = true;
    } else if (updated) {
      sourceContent = sourceLines.join('\n');
    }

    if (!updated) {
      throw new Error(`Could not find "${oldLabel}" in ${filePath}`);
    }

    fs.writeFileSync(filePath, sourceContent, 'utf8');

    // Update graph.json if provided
    if (graphPath && fs.existsSync(graphPath)) {
      const rawGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      Object.values(rawGraph.nodes || {}).forEach((n) => {
        if (n.viewElements) {
          n.viewElements = n.viewElements.map((el) => {
            if (el.id === elementId || el.label === oldLabel) {
              return { ...el, label: newLabel };
            }
            return el;
          });
        }
      });
      fs.writeFileSync(graphPath, JSON.stringify(rawGraph, null, 2), 'utf8');
    }

    return { success: true, updated: true, newLabel };
  }

  test('Reconciles SwiftUI Button label accurately within AST lineSpan', () => {
    const swiftFile = path.join(sandboxDir, 'LoginView.swift');
    const swiftCode = `import SwiftUI

public struct LoginView: View {
    @State private var email = ""

    public var body: some View {
        VStack(spacing: 16) {
            TextField("Enter your email", text: $email)
                .textFieldStyle(.roundedBorder)

            Button("Sign In") {
                // handle login
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
`;
    fs.writeFileSync(swiftFile, swiftCode, 'utf8');

    const result = reconcileViewElement({
      filePath: swiftFile,
      elementId: 'el_btn_signin',
      oldLabel: 'Sign In',
      newLabel: 'Continue with Apple',
      lineSpan: { startLine: 10, endLine: 14 }
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.newLabel, 'Continue with Apple');

    const updatedCode = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(updatedCode.includes('Button("Continue with Apple")'), 'Button label was updated');
    assert.ok(!updatedCode.includes('Button("Sign In")'), 'Old label is removed');
    assert.ok(updatedCode.includes('.buttonStyle(.borderedProminent)'), 'Surrounding modifiers preserved');
    assert.ok(updatedCode.includes('TextField("Enter your email", text: $email)'), 'Other elements untouched');
  });

  test('Disambiguates identical labels using AST lineSpan targeting', () => {
    const swiftFile = path.join(sandboxDir, 'CheckoutView.swift');
    // Two buttons with identical label "Submit" on line 8 and line 18
    const swiftCode = `import SwiftUI

struct CheckoutView: View {
    var body: some View {
        VStack {
            Section("Step 1") {
                Button("Submit") { step1() }
            }
            Section("Step 2") {
                Button("Submit") { step2() }
            }
        }
    }
}
`;
    fs.writeFileSync(swiftFile, swiftCode, 'utf8');

    // Only target the second button (around lines 9-13)
    reconcileViewElement({
      filePath: swiftFile,
      elementId: 'el_btn_submit_step2',
      oldLabel: 'Submit',
      newLabel: 'Confirm Order',
      lineSpan: { startLine: 9, endLine: 13 }
    });

    const updatedLines = fs.readFileSync(swiftFile, 'utf8').split('\n');
    // Line index 6 (line 7): first "Submit" should remain unchanged!
    assert.ok(updatedLines[6].includes('Button("Submit")'), 'Step 1 button still has Submit');
    // Line index 9 (line 10): second "Submit" should be changed!
    assert.ok(updatedLines[9].includes('Button("Confirm Order")'), 'Step 2 button updated to Confirm Order');
  });

  test('Synchronizes graph.json viewElements in tandem with Swift file', () => {
    const swiftFile = path.join(sandboxDir, 'SettingsView.swift');
    const graphFile = path.join(sandboxDir, 'graph.json');

    fs.writeFileSync(swiftFile, 'struct SettingsView: View { var body: some View { Text("Version 1.0") } }');
    const initialGraph = {
      schemaVersion: '1.0.0',
      metadata: { projectName: 'Settings', rootPath: '.' },
      nodes: {
        node_settingsview: {
          id: 'node_settingsview',
          name: 'SettingsView',
          kind: 'view',
          viewElements: [
            { id: 'el_text_ver', type: 'text', label: 'Version 1.0' }
          ]
        }
      },
      edges: {}
    };
    fs.writeFileSync(graphFile, JSON.stringify(initialGraph, null, 2));

    reconcileViewElement({
      filePath: swiftFile,
      elementId: 'el_text_ver',
      oldLabel: 'Version 1.0',
      newLabel: 'Version 2.0 (Build 42)',
      graphPath: graphFile
    });

    const updatedGraph = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    assert.strictEqual(
      updatedGraph.nodes.node_settingsview.viewElements[0].label,
      'Version 2.0 (Build 42)',
      'Graph viewElement label was synchronized'
    );
  });
});
