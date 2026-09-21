/**
 * SaaG App Tree & Tab Decomposition Engine
 * 
 * Transforms a general mobile software graph into a clean, hierarchical
 * Tab-as-a-Branch Tree structure:
 * 
 * Root App -> Shell Container (TabView) -> Tab Branches -> Child Screens -> Subviews
 * 
 * Elevates shared state stores (@Observable, Services) to an isolated State Shelf
/**
 * System Design Node Filter:
 * Abstracts away low-level implementation details that an LLM can take care of
 * (e.g. test harness runner suites, drawing/vector math helpers, SwiftUI environment keys/glue,
 * and leaf micro-widgets) so the canvas represents high-level system architecture.
 */
export function isSystemDesignNode(node) {
  const data = node?.data || node || {};

  // All Agent and ML system architecture nodes are first-class system design nodes
  const nonIosKinds = [
    'agent', 'tool', 'router', 'gate',
    'dataset', 'preprocessor', 'model', 'adapter', 'optimizer', 'hardware', 'interconnect', 'exporter'
  ];
  if (nonIosKinds.includes(data.kind)) {
    return true;
  }

  const name = data.name || '';
  const lower = name.toLowerCase();

  // 1. Exclude test runners and test suites (e.g. LandmarksTests, AuthSampleTests, XCTest suites)
  if (
    lower.includes('test') ||
    lower.includes('launchtests') ||
    lower.includes('xctest')
  ) {
    return false;
  }

  // 2. Exclude trivial drawing math / vector shapes / path helpers
  const drawingHelpers = [
    'badgebackground',
    'badgesymbol',
    'rotatedbadgesymbol',
    'hexagonparameters',
    'coordinates',
    'graphcapsule',
    'textoverlay',
    'segment'
  ];
  if (drawingHelpers.includes(lower)) {
    return false;
  }

  // 3. Exclude SwiftUI environment keys, commands, and observation glue
  if (
    lower.endsWith('key') ||
    lower.endsWith('keys') ||
    lower.endsWith('commands') ||
    lower === 'observation'
  ) {
    return false;
  }

  // 4. Exclude micro-primitives (leaf atomic icons/buttons/controls)
  const microPrimitives = [
    'circleimage',
    'favoritebutton',
    'pagecontrol',
    'categoryitem',
    'hikebadge',
    'hikegraph'
  ];
  if (microPrimitives.includes(lower)) {
    return false;
  }

  return true;
}

/**
 * Node Dimension Calculator:
 * Accounts for whether the node is a view with an interactive preview,
 * a squeezed pass-through capsule, a compound expanded group, or a data store/service.
 */
export function getNodeDimensions(node) {
  const data = node?.data || node || {};
  if (data.isSqueezed) {
    return { width: 220, height: 56 };
  }
  if (data.isCompound && data.isExpanded) {
    const childCount = (data.childNodeIds || []).length;
    return { width: 480, height: Math.max(380, 200 + childCount * 45) };
  }
  const isView = data.kind === 'view';
  const hasPreview = isView && data.canvasMeta?.showPreview !== false;
  const portCount = Math.max((data.inputs || []).length, (data.outputs || []).length, 1);

  if (isView && hasPreview) {
    const propCount = (data.stateProps || []).length;
    const extraPropHeight = propCount > 0 ? Math.min(100, Math.ceil(propCount / 2) * 28) : 0;
    const subviewCount = (data.childNodeIds || []).length;
    const subviewHeight = (data.isCompound && !data.isExpanded && subviewCount > 0) ? 55 : 0;
    return { width: 310, height: 480 + extraPropHeight + subviewHeight };
  }
  if (data.kind === 'hardware') {
    return { width: 330, height: 250 };
  }
  if (data.kind === 'model') {
    return { width: 290, height: Math.max(220, 140 + portCount * 28) };
  }
  if (data.kind === 'agent') {
    return { width: 280, height: Math.max(200, 130 + portCount * 28) };
  }
  if (data.serviceMeta) {
    return { width: 280, height: 210 };
  }
  if (data.kind === 'viewModel') {
    return { width: 280, height: Math.max(210, 130 + portCount * 28) };
  }
  return { width: 270, height: Math.max(170, 110 + portCount * 26) };
}

