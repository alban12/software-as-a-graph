/**
 * Scope Contract generator and utility for SaaG Agent Workspaces
 */

export function generateScopeContract(
  nodeIds,
  rawGraph,
  name = 'Scoped Agent Workspace',
  options = {}
) {
  if (!rawGraph || !nodeIds || nodeIds.length === 0) return null;

  const { taskObjective = '' } = options;
  const lockedSet = new Set(nodeIds);
  const allowedFilesSet = new Set();
  const allGraphFilesSet = new Set();

  Object.values(rawGraph.nodes || {}).forEach((node) => {
    const filePath = node.sourceAnchor?.filePath;
    if (filePath) {
      allGraphFilesSet.add(filePath);
      if (lockedSet.has(node.id)) {
        allowedFilesSet.add(filePath);
      }
    }
  });

  const allowedFilePaths = Array.from(allowedFilesSet).sort();
  const forbiddenFilePaths = Array.from(allGraphFilesSet)
    .filter((f) => !allowedFilesSet.has(f))
    .sort();

  // Compute boundary ports
  const frozenPortsMap = {};

  Object.values(rawGraph.edges || {}).forEach((edge) => {
    const srcInScope = lockedSet.has(edge.sourceNodeId);
    const tgtInScope = lockedSet.has(edge.targetNodeId);

    if (srcInScope === tgtInScope) return; // both in or both out

    const srcNode = rawGraph.nodes[edge.sourceNodeId];
    const tgtNode = rawGraph.nodes[edge.targetNodeId];

    if (!srcInScope && tgtInScope) {
      // Inbound to scope
      const port = (tgtNode?.inputs || []).find((p) => p.id === edge.targetPortId);
      if (port && tgtNode) {
        frozenPortsMap[port.id] = {
          nodeId: tgtNode.id,
          nodeName: tgtNode.name,
          portId: port.id,
          portName: port.name,
          direction: 'input',
          typeAnnotation: port.typeAnnotation || 'Any',
          connectedToNodeId: srcNode?.id,
          connectedToNodeName: srcNode?.name
        };
      }
    } else if (srcInScope && !tgtInScope) {
      // Outbound from scope
      const port = (srcNode?.outputs || []).find((p) => p.id === edge.sourcePortId);
      if (port && srcNode) {
        frozenPortsMap[port.id] = {
          nodeId: srcNode.id,
          nodeName: srcNode.name,
          portId: port.id,
          portName: port.name,
          direction: 'output',
          typeAnnotation: port.typeAnnotation || 'Any',
          connectedToNodeId: tgtNode?.id,
          connectedToNodeName: tgtNode?.name
        };
      }
    }
  });

  const frozenBoundaryPorts = Object.values(frozenPortsMap).sort((a, b) =>
    a.portName.localeCompare(b.portName)
  );

  const inboundBoundaryPorts = frozenBoundaryPorts.filter((p) => p.direction === 'input');
  const outboundBoundaryPorts = frozenBoundaryPorts.filter((p) => p.direction === 'output');

  // Compute External Downstream Blast Radius
  // If state or logic within this scope changes, which nodes outside the scope are affected?
  const externalImpactedMap = new Map();
  Object.values(rawGraph.edges || {}).forEach((edge) => {
    if (lockedSet.has(edge.sourceNodeId) && !lockedSet.has(edge.targetNodeId)) {
      const targetNode = rawGraph.nodes[edge.targetNodeId];
      if (targetNode) {
        externalImpactedMap.set(targetNode.id, {
          id: targetNode.id,
          name: targetNode.name,
          kind: targetNode.kind,
          edgeType: edge.edgeType || edge.executionMode || 'dependency'
        });
      }
    }
  });
  const externalBlastRadius = {
    count: externalImpactedMap.size,
    impactedNodes: Array.from(externalImpactedMap.values())
  };

  const scopeId = `scope_${Math.random().toString(36).substring(2, 10)}`;

  const lockedNodeNames = nodeIds
    .map((id) => rawGraph.nodes[id]?.name)
    .filter(Boolean)
    .join(', ');

  const allowedList = allowedFilePaths.map((f) => `- \`${f}\``).join('\n');
  const forbiddenList = forbiddenFilePaths.length > 0
    ? forbiddenFilePaths.map((f) => `- \`${f}\``).join('\n')
    : '- None';

  const boundarySection = frozenBoundaryPorts.length > 0
    ? frozenBoundaryPorts.map((bp) => {
        const dirIcon = bp.direction === 'input' ? '📥 IN' : '📤 OUT';
        const peer = bp.connectedToNodeName ? ` (connected with ${bp.connectedToNodeName})` : '';
        return `- **${dirIcon}** \`${bp.nodeName}.${bp.portName}\`: \`${bp.typeAnnotation}\`${peer} [IMMUTABLE]`;
      }).join('\n')
    : '- No external boundary interfaces crossed.';

  const taskSection = taskObjective?.trim()
    ? `\n## 🎯 Task Objective & Scope Boundary\n${taskObjective.trim()}\n`
    : '';

  const agentPrompt = `# Autonomous AI Agent Scoping Contract
**Scope Name:** ${name}
**Scope ID:** \`${scopeId}\`
**Target Components:** ${lockedNodeNames}
${taskSection}
## 1. Allowed Files (READ/WRITE PERMISSION GRANTED)
You are STRICTLY authorized to inspect and modify ONLY the following files:
${allowedList}

## 2. Frozen Boundary Contracts (IMMUTABLE INTERFACES)
The following socket signatures define external boundaries connecting to other architectural subsystems. You MUST NOT change method names, argument types, or return types for these interfaces:
${boundarySection}

## 3. Forbidden Files (ACCESS DENIED)
Do NOT modify, delete, or rename any of the following files:
${forbiddenList}

## 4. Architectural Rules
- Preserve all existing public contracts on boundary types.
- Every code modification must satisfy \`swift test\`.
- Any change to files outside Section 1 will trigger an immediate architectural scope violation.
`;

  return {
    id: scopeId,
    name,
    description: `Agent scope locking ${nodeIds.length} nodes with ${frozenBoundaryPorts.length} boundary contracts`,
    lockedNodeIds: nodeIds,
    allowedFilePaths,
    frozenBoundaryPorts,
    inboundBoundaryPorts,
    outboundBoundaryPorts,
    forbiddenFilePaths,
    externalBlastRadius,
    taskObjective: taskObjective?.trim() || '',
    agentPrompt
  };
}
