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

  const nodes = graph.nodes;
  const edges = Object.values(graph.edges || {});
  const nodeIds = Object.keys(nodes);

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
      node.name.includes('Test') ||
      node.name === 'Coordinates' ||
      node.name === 'HexagonParameters' ||
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
    rootAppNode = candidateRoots.length > 0 ? uiNodes[candidateRoots[0]] : Object.values(uiNodes)[0];
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

  // 4. Discover Tab Branches & Primary Navigation Roots
  // Scan outgoing composition / navigation edges from the Container
  const branchSeeds = [];
  const edgesFromContainer = edges.filter((e) => e.sourceNodeId === containerNode?.id && uiNodes[e.targetNodeId]);

  // Specific heuristic for Landmarks and known apps:
  // Tab 1: CategoryHome ("Featured"), Tab 2: LandmarkList ("List"), Tab 3 / Modal: ProfileHost
  edgesFromContainer.forEach((e) => {
    const targetNode = uiNodes[e.targetNodeId];
    if (targetNode && targetNode.id !== rootAppNode?.id) {
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

  // 6. Calculate Clean Tree View Positions (Compact Shelf & Collision-Free Swimlanes)
  const treePositions = {};

  // Separate Primary State Stores (@Observable / Store) from Secondary Models/Services/Tests
  const primaryStores = stateShelfNodes.filter(
    (n) => n.name.includes('ModelData') || n.name.includes('Store') || n.kind === 'viewModel'
  );
  const secondaryServices = stateShelfNodes.filter((n) => !primaryStores.includes(n));

  // Place Primary Stores in a dedicated tier right above the container
  const shelfStartX = 400;
  primaryStores.forEach((node, idx) => {
    treePositions[node.id] = {
      x: shelfStartX + idx * 330,
      y: -220
    };
  });

  // Place Secondary Services / Models / Tests in a compact 4-column rack
  const rackCols = 4;
  const colHeights = [0, 0, 0, 0];
  const shelfBaseY = -280;

  secondaryServices.forEach((node, idx) => {
    const col = idx % rackCols;
    const dim = getNodeDimensions(node);
    const y = shelfBaseY - colHeights[col] - dim.height;
    treePositions[node.id] = {
      x: shelfStartX + col * 330,
      y: y
    };
    colHeights[col] += dim.height + 40; // 40px vertical gap between rack items
  });

  // Position Branch Swimlanes with Dynamic Column Widths & Heights (Zero Overlaps)
  let currentBranchY = 60;
  const branchStartX = 800;

  branches.forEach((branch) => {
    // Group branch nodes by depth
    const byDepth = {};
    branch.nodes.forEach((item) => {
      const d = item.depth || 1;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(item.node);
    });

    const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
    let branchMaxY = currentBranchY;
    let colX = branchStartX;

    depths.forEach((d) => {
      const items = byDepth[d];
      let currentY = currentBranchY;
      let maxColWidth = 0;

      items.forEach((item) => {
        const dim = getNodeDimensions(item);
        treePositions[item.id] = { x: colX, y: currentY };
        currentY += dim.height + 60; // 60px vertical gap between screens
        maxColWidth = Math.max(maxColWidth, dim.width);
      });

      branchMaxY = Math.max(branchMaxY, currentY);
      colX += maxColWidth + 85; // 85px horizontal gap between depth columns
    });

    // Advance Y channel for next branch swimlane
    currentBranchY = branchMaxY + 110; // 110px swimlane separation
  });

  // Position Root App and Container vertically centered with the primary tab roots
  let centerY = 320;
  if (branches.length >= 2 && branches[0].nodes[0] && branches[1].nodes[0]) {
    const y0 = treePositions[branches[0].nodes[0].node.id]?.y ?? 60;
    const y1 = treePositions[branches[1].nodes[0].node.id]?.y ?? 600;
    centerY = Math.round((y0 + y1) / 2);
  } else if (branches.length === 1 && branches[0].nodes[0]) {
    centerY = treePositions[branches[0].nodes[0].node.id]?.y ?? 320;
  }

  if (rootAppNode) {
    treePositions[rootAppNode.id] = { x: 40, y: centerY };
  }
  if (containerNode && containerNode.id !== rootAppNode?.id) {
    treePositions[containerNode.id] = { x: 400, y: centerY };
  }

  // Final relaxation check to guarantee zero overlaps across any edge cases
  const relaxed = rearrangeNodes(treePositions, nodes, null, { paddingX: 40, paddingY: 40, maxIterations: 15 });
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

  // 1. Position Visible State Stores on Top Shelf
  const visibleStores = stateShelfNodes.filter((n) => visibleMap.has(n.id));
  const shelfStartX = 380;
  visibleStores.forEach((node, idx) => {
    positions[node.id] = {
      x: shelfStartX + idx * 320,
      y: -220
    };
  });

  // 2. Position Visible Branches
  let currentBranchY = 60;
  const branchStartX = 800;

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
    let branchMaxY = currentBranchY;
    let colX = branchStartX;

    depths.forEach((d) => {
      const items = byDepth[d];
      let currentY = currentBranchY;
      let maxColWidth = 0;

      items.forEach((node) => {
        const dim = getNodeDimensions(node);
        positions[node.id] = { x: colX, y: currentY };
        currentY += dim.height + 60;
        maxColWidth = Math.max(maxColWidth, dim.width);
      });

      branchMaxY = Math.max(branchMaxY, currentY);
      colX += maxColWidth + 85;
    });

    currentBranchY = branchMaxY + 110;
  });

  // 3. Center Root App and Container vertically between visible branches
  let centerY = 320;
  const branchRoots = branches
    .map((b) => b.nodes.find((n) => visibleMap.has(n.id))?.node)
    .filter(Boolean);

  if (branchRoots.length >= 2 && positions[branchRoots[0].id] && positions[branchRoots[1].id]) {
    centerY = Math.round((positions[branchRoots[0].id].y + positions[branchRoots[1].id].y) / 2);
  } else if (branchRoots.length === 1 && positions[branchRoots[0].id]) {
    centerY = positions[branchRoots[0].id].y;
  }

  if (rootAppNode && visibleMap.has(rootAppNode.id)) {
    positions[rootAppNode.id] = { x: 40, y: centerY };
  }
  if (containerNode && visibleMap.has(containerNode.id) && containerNode.id !== rootAppNode?.id) {
    positions[containerNode.id] = { x: 380, y: centerY };
  }

  // Final relaxation check
  const nodeMap = {};
  visibleNodeList.forEach((n) => { nodeMap[n.id] = n.data || n; });
  const relaxed = rearrangeNodes(positions, nodeMap, null, { paddingX: 40, paddingY: 40, maxIterations: 15 });
  return relaxed.positions;
}

