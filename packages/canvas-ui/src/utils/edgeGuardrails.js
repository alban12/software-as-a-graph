/**
 * SaaG Architectural Edge Guardrail Engine
 * Enforces Clean Architecture, layer separation, socket contracts, and scope protection.
 */

export const GUARDRAIL_RULES = {
  SELF_LOOP: 'RULE_NO_SELF_LOOPS',
  LAYER_VIEW_TO_REPOSITORY: 'RULE_VIEW_CANNOT_BYPASS_VIEWMODEL',
  LAYER_SERVICE_TO_VIEW: 'RULE_SERVICE_CANNOT_DRIVE_VIEW_DIRECTLY',
  DUPLICATE_EDGE: 'RULE_DUPLICATE_CONNECTION',
  AGENT_SCOPE_BOUNDARY_LOCKED: 'RULE_FROZEN_BOUNDARY_VIOLATION',
  INVALID_PORT_DIRECTION: 'RULE_INVALID_DIRECTION'
};

/**
 * Validates whether an edge connection between source and target nodes/ports is permitted.
 * 
 * @param {Object} connection { source, target, sourceHandle, targetHandle }
 * @param {Object} rawGraph { nodes, edges }
 * @param {Array} existingEdges Array of current React Flow edges
 * @param {Object} activeScope Active agent workspace contract if present
 * @returns {Object} { isValid: boolean, reason?: string, rule?: string }
 */
export function validateEdgeConnection(connection, rawGraph, existingEdges = [], activeScope = null) {
  const { source, target, sourceHandle, targetHandle } = connection;

  if (!source || !target) {
    return { isValid: false, reason: 'Source or target node not specified.', rule: 'INVALID_ENDPOINT' };
  }

  // 1. Self-Loop Guardrail
  if (source === target) {
    return {
      isValid: false,
      rule: GUARDRAIL_RULES.SELF_LOOP,
      reason: 'Self-connections are prohibited. A component cannot call its own sockets in a dataflow pipeline.'
    };
  }

  const sourceNode = rawGraph?.nodes?.[source];
  const targetNode = rawGraph?.nodes?.[target];

  if (!sourceNode || !targetNode) {
    return { isValid: false, reason: 'Referenced node does not exist in graph.', rule: 'NODE_NOT_FOUND' };
  }

  // 2. Duplicate Edge Guardrail
  const isDuplicate = existingEdges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (sourceHandle ? e.sourceHandle === sourceHandle : true) &&
      (targetHandle ? e.targetHandle === targetHandle : true)
  );

  if (isDuplicate) {
    return {
      isValid: false,
      rule: GUARDRAIL_RULES.DUPLICATE_EDGE,
      reason: `An active connection already exists between ${sourceNode.name} and ${targetNode.name}.`
    };
  }

  // 3. Architectural Layer Separation Guardrails (Clean Architecture / MVVM)
  // Rule A: View layer cannot directly access Repository layer or low-level storage
  if (sourceNode.kind === 'view' && targetNode.kind === 'repository') {
    return {
      isValid: false,
      rule: GUARDRAIL_RULES.LAYER_VIEW_TO_REPOSITORY,
      reason: `Architectural Violation: View layer (${sourceNode.name}) cannot directly access Repository (${targetNode.name}). UI interactions must route through an Observable ViewModel.`
    };
  }

  // Rule B: Services and Repositories cannot drive Views directly
  if ((sourceNode.kind === 'service' || sourceNode.kind === 'repository') && targetNode.kind === 'view') {
    return {
      isValid: false,
      rule: GUARDRAIL_RULES.LAYER_SERVICE_TO_VIEW,
      reason: `Architectural Violation: Backend ${sourceNode.kind} (${sourceNode.name}) cannot directly drive UI View (${targetNode.name}). State must be managed through an intermediate ViewModel.`
    };
  }

  // 4. Agent Scope Frozen Boundary Guardrail
  if (activeScope && activeScope.lockedNodeIds?.length > 0) {
    const lockedSet = new Set(activeScope.lockedNodeIds);
    const sourceInScope = lockedSet.has(source);
    const targetInScope = lockedSet.has(target);

    // If source or target is a frozen boundary port, verify connection integrity
    if (activeScope.frozenBoundaryPorts?.length > 0) {
      const isSourceFrozen = activeScope.frozenBoundaryPorts.some(
        (p) => p.nodeId === source && p.portId === sourceHandle
      );
      const isTargetFrozen = activeScope.frozenBoundaryPorts.some(
        (p) => p.nodeId === target && p.portId === targetHandle
      );

      if ((isSourceFrozen && !targetInScope) || (isTargetFrozen && !sourceInScope)) {
        return {
          isValid: false,
          rule: GUARDRAIL_RULES.AGENT_SCOPE_BOUNDARY_LOCKED,
          reason: `Security Guardrail: Port is part of an active frozen Agent Boundary contract and cannot be rerouted outside its locked workspace.`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Automatically infers realistic edge contract, kind, and execution metadata based on connected components.
 */
export function inferEdgeContract(sourceNode, targetNode, targetPortId) {
  const isViewSource = sourceNode?.kind === 'view';
  const edgeKind = isViewSource ? 'eventEmit' : 'call';
  
  // Look up target port
  const targetPort = targetNode?.inputs?.find((p) => p.id === targetPortId);
  const isAsync = targetPort?.isAsync !== false && (targetNode?.kind === 'service' || targetNode?.kind === 'repository');
  const executionMode = isAsync ? 'async' : 'sync';

  const payloadType = targetPort?.typeAnnotation || 'Void';
  const isCriticalPath = targetNode?.kind === 'service';
  const averageLatencyMs = isCriticalPath ? 380 : (isAsync ? 25 : 6);

  return {
    edgeKind,
    executionMode,
    contract: {
      payloadType,
      guarantees: ['TypeSafePayload', 'NonBlocking']
    },
    perfMeta: {
      averageLatencyMs,
      isCriticalPath
    }
  };
}
