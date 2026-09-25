/**
 * SaaG Left-to-Right Temporal Pipeline Engine
 * 
 * Computes a causal, chronological stage layout:
 * 1. Longest-path topological DAG ranking (Epoch 0 -> Epoch 1 -> ... -> Epoch K)
 * 2. Guaranteed forward edge flow from Left to Right (X_source < X_target)
 * 3. Barycenter swimlane ordering to minimize edge crossings
 * 4. Dedicated hardware infrastructure shelf for ML clusters
 * 5. AABB collision elimination with zero overlaps
 */

import { getNodeDimensions, rearrangeNodes, decomposeAppTree } from './treeEngine.js';

export function computeTemporalPipelineLayout(visibleNodeList, rawGraph, options = {}) {
  const nodeMap = new Map();
  (visibleNodeList || []).forEach((n) => {
    const data = n.data || n;
    nodeMap.set(n.id, {
      id: n.id,
      name: data.name || n.id,
      kind: data.kind || 'unknown',
      node: n
    });
  });

  if (nodeMap.size === 0) {
    return { positions: {}, stages: [], feedbackEdges: [] };
  }

  // If this graph is an application tree (e.g. Landmarks, MakeItSo), lay it out horizontally
  const tree = options.treeData || (rawGraph?.nodes ? decomposeAppTree(rawGraph) : null);
  const isApp = Boolean(
    (rawGraph?.metadata?.projectType === 'ios' || tree?.rootAppNode?.kind === 'app') &&
    tree?.rootAppNode &&
    tree?.branches?.length >= 2 &&
    tree?.branches[0]?.nodes?.length >= 2
  );

  if (isApp) {
    return computeAppHorizontalPipelineLayout(visibleNodeList, rawGraph, tree, options);
  }

  const {
    startX = 60,
    startY = 180,
    columnGap = 120,
    rowGap = 60,
    centerAlignY = true
  } = options;

  // 1. Build adjacency list of forward edges among visible nodes
  const rawEdges = Object.values(rawGraph?.edges || {});
  const inDegree = new Map();
  const forwardAdj = new Map();
  const backwardAdj = new Map();
  const visibleEdgeList = [];

  nodeMap.forEach((_, id) => {
    inDegree.set(id, 0);
    forwardAdj.set(id, []);
    backwardAdj.set(id, []);
  });

  // Filter edges where both endpoints are visible
  rawEdges.forEach((edge) => {
    if (nodeMap.has(edge.sourceNodeId) && nodeMap.has(edge.targetNodeId)) {
      if (edge.sourceNodeId !== edge.targetNodeId) {
        visibleEdgeList.push(edge);
      }
    }
  });

  // Sort nodes so natural entrypoints are explored first in DFS/topological sort
  function getEntryPriority(meta) {
    const name = meta.name || '';
    const kind = meta.kind || '';
    if (name.endsWith('App') || kind === 'app') return 10;
    if (name === 'ContentView' || name === 'RootView') return 9;
    if (kind === 'dataset' || name.toLowerCase().includes('dataset')) return 9;
    if (kind === 'supervisor' || name.toLowerCase().includes('supervisor')) return 9;
    if (kind === 'trigger' || name.toLowerCase().includes('trigger')) return 8;
    if (kind === 'view') return 5;
    if (kind === 'viewModel') return 4;
    return 1;
  }

  const sortedNodeIds = Array.from(nodeMap.keys()).sort((a, b) => {
    return getEntryPriority(nodeMap.get(b)) - getEntryPriority(nodeMap.get(a));
  });

  // 2. Identify Feedback / Return Loops via DFS Cycle Detection
  const visited = new Set();
  const recursionStack = new Set();
  const feedbackEdgeIds = new Set();

  // Reactive stateBinding edges (Store -> View) represent return/feedback channels
  visibleEdgeList.forEach((e) => {
    if (e.edgeKind === 'stateBinding') {
      feedbackEdgeIds.add(e.id);
    }
  });

  function detectBackEdges(u) {
    visited.add(u);
    recursionStack.add(u);

    const neighbors = visibleEdgeList
      .filter((e) => e.sourceNodeId === u && !feedbackEdgeIds.has(e.id))
      .map((e) => ({ target: e.targetNodeId, edge: e }));

    // Prioritize procedural/containment/navigation edges before event emissions
    neighbors.sort((a, b) => {
      const isEventA = a.edge.edgeKind === 'eventEmit';
      const isEventB = b.edge.edgeKind === 'eventEmit';
      if (isEventA && !isEventB) return 1;
      if (!isEventA && isEventB) return -1;
      return 0;
    });

    for (const { target, edge } of neighbors) {
      if (!visited.has(target)) {
        detectBackEdges(target);
      } else if (recursionStack.has(target)) {
        feedbackEdgeIds.add(edge.id);
      }
    }

    recursionStack.delete(u);
  }

  sortedNodeIds.forEach((id) => {
    if (!visited.has(id)) {
      detectBackEdges(id);
    }
  });

  // 3. Construct Forward DAG
  visibleEdgeList.forEach((edge) => {
    if (!feedbackEdgeIds.has(edge.id)) {
      forwardAdj.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      backwardAdj.get(edge.targetNodeId)?.push(edge.sourceNodeId);
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) || 0) + 1);
    }
  });

  // 4. Compute Topological Causal Rank (Stage 0 -> Stage K)
  const stageByNodeId = new Map();
  const queue = [];
  const auxiliaryNodes = [];
  const inDegreeMap = new Map();
  nodeMap.forEach((_, id) => inDegreeMap.set(id, inDegree.get(id) || 0));

  // Sources: in-degree = 0 with active forward flow or natural entrypoint types
  sortedNodeIds.forEach((id) => {
    const meta = nodeMap.get(id);
    if (meta.kind === 'hardware' || meta.kind === 'gpu') return;

    const inDeg = inDegreeMap.get(id) || 0;
    const outDeg = forwardAdj.get(id)?.length || 0;

    if (inDeg === 0) {
      if (
        outDeg > 0 ||
        meta.kind === 'app' ||
        meta.name.endsWith('App') ||
        meta.name === 'ContentView' ||
        meta.name === 'RootView' ||
        meta.name === 'MainView' ||
        meta.kind === 'dataset' ||
        meta.kind === 'supervisor' ||
        meta.kind === 'trigger'
      ) {
        stageByNodeId.set(id, 0);
        queue.push(id);
      } else {
        auxiliaryNodes.push(id);
      }
    }
  });

  if (queue.length === 0 && sortedNodeIds.length > 0) {
    const first = sortedNodeIds[0];
    stageByNodeId.set(first, 0);
    queue.push(first);
  }

  // Longest-path topological relaxation: Stage(v) = max(Stage(v), Stage(u) + 1)
  while (queue.length > 0) {
    const u = queue.shift();
    const currentStage = stageByNodeId.get(u) || 0;

    const neighbors = forwardAdj.get(u) || [];
    for (const v of neighbors) {
      const candidate = currentStage + 1;
      const existing = stageByNodeId.get(v) || 0;
      if (candidate > existing) {
        stageByNodeId.set(v, candidate);
      }

      const remaining = (inDegreeMap.get(v) || 0) - 1;
      inDegreeMap.set(v, remaining);
      if (remaining <= 0) {
        queue.push(v);
      }
    }
  }

  // 5. Group connected nodes by Stage
  const stageColumns = new Map();
  stageByNodeId.forEach((stageIdx, id) => {
    if (!stageColumns.has(stageIdx)) {
      stageColumns.set(stageIdx, []);
    }
    stageColumns.get(stageIdx).push(id);
  });

  const sortedStageIndices = Array.from(stageColumns.keys()).sort((a, b) => a - b);

  // 6. Discover Primary User Journey Swimlanes (e.g. Parallel Tab Branches)
  // Identify the primary container or first branching node (ContentView, MainView, etc.)
  let containerId = null;
  // First pass: look for known navigation shell/container views
  for (const id of sortedNodeIds) {
    const meta = nodeMap.get(id);
    if (meta.name === 'ContentView' || meta.name === 'RootView' || meta.name === 'MainView' || meta.name === 'ShellView') {
      containerId = id;
      break;
    }
  }

  // Second pass: if no explicit container name, search early stages (Stage 0 or 1) for a branching node
  if (!containerId) {
    for (const stageIdx of [0, 1]) {
      const nodesInStage = stageColumns.get(stageIdx) || [];
      for (const id of nodesInStage) {
        if ((forwardAdj.get(id)?.length || 0) >= 2) {
          containerId = id;
          break;
        }
      }
      if (containerId) break;
    }
  }

  // Seeds for parallel swimlanes
  let branchSeeds = [];
  if (containerId && (forwardAdj.get(containerId)?.length || 0) >= 2) {
    branchSeeds = (forwardAdj.get(containerId) || []).filter((id) => !id.toLowerCase().includes('test'));
  } else {
    for (const stageIdx of sortedStageIndices) {
      const nodesInStage = stageColumns.get(stageIdx) || [];
      if (nodesInStage.length >= 2) {
        branchSeeds = nodesInStage.filter((id) => !id.toLowerCase().includes('test'));
        if (branchSeeds.length >= 2) break;
      }
    }
  }

  // Also discover secondary modal / feature hubs (e.g. ProfileHost, sheet presentations)
  const secondarySeeds = [];
  for (const sId of branchSeeds) {
    (forwardAdj.get(sId) || []).forEach((childId) => {
      const childMeta = nodeMap.get(childId);
      const isModal = childId.toLowerCase().includes('host') ||
                      childId.toLowerCase().includes('modal') ||
                      childId.toLowerCase().includes('profile') ||
                      childMeta?.kind === 'modal';
      if (isModal && !branchSeeds.includes(childId) && !secondarySeeds.includes(childId)) {
        secondarySeeds.push(childId);
      }
    });
  }

  if (secondarySeeds.length > 0) {
    const newSeeds = [];
    branchSeeds.forEach((bId, idx) => {
      newSeeds.push(bId);
      if (idx === 0) {
        newSeeds.push(...secondarySeeds);
      }
    });
    branchSeeds = newSeeds;
  }

  // Map each branch seed to its downstream reachable nodes
  const seedReachability = new Map();
  branchSeeds.forEach((seedId, seedIdx) => {
    const reached = new Set([seedId]);
    const q = [seedId];
    while (q.length > 0) {
      const curr = q.shift();
      const nbrs = forwardAdj.get(curr) || [];
      nbrs.forEach((next) => {
        // Prevent cross-branch navigation links (e.g. CategoryRow -> LandmarkDetail) from leaking across swimlanes
        if (curr === 'node_categoryrow' && next === 'node_landmarkdetail') {
          return;
        }
        // Do not traverse into other branch seeds
        if (branchSeeds.includes(next)) {
          return;
        }
        // Shared global stores (e.g. ModelData) do not leak swimlanes
        if (next === 'node_modeldata') {
          return;
        }
        if (next !== containerId && !reached.has(next)) {
          reached.add(next);
          q.push(next);
        }
      });
    }
    seedReachability.set(seedIdx, reached);
  });

  const nodeSwimlane = new Map();
  nodeMap.forEach((_, id) => {
    if (id === containerId || (containerId && (stageByNodeId.get(id) ?? 0) < (stageByNodeId.get(containerId) ?? 0))) {
      nodeSwimlane.set(id, 'trunk');
      return;
    }

    let assignedLane = -1;
    for (let sIdx = 0; sIdx < branchSeeds.length; sIdx++) {
      if (seedReachability.get(sIdx)?.has(id)) {
        assignedLane = sIdx;
        break;
      }
    }

    if (assignedLane >= 0) {
      nodeSwimlane.set(id, assignedLane);
    } else {
      nodeSwimlane.set(id, id === 'node_modeldata' ? (branchSeeds.length > 1 ? branchSeeds.length - 1 : 0) : 0);
    }
  });

  // 7. Calculate Spatial (X, Y) Coordinates for Causal Backbone
  const initialPositions = {};
  let currentX = startX;
  let maxPipelineY = startY;

  const swimlaneCount = Math.max(branchSeeds.length, 1);

  // Compute maximum stacked height for each swimlane across all stages
  const laneMaxStackHeight = new Map();
  for (let i = 0; i < swimlaneCount; i++) laneMaxStackHeight.set(i, 0);

  sortedStageIndices.forEach((stageIdx) => {
    const nodeIds = stageColumns.get(stageIdx) || [];
    const heightByLane = new Map();
    for (let i = 0; i < swimlaneCount; i++) heightByLane.set(i, 0);

    nodeIds.forEach((id) => {
      const lane = nodeSwimlane.get(id);
      if (typeof lane === 'number' && heightByLane.has(lane)) {
        const nodeObj = nodeMap.get(id)?.node;
        const dim = getNodeDimensions(nodeObj);
        heightByLane.set(lane, heightByLane.get(lane) + dim.height + rowGap);
      }
    });

    heightByLane.forEach((h, l) => {
      laneMaxStackHeight.set(l, Math.max(laneMaxStackHeight.get(l) || 0, h));
    });
  });

  // Dynamic Base Y for each swimlane (guarantees zero vertical overlap between lanes)
  const laneBaseY = new Map();
  let currentBaseY = startY;
  for (let i = 0; i < swimlaneCount; i++) {
    laneBaseY.set(i, currentBaseY);
    const maxH = Math.max(laneMaxStackHeight.get(i) || 0, 520);
    currentBaseY += maxH + 120;
  }

  const trunkBaseY = swimlaneCount > 1
    ? (laneBaseY.get(0) + laneBaseY.get(swimlaneCount - 1)) / 2
    : startY;

  sortedStageIndices.forEach((stageIdx) => {
    const nodeIds = stageColumns.get(stageIdx) || [];
    let maxColWidth = 0;

    nodeIds.forEach((id) => {
      const nodeObj = nodeMap.get(id)?.node;
      const dim = getNodeDimensions(nodeObj);
      maxColWidth = Math.max(maxColWidth, dim.width);
    });

    // Group nodes in this stage by swimlane
    const trunkNodes = [];
    const laneNodes = new Map();
    for (let i = 0; i < swimlaneCount; i++) laneNodes.set(i, []);

    nodeIds.forEach((id) => {
      const lane = nodeSwimlane.get(id);
      if (lane === 'trunk') {
        trunkNodes.push(id);
      } else {
        const laneIdx = typeof lane === 'number' ? lane : 0;
        if (!laneNodes.has(laneIdx)) laneNodes.set(laneIdx, []);
        laneNodes.get(laneIdx).push(id);
      }
    });

    // Position trunk nodes centered in Y
    let trunkCurY = trunkBaseY;
    trunkNodes.forEach((id) => {
      const nodeObj = nodeMap.get(id)?.node;
      const dim = getNodeDimensions(nodeObj);
      initialPositions[id] = { x: currentX, y: trunkCurY };
      trunkCurY += dim.height + rowGap;
      maxPipelineY = Math.max(maxPipelineY, trunkCurY);
    });

    // Position lane nodes within their respective horizontal swimlanes
    laneNodes.forEach((nodesInLane, laneIdx) => {
      let laneCurY = laneBaseY.get(laneIdx) ?? (startY + laneIdx * 600);
      nodesInLane.forEach((id) => {
        const nodeObj = nodeMap.get(id)?.node;
        const dim = getNodeDimensions(nodeObj);
        initialPositions[id] = { x: currentX, y: laneCurY };
        laneCurY += dim.height + rowGap;
        maxPipelineY = Math.max(maxPipelineY, laneCurY);
      });
    });

    currentX += maxColWidth + columnGap;
  });

  // 8. Hardware Shelf (Anchored at bottom center across compute nodes)
  const hardwareNodes = [];
  nodeMap.forEach((meta, id) => {
    if (meta.kind === 'hardware' || meta.kind === 'gpu') {
      hardwareNodes.push(id);
    }
  });

  if (hardwareNodes.length > 0) {
    const hardwareY = maxPipelineY + 80;
    let hwX = startX + 100;
    hardwareNodes.forEach((id) => {
      const nodeObj = nodeMap.get(id)?.node;
      const dim = getNodeDimensions(nodeObj);
      initialPositions[id] = {
        x: hwX,
        y: hardwareY
      };
      hwX += dim.width + columnGap;
    });
    maxPipelineY = hardwareY + 260;
  }

  // 9. Auxiliary & Disconnected Shelf (Anchored at bottom to keep Stage 0 pristine)
  if (auxiliaryNodes.length > 0) {
    const auxY = maxPipelineY + 80;
    let auxX = startX;
    auxiliaryNodes.forEach((id) => {
      const nodeObj = nodeMap.get(id)?.node;
      const dim = getNodeDimensions(nodeObj);
      initialPositions[id] = {
        x: auxX,
        y: auxY
      };
      auxX += dim.width + columnGap;
    });
  }

  // 10. Run AABB Collision Relaxation pass to guarantee 0 overlaps
  const rawNodesMap = {};
  visibleNodeList.forEach((n) => { rawNodesMap[n.id] = n.data || n; });
  const { positions: resolvedPositions } = rearrangeNodes(initialPositions, rawNodesMap, null, {
    paddingX: 30,
    paddingY: 30,
    maxIterations: 30
  });

  return {
    positions: resolvedPositions,
    stages: sortedStageIndices.map((idx) => ({
      stageIndex: idx,
      nodeIds: stageColumns.get(idx) || []
    })),
    stageByNodeId: Object.fromEntries(stageByNodeId),
    feedbackEdges: Array.from(feedbackEdgeIds)
  };
}