/**
 * AABB Collision Detector
 */
export function detectCollisions(positions, nodeMap, paddingX = 40, paddingY = 40) {
  const nodeIds = Object.keys(positions);
  const collisions = [];

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const idA = nodeIds[i];
      const idB = nodeIds[j];
      const posA = positions[idA];
      const posB = positions[idB];
      if (!posA || !posB) continue;

      const dimA = getNodeDimensions(nodeMap[idA] || {});
      const dimB = getNodeDimensions(nodeMap[idB] || {});

      const minDistanceX = (dimA.width + dimB.width) / 2 + paddingX;
      const minDistanceY = (dimA.height + dimB.height) / 2 + paddingY;

      const centerAX = posA.x + dimA.width / 2;
      const centerAY = posA.y + dimA.height / 2;
      const centerBX = posB.x + dimB.width / 2;
      const centerBY = posB.y + dimB.height / 2;

      const diffX = centerAX - centerBX;
      const diffY = centerAY - centerBY;

      const overlapX = minDistanceX - Math.abs(diffX);
      const overlapY = minDistanceY - Math.abs(diffY);

      if (overlapX > 0 && overlapY > 0) {
        collisions.push({ idA, idB, overlapX, overlapY, diffX, diffY });
      }
    }
  }

  return collisions;
}

/**
 * Dynamic Node Rearrangement & Overlap Resolution Engine:
 * When nodes overlap (e.g. after user drag or expansion), nudges nodes along
 * the axis of least resistance until zero collisions remain.
 */
export function rearrangeNodes(currentPositions, nodeMap, movedNodeId = null, options = {}) {
  const {
    paddingX = 40,
    paddingY = 40,
    maxIterations = 30,
    pushStrength = 0.65
  } = options;

  const positions = {};
  for (const id in currentPositions) {
    if (currentPositions[id]) {
      positions[id] = { ...currentPositions[id] };
    }
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const collisions = detectCollisions(positions, nodeMap, paddingX, paddingY);
    if (collisions.length === 0) {
      return { positions, iterations: iter, solved: true };
    }

    // Prioritize collisions involving the user-dragged node
    collisions.sort((a, b) => {
      const aHasMoved = a.idA === movedNodeId || a.idB === movedNodeId;
      const bHasMoved = b.idA === movedNodeId || b.idB === movedNodeId;
      if (aHasMoved && !bHasMoved) return -1;
      if (!aHasMoved && bHasMoved) return 1;
      return (b.overlapX * b.overlapY) - (a.overlapX * a.overlapY);
    });

    for (const col of collisions) {
      const { idA, idB, overlapX, overlapY, diffX, diffY } = col;

      // Determine push direction: push along axis of smallest overlap
      const pushX = overlapX < overlapY;
      const isMovedA = idA === movedNodeId;
      const isMovedB = idB === movedNodeId;

      if (pushX) {
        const sign = diffX >= 0 ? 1 : -1;
        const delta = overlapX * pushStrength;

        if (isMovedA) {
          positions[idB].x -= sign * delta;
        } else if (isMovedB) {
          positions[idA].x += sign * delta;
        } else {
          positions[idA].x += sign * (delta / 2);
          positions[idB].x -= sign * (delta / 2);
        }
      } else {
        const sign = diffY >= 0 ? 1 : -1;
        const delta = overlapY * pushStrength;

        if (isMovedA) {
          positions[idB].y -= sign * delta;
        } else if (isMovedB) {
          positions[idA].y += sign * delta;
        } else {
          positions[idA].y += sign * (delta / 2);
          positions[idB].y -= sign * (delta / 2);
        }
      }
    }
  }

  const remaining = detectCollisions(positions, nodeMap, paddingX, paddingY);
  return { positions, iterations: maxIterations, solved: remaining.length === 0 };
}

