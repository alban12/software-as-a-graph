import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decomposeAppTree,
  getNodeDimensions,
  detectCollisions,
  rearrangeNodes,
  computeAdaptiveTreeLayout,
  isSystemDesignNode
} from '../src/analysis/treeEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

test.describe('App Tree Decomposition & Dynamic Layout Engine', () => {
  const landmarksGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/landmarks-graph.json'), 'utf8')
  );
  const makeItSoGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'benchmarks/makeitso-graph.json'), 'utf8')
  );
  const authSampleGraph = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, 'examples/ios-auth-sample/.saag/graph.json'), 'utf8')
  );

  test('Landmarks: decomposeAppTree identifies Root App, Container, and Tab Branches', () => {
    const tree = decomposeAppTree(landmarksGraph);

    assert.ok(tree.rootAppNode, 'Identifies root app node');
    assert.strictEqual(tree.rootAppNode.name, 'LandmarksApp');

    assert.ok(tree.containerNode, 'Identifies shell container node');
    assert.strictEqual(tree.containerNode.name, 'ContentView');

    assert.ok(tree.branches.length >= 2, `Expected at least 2 branches, got ${tree.branches.length}`);
    const branchTitles = tree.branches.map((b) => b.title);
    assert.ok(branchTitles.includes('Featured'), 'Contains Featured tab branch');
    assert.ok(branchTitles.includes('List'), 'Contains List tab branch');

    assert.ok(tree.stateShelfNodes.length > 0, 'Separates shared state stores to shelf');
    const storeNames = tree.stateShelfNodes.map((n) => n.name);
    assert.ok(storeNames.includes('ModelData'), 'Elevates ModelData to state shelf');
  });

  test('getNodeDimensions: Accurately sizes views, previews, and squeezed nodes', () => {
    const squeezedNode = { isSqueezed: true };
    assert.deepStrictEqual(getNodeDimensions(squeezedNode), { width: 220, height: 56 });

    const previewView = {
      kind: 'view',
      canvasMeta: { showPreview: true },
      stateProps: [{ name: 'state1' }, { name: 'state2' }]
    };
    const dim = getNodeDimensions(previewView);
    assert.strictEqual(dim.width, 310);
    assert.ok(dim.height >= 480, `Expected preview view height >= 480px, got ${dim.height}`);

    const serviceNode = { kind: 'service', serviceMeta: { provider: 'Firebase' } };
    assert.deepStrictEqual(getNodeDimensions(serviceNode), { width: 280, height: 210 });
  });

  test('Landmarks: computeAdaptiveTreeLayout guarantees 0 collisions at L1 Journey', () => {
    const tree = decomposeAppTree(landmarksGraph);
    const l1Nodes = Object.values(landmarksGraph.nodes).filter((n) => n.level === 'L1_SCREEN');
    const positions = computeAdaptiveTreeLayout(l1Nodes, tree, landmarksGraph);

    const nodeMap = {};
    l1Nodes.forEach((n) => { nodeMap[n.id] = n; });

    const collisions = detectCollisions(positions, nodeMap, 20, 20);
    assert.deepStrictEqual(collisions, [], 'Zero collisions in L1 adaptive layout');
  });

  test('Landmarks: computeAdaptiveTreeLayout guarantees 0 collisions at L2 Components and L3 Details', () => {
    const tree = decomposeAppTree(landmarksGraph);

    // L2
    const l2Nodes = Object.values(landmarksGraph.nodes).filter((n) => n.level !== 'L3_PRIMITIVE');
    const l2Positions = computeAdaptiveTreeLayout(l2Nodes, tree, landmarksGraph);
    const nodeMap2 = {};
    l2Nodes.forEach((n) => { nodeMap2[n.id] = n; });
    assert.deepStrictEqual(detectCollisions(l2Positions, nodeMap2, 20, 20), [], 'Zero collisions in L2 layout');

    // L3
    const l3Nodes = Object.values(landmarksGraph.nodes);
    const l3Positions = computeAdaptiveTreeLayout(l3Nodes, tree, landmarksGraph);
    const nodeMap3 = {};
    l3Nodes.forEach((n) => { nodeMap3[n.id] = n; });
    assert.deepStrictEqual(detectCollisions(l3Positions, nodeMap3, 20, 20), [], 'Zero collisions in L3 layout');
  });

  test('Elastic AABB relaxation: rearrangeNodes resolves forced collisions', () => {
    const overlappingPositions = {
      node_a: { x: 500, y: 500 },
      node_b: { x: 520, y: 510 } // severely overlapping node_a!
    };
    const nodeMap = {
      node_a: { id: 'node_a', kind: 'view' },
      node_b: { id: 'node_b', kind: 'view' }
    };

    const initialCollisions = detectCollisions(overlappingPositions, nodeMap, 20, 20);
    assert.ok(initialCollisions.length > 0, 'Detected forced overlap');

    const result = rearrangeNodes(overlappingPositions, nodeMap, 'node_b', {
      paddingX: 40,
      paddingY: 40,
      maxIterations: 20
    });

    const finalCollisions = detectCollisions(result.positions, nodeMap, 20, 20);
    assert.deepStrictEqual(finalCollisions, [], 'rearrangeNodes successfully nudged nodes apart to 0 overlaps');
  });

  test('Zero Collisions across ALL Benchmark Applications (Landmarks, MakeItSo, AuthSample)', () => {
    const benchmarks = [
      { name: 'Landmarks', graph: landmarksGraph },
      { name: 'MakeItSo', graph: makeItSoGraph },
      { name: 'AuthSample', graph: authSampleGraph }
    ];

    for (const b of benchmarks) {
      const tree = decomposeAppTree(b.graph);
      const allNodes = Object.values(b.graph.nodes);
      const nodeMap = {};
      allNodes.forEach((n) => { nodeMap[n.id] = n; });

      const positions = tree.treePositions;
      const collisions = detectCollisions(positions, nodeMap, 20, 20);
      assert.deepStrictEqual(
        collisions,
        [],
        `Benchmark ${b.name} must have 0 collisions in full tree positions`
      );
    }
  });

  test('isSystemDesignNode: Filters Xcode test runners, drawing math, and leaf micro-widgets', () => {
    // Should remove test suites
    assert.strictEqual(isSystemDesignNode({ name: 'LandmarksTests' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'MacLandmarksUITestsLaunchTests' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'AuthSampleTests' }), false);

    // Should remove drawing/vector math helpers
    assert.strictEqual(isSystemDesignNode({ name: 'BadgeBackground' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'HexagonParameters' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'Coordinates' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'GraphCapsule' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'TextOverlay' }), false);

    // Should remove SwiftUI environment keys and command glue
    assert.strictEqual(isSystemDesignNode({ name: 'SelectedLandmarkKey' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'LandmarkCommands' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'Observation' }), false);

    // Should remove leaf micro-widgets
    assert.strictEqual(isSystemDesignNode({ name: 'CircleImage' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'FavoriteButton' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'PageControl' }), false);
    assert.strictEqual(isSystemDesignNode({ name: 'CategoryItem' }), false);

    // Should preserve core system architecture components
    assert.strictEqual(isSystemDesignNode({ name: 'LandmarksApp' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'ContentView' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'CategoryHome' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'LandmarkList' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'LandmarkDetail' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'ModelData' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'ProfileHost' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'AuthViewModel' }), true);
    assert.strictEqual(isSystemDesignNode({ name: 'KeychainStorage' }), true);
  });

  test('Vertical Top-to-Bottom Flow: rootAppNode.y < containerNode.y < branchRoots.y', () => {
    const tree = decomposeAppTree(landmarksGraph);
    const rootPos = tree.treePositions[tree.rootAppNode.id];
    const containerPos = tree.treePositions[tree.containerNode.id];

    assert.ok(rootPos, 'Root position exists');
    assert.ok(containerPos, 'Container position exists');

    // Root App must be at top (y = 40)
    assert.strictEqual(rootPos.y, 40, 'Root App starts at the top (y = 40)');

    // Container directly beneath root
    assert.ok(containerPos.y > rootPos.y, `Container (${containerPos.y}) must be below Root App (${rootPos.y})`);

    // All primary tab branch roots must be below the container
    tree.branches.forEach((branch) => {
      const firstNode = branch.nodes[0]?.node;
      if (firstNode) {
        const branchPos = tree.treePositions[firstNode.id];
        assert.ok(
          branchPos.y > containerPos.y,
          `Branch ${branch.title} root (${branchPos.y}) must be below Container (${containerPos.y})`
        );
      }
    });
  });

  test('computeAdaptiveTreeLayout preserves Top-to-Bottom vertical flow', () => {
    const tree = decomposeAppTree(landmarksGraph);
    const l1Nodes = Object.values(landmarksGraph.nodes).filter(
      (n) => n.level === 'L1_SCREEN' && isSystemDesignNode(n)
    );
    const positions = computeAdaptiveTreeLayout(l1Nodes, tree, landmarksGraph);

    const rootY = positions[tree.rootAppNode.id]?.y;
    const containerY = positions[tree.containerNode.id]?.y;

    assert.strictEqual(rootY, 40, 'Root node at top (y = 40)');
    assert.ok(containerY > rootY, 'Container below root node');

    const featuredBranchRoot = tree.branches.find((b) => b.title === 'Featured')?.nodes[0]?.node;
    if (featuredBranchRoot && positions[featuredBranchRoot.id]) {
      assert.ok(
        positions[featuredBranchRoot.id].y > containerY,
        'Featured branch root must cascade below container node'
      );
    }
  });
});
