/**
 * SaaG Cross-Project Reference Utilities
 * 
 * URI Schema: saag://<projectType>/<projectId>/<nodeId>
 * Examples:
 * - saag://ios/landmarks/node_landmarkdetail
 * - saag://agents/agent_orchestrator/node_supervisor_agent
 * - saag://ml/ml_pipeline/node_vllm_engine
 */

export function parseSaagUri(uri) {
  if (!uri || typeof uri !== 'string' || !uri.startsWith('saag://')) {
    return null;
  }
  const clean = uri.replace('saag://', '');
  const [projectType, projectId, nodeId] = clean.split('/');

  if (!projectType || !projectId) {
    return null;
  }

  const typeIcons = {
    ios: '📱',
    agents: '🤖',
    ml: '🧠'
  };

  const typeLabels = {
    ios: 'iOS App',
    agents: 'Agents Graph',
    ml: 'ML Graph'
  };

  return {
    uri,
    projectType,
    projectId,
    nodeId: nodeId || null,
    icon: typeIcons[projectType] || '🔗',
    typeLabel: typeLabels[projectType] || 'Cross-Reference'
  };
}

export function formatCrossReferenceLabel(ref) {
  if (!ref) return '';
  if (ref.label) return ref.label;
  const parsed = parseSaagUri(ref.targetUri);
  if (!parsed) return ref.targetUri || 'Cross-Reference';
  const nodePart = parsed.nodeId ? `: ${parsed.nodeId.replace(/^node_/, '')}` : '';
  return `${parsed.icon} ${parsed.typeLabel} (${parsed.projectId}${nodePart})`;
}
