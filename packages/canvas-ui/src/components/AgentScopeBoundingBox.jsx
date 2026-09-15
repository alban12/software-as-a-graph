import React from 'react';
import { ShieldCheck, FileText, Unlock, AlertTriangle } from 'lucide-react';

export default function AgentScopeBoundingBox({
  scope,
  nodes,
  onOpenModal,
  onUnlock
}) {
  if (!scope || !scope.lockedNodeIds || scope.lockedNodeIds.length === 0) return null;

  const scopedNodes = nodes.filter((n) => scope.lockedNodeIds.includes(n.id));
  if (scopedNodes.length === 0) return null;

  // Calculate bounding box in canvas coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const DEFAULT_WIDTH = 280;
  const DEFAULT_HEIGHT = 200;

  scopedNodes.forEach((node) => {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    // Estimate node height/width or use canvasMeta
    const w = node.measured?.width || node.width || DEFAULT_WIDTH;
    const h = node.measured?.height || node.height || DEFAULT_HEIGHT;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  });

  const PADDING = 28;
  const boxX = minX - PADDING;
  const boxY = minY - PADDING;
  const boxWidth = maxX - minX + PADDING * 2;
  const boxHeight = maxY - minY + PADDING * 2;

  return (
    <div
      className="agent-scope-bounding-box"
      style={{
        position: 'absolute',
        transform: `translate(${boxX}px, ${boxY}px)`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        pointerEvents: 'none' // Allow interaction with nodes inside
      }}
    >
      {/* Floating Scope Header Banner */}
      <div className="agent-scope-header-banner" style={{ pointerEvents: 'auto' }}>
        <div className="scope-badge-group">
          <span className="scope-icon-pulse">🤖</span>
          <div className="scope-title-info">
            <span className="scope-name-label">{scope.name}</span>
            <span className="scope-count-pill">{scopedNodes.length} NODES LOCKED</span>
          </div>
        </div>

        <div className="scope-header-actions">
          <button
            type="button"
            className="scope-btn"
            onClick={() => onOpenModal('prompt')}
            title="Inspect Agent System Prompt & Contracts"
          >
            <FileText size={12} />
            <span>Prompt Contract</span>
          </button>

          <button
            type="button"
            className="scope-btn validate"
            onClick={() => onOpenModal('validate')}
            title="Check Git Diff for Scope Violations"
          >
            <ShieldCheck size={12} />
            <span>Validate Diff</span>
          </button>

          <button
            type="button"
            className="scope-btn unlock"
            onClick={onUnlock}
            title="Unlock Scope / Release Nodes"
          >
            <Unlock size={12} />
            <span>Unlock</span>
          </button>
        </div>
      </div>

      {/* Perimeter Watermark / Guardrail Label */}
      <div className="scope-boundary-label">
        <span>🔒 STRICT AGENT BOUNDARY · MODIFICATIONS CONFINED TO THIS PERIMETER</span>
      </div>
    </div>
  );
}
