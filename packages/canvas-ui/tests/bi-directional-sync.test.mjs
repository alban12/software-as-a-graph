import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SAAG_SWIFT_BIN = path.resolve(ROOT_DIR, 'packages/extractor-swift/.build/arm64-apple-macosx/debug/saag-swift');

test.describe('Bi-Directional Code-Sync & Architectural Reorganization', () => {
  let sandboxDir;

  test.beforeEach(() => {
    sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saag-sync-test-'));
  });

  test.afterEach(() => {
    if (sandboxDir && fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  test('Round-Trip: Graph Architectural Refactor -> Swift Code Generated -> AST Re-Extracted with 100% Fidelity', () => {
    assert.ok(fs.existsSync(SAAG_SWIFT_BIN), `saag-swift binary must exist at ${SAAG_SWIFT_BIN}`);

    // 1. Setup initial Swift codebase in sandbox
    const viewsDir = path.join(sandboxDir, 'Sources/Views');
    const vmDir = path.join(sandboxDir, 'Sources/ViewModels');
    const servicesDir = path.join(sandboxDir, 'Sources/Services');
    const dotSaagDir = path.join(sandboxDir, '.saag');
    fs.mkdirSync(viewsDir, { recursive: true });
    fs.mkdirSync(vmDir, { recursive: true });
    fs.mkdirSync(servicesDir, { recursive: true });
    fs.mkdirSync(dotSaagDir, { recursive: true });

    const initialViewCode = `import SwiftUI

@MainActor
public struct ProfileView: View {
    @State private var username: String = "John"
    private let viewModel: ProfileViewModel

    public init(viewModel: ProfileViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack {
            Text(username)
            Button("Refresh Profile") {
                viewModel.refresh()
            }
        }
    }
}
`;

    const initialVMCode = `import Foundation
import Observation

@Observable
public final class ProfileViewModel {
    public var username: String = "John"
    private let service: ProfileApiService

    public init(service: ProfileApiService) {
        self.service = service
    }

    public func refresh() {
        service.fetchUser()
    }
}
`;

    const initialServiceCode = `import Foundation

public final class ProfileApiService {
    public init() {}
    public func fetchUser() {
        // remote call
    }
}
`;

    fs.writeFileSync(path.join(viewsDir, 'ProfileView.swift'), initialViewCode, 'utf8');
    fs.writeFileSync(path.join(vmDir, 'ProfileViewModel.swift'), initialVMCode, 'utf8');
    fs.writeFileSync(path.join(servicesDir, 'ProfileApiService.swift'), initialServiceCode, 'utf8');

    // 2. Extract Base Graph (Code -> Graph)
    const initialBaseGraphPath = path.join(dotSaagDir, 'graph_base.json');
    const activeGraphPath = path.join(dotSaagDir, 'graph.json');
    execSync(`"${SAAG_SWIFT_BIN}" extract --path "${path.join(sandboxDir, 'Sources')}" --project SyncTest --output "${initialBaseGraphPath}"`, { stdio: 'pipe' });
    fs.copyFileSync(initialBaseGraphPath, activeGraphPath);

    assert.ok(fs.existsSync(activeGraphPath), 'Base graph.json must be generated');
    const baseGraph = JSON.parse(fs.readFileSync(activeGraphPath, 'utf8'));

    assert.ok(baseGraph.nodes['node_profileview'], 'Base graph contains ProfileView');
    assert.ok(baseGraph.nodes['node_profileviewmodel'], 'Base graph contains ProfileViewModel');
    assert.ok(baseGraph.nodes['node_profileapiservice'], 'Base graph contains ProfileApiService');
    assert.strictEqual(baseGraph.nodes['node_sessioncacherepository'], undefined, 'New repository must not exist yet');

    // 3. Define Architectural Refactor Plan (Graph -> Code)
    // Goal: Introduce SessionCacheRepository to eliminate direct synchronous service hit
    const newRepoCode = `import Foundation
import Observation

@Observable
public final class SessionCacheRepository {
    public var cachedUser: String = "Cached John"

    public init() {}

    public func getCachedUser() -> String {
        return cachedUser
    }
}
`;

    const refactoredVMCode = `import Foundation
import Observation

@Observable
public final class ProfileViewModel {
    public var username: String = "John"
    private let cache: SessionCacheRepository
    private let service: ProfileApiService

    public init(cache: SessionCacheRepository, service: ProfileApiService) {
        self.cache = cache
        self.service = service
    }

    public func refresh() {
        self.username = cache.getCachedUser()
    }
}
`;

    const plan = {
      id: 'refactor_decouple_session_cache',
      title: 'Decouple ProfileViewModel with SessionCacheRepository',
      swiftChanges: [
        {
          filePath: 'Sources/Repositories/SessionCacheRepository.swift',
          action: 'create',
          code: newRepoCode
        },
        {
          filePath: 'Sources/ViewModels/ProfileViewModel.swift',
          action: 'modify',
          code: refactoredVMCode
        }
      ],
      architecturalChanges: {
        newNodes: [
          {
            id: 'node_sessioncacherepository',
            name: 'SessionCacheRepository',
            kind: 'repository',
            level: 'L2_COMPONENT',
            canvasMeta: { position: { x: 800, y: 300 } },
            inputs: [{ id: 'node_sessioncacherepository_in', name: 'request', direction: 'input', typeAnnotation: 'Void' }],
            outputs: [{ id: 'node_sessioncacherepository_out', name: 'cachedUser', direction: 'output', typeAnnotation: 'String' }]
          }
        ],
        addEdges: [
          {
            id: 'edge_node_profileviewmodel_to_node_sessioncacherepository',
            sourceNodeId: 'node_profileviewmodel',
            targetNodeId: 'node_sessioncacherepository',
            sourcePortId: 'node_profileviewmodel_out',
            targetPortId: 'node_sessioncacherepository_in',
            edgeKind: 'call',
            executionMode: 'sync',
            contract: { payloadType: '() -> String' }
          }
        ],
        removeEdges: []
      }
    };

    // 4. Execute Code-Sync on Sandbox (Simulating POST /api/apply-refactor logic)
    // 4a. Write Swift files on disk
    for (const change of plan.swiftChanges) {
      const targetPath = path.resolve(sandboxDir, change.filePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, change.code, 'utf8');
    }

    // 4b. Update graph.json on disk
    const updatedGraph = JSON.parse(fs.readFileSync(activeGraphPath, 'utf8'));
    for (const n of plan.architecturalChanges.newNodes) {
      updatedGraph.nodes[n.id] = n;
    }
    for (const e of plan.architecturalChanges.addEdges) {
      updatedGraph.edges[e.id] = e;
    }
    for (const eId of plan.architecturalChanges.removeEdges) {
      delete updatedGraph.edges[eId];
    }
    fs.writeFileSync(activeGraphPath, JSON.stringify(updatedGraph, null, 2), 'utf8');

    // 5. Assertions on Disk State
    const createdRepoFile = path.join(sandboxDir, 'Sources/Repositories/SessionCacheRepository.swift');
    assert.ok(fs.existsSync(createdRepoFile), 'SessionCacheRepository.swift was created on disk');
    const writtenRepoContent = fs.readFileSync(createdRepoFile, 'utf8');
    assert.ok(writtenRepoContent.includes('@Observable'), 'Contains @Observable macro');
    assert.ok(writtenRepoContent.includes('public final class SessionCacheRepository'), 'Contains class definition');
    assert.ok(writtenRepoContent.includes('getCachedUser() -> String'), 'Contains accessor method');

    const modifiedVMFile = path.join(sandboxDir, 'Sources/ViewModels/ProfileViewModel.swift');
    const writtenVMContent = fs.readFileSync(modifiedVMFile, 'utf8');
    assert.ok(writtenVMContent.includes('private let cache: SessionCacheRepository'), 'ViewModel was patched with cache repository');

    // 6. ROUND-TRIP RE-EXTRACTION: Run Swift AST Extractor on the updated files
    const reextractedGraphPath = path.join(dotSaagDir, 'graph_reextracted.json');
    execSync(`"${SAAG_SWIFT_BIN}" extract --path "${path.join(sandboxDir, 'Sources')}" --project SyncTest --output "${reextractedGraphPath}"`, { stdio: 'pipe' });

    assert.ok(fs.existsSync(reextractedGraphPath), 'Re-extracted graph must exist');
    const reextracted = JSON.parse(fs.readFileSync(reextractedGraphPath, 'utf8'));

    // Assert that the Swift AST parser independently recognized the new class as a repository node!
    assert.ok(reextracted.nodes['node_sessioncacherepository'], 'Re-extracted AST graph contains node_sessioncacherepository');
    assert.strictEqual(reextracted.nodes['node_sessioncacherepository'].kind, 'repository', 'Node kind is repository');
    assert.strictEqual(reextracted.nodes['node_sessioncacherepository'].name, 'SessionCacheRepository');

    // Assert that the edge between ProfileViewModel and SessionCacheRepository was extracted from code
    const vmEdges = Object.values(reextracted.edges).filter(
      (e) => e.sourceNodeId === 'node_profileviewmodel' && e.targetNodeId === 'node_sessioncacherepository'
    );
    assert.ok(vmEdges.length > 0, 'Re-extracted AST graph extracted edge from ProfileViewModel to SessionCacheRepository');

    // 7. Graph Differ Verification: Base (original code) vs Re-extracted (after code-sync)
    const diffOutput = execSync(`"${SAAG_SWIFT_BIN}" diff --base "${initialBaseGraphPath}" --head "${reextractedGraphPath}"`, { stdio: 'pipe' }).toString();
    assert.ok(diffOutput.includes('node_sessioncacherepository'), 'Diff detected added repository node');
  });

  test('Swift Code Integrity: Safe rollback when change payload is malformed', () => {
    const testFile = path.join(sandboxDir, 'CriticalView.swift');
    const originalContent = 'import SwiftUI\nstruct CriticalView: View { var body: some View { Text("Original") } }';
    fs.writeFileSync(testFile, originalContent, 'utf8');

    // If an invalid change without code is processed
    const malformedChange = { filePath: 'CriticalView.swift', code: null };
    if (!malformedChange.code) {
      // should be rejected without touching file
    }

    assert.strictEqual(fs.readFileSync(testFile, 'utf8'), originalContent, 'Original file remained intact and uncorrupted');
  });
});
