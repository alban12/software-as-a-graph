import { resolveProjectGraph } from '../projectResolver.js';
import { isSystemDesignNode, computeAdaptiveTreeLayout, decomposeAppTree } from '../../../canvas-ui/src/analysis/treeEngine.js';
import { computeTemporalPipelineLayout } from '../../../canvas-ui/src/analysis/pipelineEngine.js';
import { computeMeshForceLayout } from '../../../canvas-ui/src/analysis/meshEngine.js';

export function filterNodesByLevel(graph, level = 'L2') {
  const nodes = graph?.nodes || {};
  const filtered = {};

  Object.entries(nodes).forEach(([id, node]) => {
    // Exclude micro test runners and vector drawing helpers unless at L3 Details level
    if (level !== 'L3' && !isSystemDesignNode(node)) {
      return;
    }

    const nodeLevel = node.abstractionLevel || (node.kind === 'view' ? 'L1_SCREEN' : 'L2_COMPONENT');

    if (level === 'L1') {
      if (
        nodeLevel === 'L1_SCREEN' ||
        nodeLevel === 'L1_SYSTEM' ||
        node.kind === 'viewModel' ||
        node.kind === 'supervisor' ||
        node.kind === 'hardware' ||
        node.kind === 'model'
      ) {
        filtered[id] = node;
      }
    } else if (level === 'L2') {
      if (nodeLevel !== 'L3_PRIMITIVE' && nodeLevel !== 'L3_EXECUTION') {
        filtered[id] = node;
      }
    } else {
      // L3: return all
      filtered[id] = node;
    }
  });

  return filtered;
}

export const getArchitectureGraphSchema = {
  name: 'get_architecture_graph',
  description: 'Retrieves the architectural graph (nodes, edges, socket contracts) for an application or system design. Supports filtering by Abstraction Level (L1 System, L2 Components, L3 Details), domain (ios, agent, ml), and spatial layout perspective (tree, pipeline, mesh).',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project ID or file path to graph.json. Known projects: "landmarks", "makeitso", "auth-sample", "agent-orchestrator", "ml-pipeline". Defaults to "landmarks".'
      },
      level: {
        type: 'string',
        enum: ['L1', 'L2', 'L3'],
        description: 'Abstraction level: "L1" (High-level journey/system), "L2" (Components & stores), "L3" (Full details with test runners and leaf helpers). Defaults to "L2".'
      },
      domain: {
        type: 'string',
        enum: ['ios', 'agent', 'ml'],
        description: 'Filter for domain type: "ios", "agent", or "ml".'
      },
      layoutMode: {
        type: 'string',
        enum: ['tree', 'pipeline', 'mesh'],
        description: 'Spatial layout perspective: "tree" (Top-down hierarchy), "pipeline" (Left-to-right temporal causality), or "mesh" (Equidistant force-directed peer network). Defaults to "tree".'
      }
    }
  }
};

export async function executeGetArchitectureGraph(args = {}) {
  const projectRef = args.project || 'landmarks';
  const { graph, graphPath, projectId, projectName, domain } = resolveProjectGraph(projectRef);

  let targetLevel = args.level || 'L2';
  if (!['L1', 'L2', 'L3'].includes(targetLevel)) {
    targetLevel = 'L2';
  }

  const targetLayoutMode = args.layoutMode || 'tree';

  const filteredNodes = filterNodesByLevel(graph, targetLevel);
  const visibleNodeIds = new Set(Object.keys(filteredNodes));

  // Filter edges where both source and target are visible
  const visibleEdges = {};
  Object.entries(graph.edges || {}).forEach(([edgeId, edge]) => {
    if (visibleNodeIds.has(edge.sourceNodeId) && visibleNodeIds.has(edge.targetNodeId)) {
      visibleEdges[edgeId] = edge;
    }
  });

  // Calculate layout coordinates for target mode
  const nodeList = Object.values(filteredNodes);
  let layoutPositions = {};

  if (targetLayoutMode === 'pipeline') {
    const pipelineRes = computeTemporalPipelineLayout(nodeList, graph);
    layoutPositions = pipelineRes.positions || {};
  } else if (targetLayoutMode === 'mesh') {
    const meshRes = computeMeshForceLayout(nodeList, graph);
    layoutPositions = meshRes.positions || {};
  } else {
    // tree
    const treeData = decomposeAppTree(graph);
    layoutPositions = computeAdaptiveTreeLayout(nodeList, treeData, graph) || {};
  }

  // Inject spatial coordinates into returned nodes
  const nodesWithPositions = {};
  Object.entries(filteredNodes).forEach(([id, node]) => {
    nodesWithPositions[id] = {
      ...node,
      position: layoutPositions[id] || node.canvasMeta?.position || { x: 0, y: 0 }
    };
  });

  return {
    projectId,
    projectName,
    domain,
    graphPath,
    abstractionLevel: targetLevel,
    layoutMode: targetLayoutMode,
    nodeCount: Object.keys(filteredNodes).length,
    edgeCount: Object.keys(visibleEdges).length,
    nodes: nodesWithPositions,
    edges: visibleEdges,
    activeWorkspace: graph.activeWorkspace || null
  };
}
