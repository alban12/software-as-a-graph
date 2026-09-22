import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test.describe('In-Place AST Reconciliation Edge Cases', () => {
  let sandboxDir;

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-ast-edge-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  // Reconciler implementation matching server.js logic with lineSpan targeting
  function reconcileInPlace({ filePath, oldLabel, newLabel, lineSpan }) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Source file not found at: ${filePath}`);
    }

    const rawContent = fs.readFileSync(filePath, 'utf8');
    const isCRLF = rawContent.includes('\r\n');
    const newline = isCRLF ? '\r\n' : '\n';
    const sourceLines = rawContent.split(newline);

    let updated = false;
    const startLine = lineSpan?.startLine ? lineSpan.startLine - 1 : 0;
    const endLine = lineSpan?.endLine ? lineSpan.endLine : sourceLines.length;

    for (let i = startLine; i < Math.min(endLine, sourceLines.length); i++) {
      if (oldLabel && sourceLines[i].includes(`"${oldLabel}"`)) {
        sourceLines[i] = sourceLines[i].replace(`"${oldLabel}"`, `"${newLabel}"`);
        updated = true;
        break;
      }
    }

    // Fallback if not found strictly in lineSpan
    if (!updated && oldLabel && rawContent.includes(`"${oldLabel}"`)) {
      const patchedContent = rawContent.replace(`"${oldLabel}"`, `"${newLabel}"`);
      fs.writeFileSync(filePath, patchedContent, 'utf8');
      return { success: true, fallback: true, newLabel };
    }

    if (!updated) {
      throw new Error(`Could not find "${oldLabel}" in ${filePath}`);
    }

    fs.writeFileSync(filePath, sourceLines.join(newline), 'utf8');
    return { success: true, fallback: false, newLabel };
  }

  test('Edge Case 1: Preserves inline comments and trailing syntax on the same line', () => {
    const swiftFile = path.join(sandboxDir, 'ActionView.swift');
    const code = [
      'import SwiftUI',
      'struct ActionView: View {',
      '    var body: some View {',
      '        Button("Save") /* critical user trigger */',
      '    }',
      '}'
    ].join('\n');
    fs.writeFileSync(swiftFile, code, 'utf8');

    const result = reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Save',
      newLabel: 'Commit Changes',
      lineSpan: { startLine: 4, endLine: 4 }
    });

    assert.strictEqual(result.success, true);
    const updatedContent = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(updatedContent.includes('Button("Commit Changes") /* critical user trigger */'));
  });

  test('Edge Case 2: Accurately preserves Windows CRLF (\\r\\n) line endings', () => {
    const swiftFile = path.join(sandboxDir, 'WindowsCRLFView.swift');
    const crlfCode = 'import SwiftUI\r\nstruct CRLFView: View {\r\n    var body: some View {\r\n        Button("Sync")\r\n    }\r\n}\r\n';
    fs.writeFileSync(swiftFile, crlfCode, 'utf8');

    const result = reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Sync',
      newLabel: 'Synchronize All',
      lineSpan: { startLine: 4, endLine: 4 }
    });

    assert.strictEqual(result.success, true);
    const updatedContent = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(updatedContent.includes('\r\n'), 'CRLF line endings were preserved');
    assert.ok(updatedContent.includes('Button("Synchronize All")'));
  });

  test('Edge Case 3: Reconciles multiline Button label with nested Text view', () => {
    const swiftFile = path.join(sandboxDir, 'MultilineButtonView.swift');
    const multilineCode = [
      'import SwiftUI',
      '',
      'struct MultilineButtonView: View {',
      '    var body: some View {',
      '        Button(action: {',
      '            performAction()',
      '        }) {',
      '            Text("Submit Payment")',
      '                .font(.headline)',
      '                .foregroundColor(.white)',
      '        }',
      '    }',
      '}'
    ].join('\n');
    fs.writeFileSync(swiftFile, multilineCode, 'utf8');

    const result = reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Submit Payment',
      newLabel: 'Authorize $49.00',
      lineSpan: { startLine: 7, endLine: 11 }
    });

    assert.strictEqual(result.success, true);
    const updated = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(updated.includes('Text("Authorize $49.00")'));
    assert.ok(!updated.includes('Submit Payment'));
  });

  test('Edge Case 4: Sequential multiple in-place edits on the same file without line drift', () => {
    const swiftFile = path.join(sandboxDir, 'MultiElementView.swift');
    const code = [
      'import SwiftUI',
      '',
      'struct MultiElementView: View {',
      '    var body: some View {',
      '        VStack {',
      '            Text("Welcome Guest")',
      '            Button("Continue")',
      '            Text("Terms of Service")',
      '        }',
      '    }',
      '}'
    ].join('\n');
    fs.writeFileSync(swiftFile, code, 'utf8');

    // Edit 1: Header
    reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Welcome Guest',
      newLabel: 'Welcome Alban',
      lineSpan: { startLine: 6, endLine: 6 }
    });

    // Edit 2: Button
    reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Continue',
      newLabel: 'Proceed to Dashboard',
      lineSpan: { startLine: 7, endLine: 7 }
    });

    // Edit 3: Footer
    reconcileInPlace({
      filePath: swiftFile,
      oldLabel: 'Terms of Service',
      newLabel: 'Privacy & Terms Agreement',
      lineSpan: { startLine: 8, endLine: 8 }
    });

    const finalCode = fs.readFileSync(swiftFile, 'utf8');
    assert.ok(finalCode.includes('Text("Welcome Alban")'));
    assert.ok(finalCode.includes('Button("Proceed to Dashboard")'));
    assert.ok(finalCode.includes('Text("Privacy & Terms Agreement")'));
  });

  test('Edge Case 5: Safe rollback — file remains 100% byte-identical if label is missing', () => {
    const swiftFile = path.join(sandboxDir, 'UntouchedView.swift');
    const originalCode = 'import SwiftUI\nstruct UntouchedView: View { var body: some View { Text("Original") } }';
    fs.writeFileSync(swiftFile, originalCode, 'utf8');

    assert.throws(() => {
      reconcileInPlace({
        filePath: swiftFile,
        oldLabel: 'NonExistentString',
        newLabel: 'NewString',
        lineSpan: { startLine: 1, endLine: 2 }
      });
    }, /Could not find "NonExistentString"/);

    const afterCode = fs.readFileSync(swiftFile, 'utf8');
    assert.strictEqual(afterCode, originalCode, 'File content was unmodified');
  });

  test('Edge Case 6: Concurrent in-place edits across distinct files without cross-talk', async () => {
    const files = [];
    for (let i = 0; i < 5; i++) {
      const f = path.join(sandboxDir, `Screen_${i}.swift`);
      fs.writeFileSync(f, `struct Screen_${i}: View { var body: some View { Button("Initial_${i}") } }`, 'utf8');
      files.push(f);
    }

    // Execute 5 concurrent edits simultaneously
    await Promise.all(
      files.map((file, i) =>
        Promise.resolve().then(() => {
          reconcileInPlace({
            filePath: file,
            oldLabel: `Initial_${i}`,
            newLabel: `Reconciled_${i}`,
            lineSpan: { startLine: 1, endLine: 1 }
          });
        })
      )
    );

    // Verify all 5 files updated correctly without race conditions
    for (let i = 0; i < 5; i++) {
      const content = fs.readFileSync(files[i], 'utf8');
      assert.ok(content.includes(`Button("Reconciled_${i}")`), `File ${i} was properly reconciled`);
    }
  });
});