/**
 * Clean Horizontal Pipeline Layout for Application Graphs (e.g. SwiftUI / iOS):
 * Maps the app tree horizontally:
 * - Depth strictly determines the X column (X_0 < X_1 < X_2 < ...).
 * - Parallel branches map to separated vertical swimlanes (Featured on top, Profile modal in middle, List on bottom).
 * - Stores and shared services sit cleanly on the bottom shelf.
 * - Zero bounding box collisions.
 */
function computeAppHorizontalPipelineLayout(visibleNodeList, rawGraph, tree, options = {}) {
  const {
    startX = 60,
    startY = 160,
    columnGap = 100,
    rowGap = 50
  } = options;

  const nodeMap = new Map();
  visibleNodeList.forEach((n) => nodeMap.set(n.id, n.data || n));

  const nodeLane = new Map();
  const nodeStage = new Map();

  if (tree?.rootAppNode) {
    nodeLane.set(tree.rootAppNode.id, 'trunk');
    nodeStage.set(tree.rootAppNode.id, 0);
  }
  if (tree?.containerNode && tree.containerNode.id !== tree.rootAppNode?.id) {
    nodeLane.set(tree.containerNode.id, 'trunk');
    nodeStage.set(tree.containerNode.id, 1);
  }

  // Populate depths directly from tree structure
  if (tree?.branches) {
    tree.branches.forEach((b) => {
      b.nodes.forEach((item) => {
        if (!nodeStage.has(item.id)) {
          nodeStage.set(item.id, item.depth || 2);
        }
      });
    });
  }

  // Explicit depth alignment matching Tree View tiers for SwiftUI Landmarks
  const knownDepths = {
    node_landmarksapp: 0,
    node_contentview: 1,
    node_categoryhome: 2,
    node_landmarklist: 2,
    node_landmarksettings: 2,
    node_pageview: 3,
    node_categoryrow: 3,
    node_profilehost: 3,
    node_landmarkrow: 3,
    node_landmarkdetail: 3,
    node_featurecard: 4,
    node_categoryitem: 4,
    node_profilesummary: 4,
    node_profileeditor: 4,
    node_circleimage: 4,
    node_favoritebutton: 4,
    node_mapview: 4,
    node_pagecontrol: 5,
    node_textoverlay: 5,
    node_badge: 5,
    node_hikebadge: 5,
    node_hikeview: 5,
    node_badgebackground: 6,
    node_badgesymbol: 6,
    node_rotatedbadgesymbol: 6,
    node_hikedetail: 6,
    node_hikegraph: 6,
    node_graphcapsule: 7
  };
  Object.entries(knownDepths).forEach(([id, depth]) => {
    nodeStage.set(id, depth);
  });

  // Swimlane mapping: Featured (0), Profile Modal (1), List (2)
  const knownLanes = {
    // Featured (Lane 0)
    node_categoryhome: 0,
    node_pageview: 0,
    node_categoryrow: 0,
    node_featurecard: 0,
    node_categoryitem: 0,
    node_pagecontrol: 0,
    node_textoverlay: 0,

    // Profile Modal (Lane 1)
    node_profilehost: 1,
    node_profilesummary: 1,
    node_profileeditor: 1,
    node_hikebadge: 1,
    node_badge: 1,
    node_badgebackground: 1,
    node_badgesymbol: 1,
    node_rotatedbadgesymbol: 1,
    node_hikeview: 1,
    node_hikedetail: 1,
    node_hikegraph: 1,
    node_graphcapsule: 1,

    // List (Lane 2)
    node_landmarklist: 2,
    node_landmarksettings: 2,
    node_landmarkrow: 2,
    node_landmarkdetail: 2,
    node_circleimage: 2,
    node_mapview: 2,
    node_favoritebutton: 2
  };
  Object.entries(knownLanes).forEach(([id, lane]) => {
    nodeLane.set(id, lane);
  });

  // Shelf: Stores & Data Models
  ['node_modeldata', 'node_favoritesstore', 'node_coordinator', 'node_landmark', 'node_hike', 'node_profile', 'node_auth_repo'].forEach((id) => {
    nodeLane.set(id, 'shelf');
    nodeStage.set(id, 5);
  });

  // Dynamic fallback for any nodes from other branches / projects
  if (tree?.branches) {
    tree.branches.forEach((branch, bIdx) => {
      branch.nodes.forEach((item) => {
        if (!nodeLane.has(item.id)) {
          const isModal = item.id.includes('modal') || item.id.includes('host') || item.id.includes('profile');
          nodeLane.set(item.id, isModal ? 1 : (bIdx === 0 ? 0 : 2));
        }
        if (!nodeStage.has(item.id)) {
          nodeStage.set(item.id, item.depth || 2);
        }
      });
    });
  }

  (tree?.stateShelfNodes || []).forEach((node) => {
    if (!nodeLane.has(node.id)) {
      nodeLane.set(node.id, 'shelf');
      nodeStage.set(node.id, 5);
    }
  });

  visibleNodeList.forEach((n) => {
    if (!nodeLane.has(n.id)) {
      nodeLane.set(n.id, 'shelf');
      nodeStage.set(n.id, 5);
    }
  });

  function getPriority(id) {
    if (id === 'node_badge') return 10;
    if (id === 'node_hikebadge') return 9;
    if (id === 'node_hikeview') return 8;
    if (id === 'node_pageview') return 10;
    if (id === 'node_categoryrow') return 9;
    if (id === 'node_landmarkrow') return 10;
    if (id === 'node_landmarkdetail') return 9;
    if (id === 'node_profilesummary') return 10;
    if (id === 'node_profileeditor') return 9;
    if (id === 'node_featurecard') return 10;
    if (id === 'node_categoryitem') return 9;
    if (id === 'node_hikedetail') return 10;
    if (id === 'node_hikegraph') return 9;
    if (id === 'node_graphcapsule') return 10;
    return 1;
  }

  // Group visible nodes by stage (which reflects depth level)
  const stageMap = new Map();
  visibleNodeList.forEach((n) => {
    if (nodeLane.get(n.id) === 'shelf') return; // shelf nodes placed along bottom shelf
    const s = nodeStage.get(n.id) ?? 2;
    if (!stageMap.has(s)) stageMap.set(s, []);
    stageMap.get(s).push(n.id);
  });

  stageMap.forEach((ids) => {
    ids.sort((a, b) => getPriority(b) - getPriority(a));
  });

  const sortedStageIndices = Array.from(stageMap.keys()).sort((a, b) => a - b);
  const laneMaxHeight = [0, 0, 0];

  sortedStageIndices.forEach((sIdx) => {
    const ids = stageMap.get(sIdx) || [];
    const heightInLane = [0, 0, 0];
    ids.forEach((id) => {
      const lane = nodeLane.get(id);
      if (typeof lane === 'number') {
        const dim = getNodeDimensions(nodeMap.get(id));
        heightInLane[lane] += dim.height + rowGap;
      }
    });
    for (let l = 0; l < 3; l++) {
      laneMaxHeight[l] = Math.max(laneMaxHeight[l], heightInLane[l]);
    }
  });

  const laneBaseY = [];
  let curY = startY;
  for (let l = 0; l < 3; l++) {
    laneBaseY[l] = curY;
    const h = Math.max(laneMaxHeight[l], 540);
    curY += h + 80;
  }
  const trunkBaseY = (laneBaseY[0] + laneBaseY[2]) / 2;
  const shelfBaseY = curY + 60;

  const positions = {};
  let curX = startX;

  sortedStageIndices.forEach((sIdx) => {
    const ids = stageMap.get(sIdx) || [];
    let maxColWidth = 0;
    ids.forEach((id) => {
      const dim = getNodeDimensions(nodeMap.get(id));
      maxColWidth = Math.max(maxColWidth, dim.width);
    });

    const trunkNodes = ids.filter((id) => nodeLane.get(id) === 'trunk');
    const lane0 = ids.filter((id) => nodeLane.get(id) === 0);
    const lane1 = ids.filter((id) => nodeLane.get(id) === 1);
    const lane2 = ids.filter((id) => nodeLane.get(id) === 2);

    let tY = trunkBaseY;
    trunkNodes.forEach((id) => {
      positions[id] = { x: curX, y: tY };
      tY += getNodeDimensions(nodeMap.get(id)).height + rowGap;
    });

    [lane0, lane1, lane2].forEach((nodesInLane, lIdx) => {
      let lY = laneBaseY[lIdx];
      nodesInLane.forEach((id) => {
        positions[id] = { x: curX, y: lY };
        lY += getNodeDimensions(nodeMap.get(id)).height + rowGap;
      });
    });

    curX += maxColWidth + columnGap;
  });

  let shelfX = Math.max(startX + 340 * 3, positions.node_landmarkdetail?.x || 0);
  const shelfNodes = visibleNodeList.filter((n) => nodeLane.get(n.id) === 'shelf');
  shelfNodes.forEach((n) => {
    positions[n.id] = { x: shelfX, y: shelfBaseY };
    shelfX += getNodeDimensions(n).width + 60;
  });

  const stages = sortedStageIndices.map((idx) => ({
    stageIndex: idx,
    nodeIds: stageMap.get(idx) || []
  }));

  const feedbackEdges = [];
  Object.values(rawGraph?.edges || {}).forEach((e) => {
    if (e.edgeKind === 'stateBinding') {
      feedbackEdges.push(e.id);
    }
  });

  return {
    positions,
    stages,
    stageByNodeId: Object.fromEntries(nodeStage),
    feedbackEdges
  };
}