export function decomposeAppTree(graph) {
  if (!graph || !graph.nodes) {
    return {
      rootAppNode: null,
      containerNode: null,
      branches: [],
      stateShelfNodes: [],
      treePositions: {},
      branchMap: {}, // nodeId -> branchId
      treeHierarchy: [] // nested structure for sidebar tree explorer
    };
  }

  const rawNodes = graph.nodes;
  const edges = Object.values(graph.edges || {});
  
  // Filter for system design nodes (abstract away what an LLM handles)
  const nodes = {};
  for (const id in rawNodes) {
    if (isSystemDesignNode(rawNodes[id])) {
      nodes[id] = rawNodes[id];
    }
  }
  let nodeIds = Object.keys(nodes);
  if (nodeIds.length === 0) {
    Object.assign(nodes, rawNodes);
    nodeIds = Object.keys(nodes);
  }

  // 1. Separate App Root, UI Nodes, and Shared Stores / Cloud Services
  const stateShelfNodes = [];
  const uiNodes = {};
  let rootAppNode = null;

  // First pass: find explicit *App view (excluding test suites)
  nodeIds.forEach((id) => {
    const node = nodes[id];
    if (
      (node.name.endsWith('App') || node.name.includes('MainApp')) &&
      !node.name.includes('Test') &&
      !node.name.includes('Mock')
    ) {
      rootAppNode = node;
    }
  });

  nodeIds.forEach((id) => {
    const node = nodes[id];
    if (rootAppNode && node.id === rootAppNode.id) {
      uiNodes[id] = node;
      return;
    }

    const isStateOrService =
      node.kind === 'viewModel' ||
      node.kind === 'service' ||
      node.kind === 'repository' ||
      node.name.includes('Store') ||
      node.name.includes('ModelData') ||
      node.name.includes('Service') ||
      node.name.includes('Repository') ||
      node.name === 'Profile' ||
      node.name === 'Hike' ||
      node.name === 'Landmark' ||
      Boolean(node.serviceMeta);

    if (isStateOrService) {
      stateShelfNodes.push(node);
    } else {
      uiNodes[id] = node;
    }
  });

  // Fallback root if no *App view found
  if (!rootAppNode) {
    const inDegreeMap = {};
    Object.keys(uiNodes).forEach((id) => (inDegreeMap[id] = 0));
    edges.forEach((edge) => {
      if (uiNodes[edge.targetNodeId] && uiNodes[edge.sourceNodeId]) {
        inDegreeMap[edge.targetNodeId] = (inDegreeMap[edge.targetNodeId] || 0) + 1;
      }
    });
    const candidateRoots = Object.keys(uiNodes).filter((id) => inDegreeMap[id] === 0);
    rootAppNode = candidateRoots.length > 0 ? uiNodes[candidateRoots[0]] : Object.values(uiNodes)[0] || Object.values(nodes)[0];
  }

  // 2. Identify Root Navigation Container (e.g. ContentView / MainView)
  let containerNode = null;
  if (rootAppNode) {
    // Look for composition child of Root App
    const outgoingFromRoot = edges.filter(
      (e) => e.sourceNodeId === rootAppNode.id && uiNodes[e.targetNodeId]
    );
    if (outgoingFromRoot.length > 0) {
      containerNode = uiNodes[outgoingFromRoot[0].targetNodeId];
    }
  }

  if (!containerNode) {
    // Look for ContentView
    for (const id in uiNodes) {
      if (uiNodes[id].name === 'ContentView' || uiNodes[id].name === 'MainView' || uiNodes[id].name === 'RootView') {
        containerNode = uiNodes[id];
        break;
      }
    }
  }

  // If still no container or container is root itself, use rootAppNode
  if (!containerNode) {
    containerNode = rootAppNode;
  }

  // Ensure rootAppNode and containerNode are never placed on the state shelf
  const shelfIndex = stateShelfNodes.findIndex((s) => s.id === containerNode?.id);
  if (shelfIndex >= 0) {
    stateShelfNodes.splice(shelfIndex, 1);
    uiNodes[containerNode.id] = containerNode;
  }
  const rootShelfIndex = stateShelfNodes.findIndex((s) => s.id === rootAppNode?.id);
  if (rootShelfIndex >= 0) {
    stateShelfNodes.splice(rootShelfIndex, 1);
    uiNodes[rootAppNode.id] = rootAppNode;
  }

  // 4. Discover Tab Branches & Primary Navigation Roots
  // Scan outgoing composition / navigation edges from the Container
  const branchSeeds = [];
  const edgesFromContainer = edges.filter((e) => e.sourceNodeId === containerNode?.id && uiNodes[e.targetNodeId]);

  edgesFromContainer.forEach((e) => {
    const targetNode = uiNodes[e.targetNodeId];
    if (targetNode && targetNode.id !== rootAppNode?.id && targetNode.id !== containerNode?.id) {
      branchSeeds.push(targetNode);
    }
  });

  // If container had few or no direct children, find all top-level screens
  if (branchSeeds.length === 0) {
    Object.values(uiNodes).forEach((node) => {
      if (
        node.id !== rootAppNode?.id &&
        node.id !== containerNode?.id &&
        (node.level === 'L1_SCREEN' || !node.parentId)
      ) {
        branchSeeds.push(node);
      }
    });
  }

  // Categorize branch seeds into explicit named tab branches
  const branches = [];
  const branchMap = {}; // nodeId -> branchId
  const visitedUiNodeIds = new Set();
  if (rootAppNode) visitedUiNodeIds.add(rootAppNode.id);
  if (containerNode) visitedUiNodeIds.add(containerNode.id);

  // Helper: map known names to human-friendly Tab Labels & Icons
  const getTabMetadata = (seedNode, index) => {
    const name = seedNode.name.toLowerCase();
    if (name.includes('category') || name.includes('feature') || name.includes('home') || name.includes('feed')) {
      return {
        id: `branch_featured_${seedNode.id}`,
        title: 'Featured',
        tabLabel: 'Tab 1: Featured',
        icon: '🌟',
        color: '#f59e0b',
        accentColor: 'rgba(245, 158, 11, 0.2)'
      };
    }
    if (name.includes('list') || name.includes('landmarklist') || name.includes('todo') || name.includes('reminder') || name.includes('task')) {
      return {
        id: `branch_list_${seedNode.id}`,
        title: 'List',
        tabLabel: 'Tab 2: List',
        icon: '📋',
        color: '#38bdf8',
        accentColor: 'rgba(56, 189, 248, 0.2)'
      };
    }
    if (name.includes('profile') || name.includes('modal') || name.includes('host') || name.includes('sheet') || name.includes('settings')) {
      return {
        id: `branch_modal_${seedNode.id}`,
        title: seedNode.name,
        tabLabel: `Modal: ${seedNode.name}`,
        icon: '👤',
        color: '#a855f7',
        accentColor: 'rgba(168, 85, 247, 0.2)'
      };
    }
    return {
      id: `branch_${index + 1}_${seedNode.id}`,
      title: seedNode.name,
      tabLabel: `Tab ${index + 1}: ${seedNode.name}`,
      icon: '📱',
      color: '#10b981',
      accentColor: 'rgba(168, 85, 247, 0.2)'
    };
  };

  // 5. Expand Each Branch into its Descendant Screen Subtree
  branchSeeds.forEach((seedNode, idx) => {
    const meta = getTabMetadata(seedNode, idx);
    const branchNodeIds = [];
    const queue = [{ node: seedNode, depth: 1 }];
    const branchVisited = new Set();

    while (queue.length > 0) {
      const { node, depth } = queue.shift();
      if (branchVisited.has(node.id)) continue;
      branchVisited.add(node.id);
      visitedUiNodeIds.add(node.id);
      branchNodeIds.push({ id: node.id, node, depth });
      branchMap[node.id] = meta.id;

      // Also add explicit compound children if this node has them
      if (node.childNodeIds) {
        node.childNodeIds.forEach((childId) => {
          const childNode = uiNodes[childId];
          if (childNode && !branchVisited.has(childId)) {
            branchVisited.add(childId);
            visitedUiNodeIds.add(childId);
            branchNodeIds.push({ id: childId, node: childNode, depth: depth + 1 });
            branchMap[childId] = meta.id;
          }
        });
      }

      // Traverse outgoing navigation and composition edges
      const outgoing = edges.filter(
        (e) =>
          e.sourceNodeId === node.id &&
          uiNodes[e.targetNodeId] &&
          e.edgeKind !== 'stateBinding' &&
          !branchVisited.has(e.targetNodeId)
      );

      outgoing.forEach((e) => {
        const nextNode = uiNodes[e.targetNodeId];
        if (nextNode && nextNode.id !== containerNode?.id && nextNode.id !== rootAppNode?.id) {
          queue.push({ node: nextNode, depth: depth + 1 });
        }
      });
    }

    branches.push({
      ...meta,
      rootNode: seedNode,
      rootNodeId: seedNode.id,
      nodeCount: branchNodeIds.length,
      nodes: branchNodeIds
    });
  });

  // Capture any remaining UI nodes not reached into an "Auxiliary Views" branch
  const remainingUiNodes = Object.values(uiNodes).filter((n) => !visitedUiNodeIds.has(n.id));
  if (remainingUiNodes.length > 0) {
    const auxMeta = {
      id: 'branch_auxiliary',
      title: 'Components & Shared Subviews',
      tabLabel: 'Auxiliary Views',
      icon: '🧩',
      color: '#94a3b8',
      accentColor: 'rgba(148, 163, 184, 0.2)'
    };
    const auxNodes = remainingUiNodes.map((node, idx) => {
      branchMap[node.id] = auxMeta.id;
      // Distribute across 3 columns (depth 1, 2, 3) for compact 2D packing instead of a single 12-item tower
      const col = (idx % 3) + 1;
      return { id: node.id, node, depth: col };
    });
    branches.push({
      ...auxMeta,
      rootNode: remainingUiNodes[0],
      nodeCount: auxNodes.length,
      nodes: auxNodes
    });
  }

  // 6. Top-to-Bottom Tree View Positions
  const treePositions = {};

  const rootDim = rootAppNode ? getNodeDimensions(rootAppNode) : { width: 280, height: 180 };
  const rootY = 40;
  const containerDim = containerNode ? getNodeDimensions(containerNode) : { width: 310, height: 480 };
  const containerY = rootY + rootDim.height + 60;
  const branchStartY = (containerNode && containerNode.id !== rootAppNode?.id)
    ? containerY + containerDim.height + 80
    : rootY + rootDim.height + 80;

  // Position Branch Swimlanes side-by-side horizontally, cascading downward vertically
  let currentBranchX = 60;

  branches.forEach((branch) => {
    // Group branch nodes by depth
    const byDepth = {};
    branch.nodes.forEach((item) => {
      const d = item.depth || 1;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(item.node);
    });

    const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
    let colX = currentBranchX;

    depths.forEach((d) => {
      const items = byDepth[d];
      let currentY = branchStartY;
      let maxColWidth = 0;

      items.forEach((itemNode) => {
        const dim = getNodeDimensions(itemNode);
        treePositions[itemNode.id] = { x: colX, y: currentY };
        currentY += dim.height + 60; // 60px vertical gap between screens
        maxColWidth = Math.max(maxColWidth, dim.width);
      });

      colX += maxColWidth + 85; // 85px horizontal gap between depth columns
    });

    currentBranchX = colX + 40; // 40px gap between branches
  });

  const totalBranchesWidth = Math.max(currentBranchX - 60, 600);
  const treeCenterX = 60 + totalBranchesWidth / 2;

  // Tier 0: Root App at Top Center
  if (rootAppNode) {
    const rootX = Math.round(treeCenterX - rootDim.width / 2);
    treePositions[rootAppNode.id] = { x: Math.max(60, rootX), y: rootY };
  }

  // Tier 1: Container directly beneath Root App
  if (containerNode && containerNode.id !== rootAppNode?.id) {
    const containerX = Math.round(treeCenterX - containerDim.width / 2);
    treePositions[containerNode.id] = { x: Math.max(60, containerX), y: containerY };
  }

  // Lateral State Shelf: Shared Stores & Services to the right of branch columns & root/container
  const maxCenterRight = treeCenterX + Math.max(rootDim.width, containerDim.width) / 2;
  const shelfStartX = Math.max(currentBranchX + 60, maxCenterRight + 80);
  const shelfStartY = containerY;

  const shelfCols = stateShelfNodes.length > 5 ? 2 : 1;
  const colHeights = new Array(shelfCols).fill(0);
  const shelfColWidth = 300;

  stateShelfNodes.forEach((node, idx) => {
    const col = idx % shelfCols;
    const dim = getNodeDimensions(node);
    const x = shelfStartX + col * (shelfColWidth + 40);
    const y = shelfStartY + colHeights[col];
    treePositions[node.id] = { x, y };
    colHeights[col] += dim.height + 40;
  });

  // Final relaxation check to guarantee zero overlaps across any edge cases
  const nodeMap = {};
  for (const id in nodes) nodeMap[id] = nodes[id];
  const relaxed = rearrangeNodes(treePositions, nodeMap, null, { paddingX: 20, paddingY: 20, maxIterations: 15 });
  Object.assign(treePositions, relaxed.positions);

  // 7. Build Nested Hierarchy Model for Sidebar Tree Explorer
  const treeHierarchy = [];
  if (rootAppNode) {
    const rootTreeItem = {
      id: rootAppNode.id,
      name: rootAppNode.name,
      kind: rootAppNode.kind,
      type: 'app_root',
      icon: '📱',
      children: []
    };

    if (containerNode && containerNode.id !== rootAppNode.id) {
      const containerTreeItem = {
        id: containerNode.id,
        name: containerNode.name,
        kind: containerNode.kind,
        type: 'tab_container',
        icon: '🗂️',
        children: []
      };

      branches.forEach((branch) => {
        const branchItem = {
          id: branch.id,
          name: branch.title,
          tabLabel: branch.tabLabel,
          icon: branch.icon,
          color: branch.color,
          type: 'tab_branch',
          children: branch.nodes.map((n) => ({
            id: n.id,
            name: n.node.name,
            kind: n.node.kind,
            level: n.node.level || 'L1_SCREEN',
            icon: n.node.kind === 'view' ? '🏢' : '🧩',
            type: 'screen_node'
          }))
        };
        containerTreeItem.children.push(branchItem);
      });

      rootTreeItem.children.push(containerTreeItem);
    } else {
      branches.forEach((branch) => {
        rootTreeItem.children.push({
          id: branch.id,
          name: branch.title,
          tabLabel: branch.tabLabel,
          icon: branch.icon,
          color: branch.color,
          type: 'tab_branch',
          children: branch.nodes.map((n) => ({
            id: n.id,
            name: n.node.name,
            kind: n.node.kind,
            level: n.node.level || 'L1_SCREEN',
            icon: n.node.kind === 'view' ? '🏢' : '🧩',
            type: 'screen_node'
          }))
        });
      });
    }

    treeHierarchy.push(rootTreeItem);
  }

  // Add Shared State & Services folder to hierarchy
  if (stateShelfNodes.length > 0) {
    treeHierarchy.push({
      id: 'shared_stores_folder',
      name: `Shared Stores & Services (${stateShelfNodes.length})`,
      type: 'stores_folder',
      icon: '⚡',
      color: '#fbbf24',
      children: stateShelfNodes.map((n) => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        icon: n.kind === 'viewModel' ? '🗄️' : '☁️',
        type: 'store_node'
      }))
    });
  }

  return {
    rootAppNode,
    containerNode,
    branches,
    stateShelfNodes,
    treePositions,
    branchMap,
    treeHierarchy
  };
}

