import { resolveProjectGraph } from '../projectResolver.js';

export const getNodeContractSchema = {
  name: 'get_node_contract',
  description: 'Fetches the full interface contract and architectural boundaries for a specific node, including socket inputs/outputs, state properties, source file location, and permitted architectural layers.',
  inputSchema: {
    type: 'object',
    required: ['nodeId'],
    properties: {
      project: {
        type: 'string',
        description: 'Project ID or file path to graph.json. Defaults to "landmarks".'
      },
      nodeId: {
        type: 'string',
        description: 'The unique ID or exact name of the node (e.g., "node_login_view" or "LoginView").'
      }
    }
  }
};

export async function executeGetNodeContract(args = {}) {
  if (!args.nodeId) {
    throw new Error('Missing required parameter: "nodeId"');
  }

  const { graph, projectId, projectName } = resolveProjectGraph(args.project || 'landmarks');
  const nodes = graph.nodes || {};

  // Find by exact id or match by name
  let targetNode = nodes[args.nodeId];
  let resolvedNodeId = args.nodeId;

  if (!targetNode) {
    const foundEntry = Object.entries(nodes).find(
      ([id, n]) => n.name === args.nodeId || n.name?.toLowerCase() === args.nodeId.toLowerCase()
    );
    if (foundEntry) {
      resolvedNodeId = foundEntry[0];
      targetNode = foundEntry[1];
    }
  }

  if (!targetNode) {
    const availableNodes = Object.values(nodes).map((n) => `${n.name} (${n.id})`);
    throw new Error(
      `Node "${args.nodeId}" not found in project "${projectId}". Available nodes: ${availableNodes.slice(0, 10).join(', ')}...`
    );
  }

  // Find incoming and outgoing edges
  const incoming = [];
  const outgoing = [];

  Object.values(graph.edges || {}).forEach((edge) => {
    if (edge.targetNodeId === resolvedNodeId) {
      incoming.push({
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourceNodeName: nodes[edge.sourceNodeId]?.name || edge.sourceNodeId,
        sourceKind: nodes[edge.sourceNodeId]?.kind || 'unknown',
        edgeKind: edge.edgeKind,
        contract: edge.contract || null
      });
    }
    if (edge.sourceNodeId === resolvedNodeId) {
      outgoing.push({
        edgeId: edge.id,
        targetNodeId: edge.targetNodeId,
        targetNodeName: nodes[edge.targetNodeId]?.name || edge.targetNodeId,
        targetKind: nodes[edge.targetNodeId]?.kind || 'unknown',
        edgeKind: edge.edgeKind,
        contract: edge.contract || null
      });
    }
  });

  // Allowed architectural layers for this node kind
  const layerRules = {
    view: {
      allowedUpstream: ['view (as container)'],
      allowedDownstream: ['viewModel', 'stateStore'],
      forbiddenDownstream: ['service', 'repository', 'database']
    },
    viewModel: {
      allowedUpstream: ['view'],
      allowedDownstream: ['service', 'repository', 'stateStore'],
      forbiddenDownstream: ['view (cannot directly drive UI without state)']
    },
    service: {
      allowedUpstream: ['viewModel', 'service'],
      allowedDownstream: ['repository', 'network', 'database'],
      forbiddenDownstream: ['view']
    },
    repository: {
      allowedUpstream: ['viewModel', 'service'],
      allowedDownstream: ['database', 'storage', 'keychain'],
      forbiddenDownstream: ['view']
    },
    supervisor: {
      allowedUpstream: ['user', 'gateway'],
      allowedDownstream: ['worker', 'router', 'gate'],
      forbiddenDownstream: []
    },
    worker: {
      allowedUpstream: ['supervisor', 'router'],
      allowedDownstream: ['tool', 'memory', 'supervisor'],
      forbiddenDownstream: []
    },
    model: {
      allowedUpstream: ['preprocessor', 'dataset'],
      allowedDownstream: ['optimizer', 'adapter', 'hardware'],
      forbiddenDownstream: []
    }
  };

  const defaultRule = {
    allowedUpstream: ['*'],
    allowedDownstream: ['*'],
    forbiddenDownstream: []
  };

  const rulesForKind = layerRules[targetNode.kind] || defaultRule;

  // Check agent scope
  const activeScope = graph.activeWorkspace;
  let scopeStatus = 'unscoped';
  if (activeScope) {
    if (activeScope.scopedNodeIds?.includes(resolvedNodeId)) {
      scopeStatus = 'active_edit_scope';
    } else if (activeScope.boundaryNodeIds?.includes(resolvedNodeId)) {
      scopeStatus = 'frozen_boundary_contract';
    } else {
      scopeStatus = 'out_of_scope';
    }
  }

  return {
    projectId,
    projectName,
    nodeId: resolvedNodeId,
    name: targetNode.name,
    kind: targetNode.kind,
    filePath: targetNode.filePath || null,
    lineSpan: targetNode.lineSpan || null,
    scopeStatus,
    stateProps: targetNode.stateProps || [],
    sockets: targetNode.sockets || { inputs: [], outputs: [] },
    viewElements: targetNode.viewElements || [],
    diagnostics: targetNode.diagnostics || null,
    activeConnections: {
      incoming,
      outgoing
    },
    architecturalGuardrails: rulesForKind
  };
}