/**
 * Compute clean, collision-free, compact layout specifically tailored
 * for the currently visible nodes (e.g. at L1 Journey, L2 Components, or L3 Details).
 * Eliminates giant empty voids caused by hidden subviews and packs visible nodes tightly.
 */
export function computeAdaptiveTreeLayout(visibleNodeList, treeData, rawGraph) {
  if (!treeData) return {};
  const visibleMap = new Map();
  (visibleNodeList || []).forEach((n) => visibleMap.set(n.id, n.data || n));

  const { rootAppNode, containerNode, branches = [], stateShelfNodes = [] } = treeData;
  const positions = {};

  const rootDim = rootAppNode ? getNodeDimensions(rootAppNode) : { width: 280, height: 180 };
  const rootY = 40;
  const containerDim = containerNode ? getNodeDimensions(containerNode) : { width: 310, height: 480 };
  const containerY = rootY + rootDim.height + 60;
  const branchStartY = (containerNode && containerNode.id !== rootAppNode?.id)
    ? containerY + containerDim.height + 80
    : rootY + rootDim.height + 80;

  // 1. Position Visible Branches side-by-side horizontally, cascading downward vertically
  let currentBranchX = 60;

  branches.forEach((branch) => {
    const visibleBranchItems = branch.nodes.filter((item) => visibleMap.has(item.id));
    if (visibleBranchItems.length === 0) return;

    // Group visible branch items by relative depth
    const byDepth = {};
    visibleBranchItems.forEach((item) => {
      const d = item.depth || 1;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(item.node);
    });

    const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
    let colX = currentBranchX;

    depths.forEach((d) => {
      const items = byDepth[d];
      let currentY = branchStartY;
      let maxColWidth = 0;

      items.forEach((node) => {
        const dim = getNodeDimensions(node);
        positions[node.id] = { x: colX, y: currentY };
        currentY += dim.height + 60;
        maxColWidth = Math.max(maxColWidth, dim.width);
      });

      colX += maxColWidth + 85;
    });

    currentBranchX = colX + 40;
  });

  const totalBranchesWidth = Math.max(currentBranchX - 60, 600);
  const treeCenterX = 60 + totalBranchesWidth / 2;

  // 2. Position Root App at the Top Center (Tier 0)
  if (rootAppNode && visibleMap.has(rootAppNode.id)) {
    const rootX = Math.round(treeCenterX - rootDim.width / 2);
    positions[rootAppNode.id] = { x: Math.max(60, rootX), y: rootY };
  }

  // 3. Position Container directly beneath Root App (Tier 1)
  if (containerNode && visibleMap.has(containerNode.id) && containerNode.id !== rootAppNode?.id) {
    const containerX = Math.round(treeCenterX - containerDim.width / 2);
    positions[containerNode.id] = { x: Math.max(60, containerX), y: containerY };
  }

  // 4. Position State Shelf to the right of branch columns & root/container
  const visibleStores = stateShelfNodes.filter((n) => visibleMap.has(n.id));
  const maxCenterRight = treeCenterX + Math.max(rootDim.width, containerDim.width) / 2;
  const shelfStartX = Math.max(currentBranchX + 60, maxCenterRight + 80);
  const shelfStartY = containerY;

  const shelfCols = visibleStores.length > 5 ? 2 : 1;
  const colHeights = new Array(shelfCols).fill(0);
  const shelfColWidth = 300;

  visibleStores.forEach((node, idx) => {
    const col = idx % shelfCols;
    const dim = getNodeDimensions(node);
    const x = shelfStartX + col * (shelfColWidth + 40);
    const y = shelfStartY + colHeights[col];
    positions[node.id] = { x, y };
    colHeights[col] += dim.height + 40;
  });

  // 5. Catch any unplaced visible nodes safely
  const placedIds = new Set(Object.keys(positions));
  const unplaced = visibleNodeList.filter(n => !placedIds.has(n.id) && n.id !== rootAppNode?.id && n.id !== containerNode?.id);
  if (unplaced.length > 0) {
    let unplacedY = branchStartY;
    const unplacedX = shelfStartX + shelfCols * (shelfColWidth + 40) + 40;
    unplaced.forEach(node => {
      const dim = getNodeDimensions(node);
      positions[node.id] = { x: unplacedX, y: unplacedY };
      unplacedY += dim.height + 40;
    });
  }

  // Final relaxation check
  const nodeMap = {};
  visibleNodeList.forEach((n) => { nodeMap[n.id] = n.data || n; });
  const relaxed = rearrangeNodes(positions, nodeMap, null, { paddingX: 20, paddingY: 20, maxIterations: 15 });
  return relaxed.positions;
}

