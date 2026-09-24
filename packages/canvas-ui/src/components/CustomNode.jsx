import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Layers, ChevronDown, ChevronRight, Code2, Database, Globe, Cpu,
  Smartphone, Flame, Minimize2, Maximize2, ExternalLink, Lock, Bot,
  AlertTriangle, Zap, Server, Activity, Rocket, Wrench, GitFork,
  ShieldCheck, Brain, Edit3, Check, X as XIcon, Star
} from 'lucide-react';
import ScreenPreview from './ScreenPreview';
import FirebaseLogo from './FirebaseLogo';
import { parseSaagUri } from '../utils/crossReferences';

const KIND_ICONS = {
  // iOS / Native Client
  app: Smartphone,
  view: Globe,
  viewModel: Layers,
  service: Cpu,
  repository: Database,
  // Multi-Agent System
  agent: Bot,
  tool: Wrench,
  router: GitFork,
  gate: ShieldCheck,
  // Distributed ML & Hardware
  dataset: Database,
  preprocessor: Cpu,
  model: Brain,
  adapter: Layers,
  optimizer: Zap,
  hardware: Server,
  interconnect: Activity,
  exporter: Rocket,
};

function ViewElementBadge({ element, filePath, nodeId, onUpdateViewElement }) {
  const [isEditing, setIsEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(element.label || '');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLabelValue(element.label || '');
  }, [element.label]);

  const handleSave = async (e) => {
    e?.stopPropagation?.();
    const trimmed = labelValue.trim();
    if (!trimmed || trimmed === element.label) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const ok = await onUpdateViewElement?.({
        nodeId,
        elementId: element.id,
        oldLabel: element.label,
        newLabel: trimmed,
        lineSpan: element.startLine ? { startLine: element.startLine, endLine: element.endLine } : undefined,
        filePath
      });
      if (ok) {
        setJustSaved(true);
        setIsEditing(false);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (e) => {
    e?.stopPropagation?.();
    setLabelValue(element.label || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel(e);
    }
  };

  const isStar = element.systemImage?.includes('star');
  const isList = element.systemImage?.includes('list');

  if (isEditing) {
    return (
      <div className="view-element-edit-box" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className="view-element-input"
          value={labelValue}
          autoFocus
          onFocus={(e) => e.target.select()}
          disabled={isSaving}
          onChange={(e) => setLabelValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New label..."
        />
        <div className="view-element-edit-actions">
          <button
            type="button"
            className="view-element-btn save"
            onClick={handleSave}
            disabled={isSaving || !labelValue.trim()}
            title="Save to Swift source (Enter)"
          >
            {isSaving ? '...' : <Check size={11} />}
          </button>
          <button
            type="button"
            className="view-element-btn cancel"
            onClick={handleCancel}
            disabled={isSaving}
            title="Cancel (Esc)"
          >
            <XIcon size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`view-element-badge ${justSaved ? 'just-saved' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title={`Click to edit Swift source in-place (L${element.startLine || '?'})`}
    >
      <div className="element-badge-left">
        {isStar ? (
          <span className="element-icon">★</span>
        ) : isList ? (
          <span className="element-icon">☰</span>
        ) : (
          <span className="element-icon">🏷️</span>
        )}
        <span className="element-tag">{element.type || 'element'}</span>
        <span className="element-label-text">"{element.label}"</span>
      </div>
      <div className="element-badge-right">
        {element.startLine && <span className="element-line-pill">L{element.startLine}</span>}
        <button
          className="element-edit-pencil-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          title="Edit in Swift file"
        >
          <Edit3 size={10} />
        </button>
      </div>
    </div>
  );
}

function CustomNode({ id, data, selected }) {
  const [collapsed, setCollapsed] = useState(data.canvasMeta?.isCollapsed ?? false);
  const [showScreenPreview, setShowScreenPreview] = useState(true);
  const IconComponent = KIND_ICONS[data.kind] || Cpu;

  const isViewNode = data.kind === 'view';

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const isSimActive = data.simulationStatus === 'active';
  const isSimError = data.simulationStatus === 'error';
  const isSimMutated = data.simulationStatus === 'mutated';
  const isSimDimmed = data.simulationStatus === 'dimmed';

  const isInAgentContext = Boolean(data.agentNodeIds?.includes(id));
  const retainRisks = data.perfMeta?.retainCycleRisks || [];
  const hasRetainRisk = retainRisks.length > 0;
  const activePerf = (isSimActive || isSimError) ? data.activeStepPerf : null;

  const hasBottlenecks = Boolean(data.isBottleneckLensActive && data.bottlenecks && data.bottlenecks.length > 0);
  const primaryBottleneck = hasBottlenecks ? data.bottlenecks[0] : null;

  let simClasses = '';
  if (isSimActive) simClasses += ' sim-active';
  if (isSimError) simClasses += ' sim-error';
  if (isSimMutated) simClasses += ' sim-mutated';
  if (isSimDimmed) simClasses += ' sim-dimmed';
  if (isInAgentContext) simClasses += ' node-agent-selected';
  if (data.isDimmedByScope && !isInAgentContext) simClasses += ' node-scope-dimmed';
  if (hasBottlenecks) simClasses += ' node-bottleneck-pulse';
  if (data.isBranchDimmed) simClasses += ' branch-dimmed';

  // Squeezed Pass-Through Capsule Rendering
  if (data.isSqueezed) {
    return (
      <div className={`saag-node squeezed kind-${data.kind} ${selected ? 'selected' : ''} ${simClasses}`}>
        {data.inputs && data.inputs.length > 0 ? (
          data.inputs.map((port) => (
            <Handle
              key={port.id}
              type="target"
              position={Position.Left}
              id={port.id}
              style={{ top: '50%' }}
            />
          ))
        ) : (
          <Handle
            type="target"
            position={Position.Left}
            id={`${id}_in`}
            style={{ top: '50%' }}
          />
        )}

        <div className="squeezed-capsule">
          <div className="squeezed-info">
            <IconComponent size={13} color="var(--color-view)" />
            <span className="squeezed-name">{data.name}</span>
            <span className="squeezed-tag">⚡ Pass-Through</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className={`squeezed-action-btn ${isInAgentContext ? 'agent-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleAgentNode?.(id);
              }}
              title={isInAgentContext ? "Remove from Agent Context" : "Add to Agent Context"}
            >
              <Bot size={10} color={isInAgentContext ? "#c084fc" : undefined} />
              <span>{isInAgentContext ? "Context ✓" : "+Agent"}</span>
            </button>
            <button
              className="squeezed-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleSqueeze?.(id);
              }}
              title="Expand to full node for inspection"
            >
              <Maximize2 size={10} />
              <span>Debug</span>
            </button>
          </div>
        </div>

        {data.outputs && data.outputs.length > 0 ? (
          data.outputs.map((port) => (
            <Handle
              key={port.id}
              type="source"
              position={Position.Right}
              id={port.id}
              style={{ top: '50%' }}
            />
          ))
        ) : (
          <Handle
            type="source"
            position={Position.Right}
            id={`${id}_out`}
            style={{ top: '50%' }}
          />
        )}
      </div>
    );
  }

  const isCompound = Boolean(data.isCompound);
  const isExpanded = Boolean(data.isExpanded);
  const childNodeIds = data.childNodeIds || [];

  return (
    <div className={`saag-node kind-${data.kind} ${isCompound && isExpanded ? 'node-compound-expanded' : ''} ${selected ? 'selected' : ''} ${simClasses}`}>
      {/* Node Header */}
      <div className="node-header">
        <div className="node-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="node-kind-badge">{data.kind}</span>
            {data.level && (
              <span className={`node-level-badge level-${(data.level || '').toLowerCase()}`}>
                {data.level === 'L1_SCREEN' ? 'L1 Screen' : data.level === 'L1_SYSTEM' ? 'L1 System' : data.level === 'L2_COMPONENT' ? 'L2 Component' : data.level === 'L3_EXECUTION' ? 'L3 Execution' : 'L3 Primitive'}
              </span>
            )}
            {data.name === 'CategoryHome' && (
              <span className="tab-indicator-badge featured">★ Tab: Featured</span>
            )}
            {data.name === 'LandmarkList' && (
              <span className="tab-indicator-badge list">☰ Tab: List</span>
            )}
            {(data.name === 'ContentView' || data.name?.toLowerCase().includes('content') || data.id === 'node_contentview') && (
              <span className="tab-indicator-badge container">🗂️ TabView Container</span>
            )}
          </div>
          <div className="node-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconComponent size={14} />
            <span>{data.name}</span>
            {hasRetainRisk && !hasBottlenecks && (
              <span
                title={`${retainRisks[0]?.description}\n💡 Fix: ${retainRisks[0]?.suggestion}`}
                style={{ color: '#f59e0b', fontSize: '12px', cursor: 'help' }}
              >
                ⚠️
              </span>
            )}
            {hasBottlenecks && primaryBottleneck && (
              <button
                className="node-bottleneck-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onOpenBottleneckDrawer?.(primaryBottleneck);
                }}
                title={`Bottleneck Detected: ${primaryBottleneck.title}\n${primaryBottleneck.description}\nClick to open architectural reorganization remedy & Swift code diff`}
              >
                <AlertTriangle size={11} color="#fbbf24" />
                <span>{primaryBottleneck.metricLabel}: {primaryBottleneck.metricValue}</span>
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Compound Node Subviews Expand/Collapse */}
          {isCompound && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleCompound?.(id);
              }}
              className={`screen-toggle-pill compound-toggle-pill ${isExpanded ? 'expanded' : ''}`}
              title={isExpanded ? "Collapse subviews into this screen" : `Expand ${childNodeIds.length} nested subviews on canvas`}
            >
              {isExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              <span>{isExpanded ? "Collapse" : `⤢ ${childNodeIds.length} Subviews`}</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleAgentNode?.(id);
            }}
            className={`screen-toggle-pill agent-pill ${isInAgentContext ? 'active' : ''}`}
            title={isInAgentContext ? "In Agent Context (Click to remove)" : "Add to Agent Context"}
          >
            <Bot size={11} color={isInAgentContext ? "#c084fc" : undefined} />
            <span>{isInAgentContext ? "Context ✓" : "+Agent"}</span>
          </button>
          {data.isTransient && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onToggleSqueeze?.(id);
              }}
              className="screen-toggle-pill"
              title="Squeeze node into compact pass-through"
            >
              <Minimize2 size={12} />
              <span>Squeeze</span>
            </button>
          )}
          {isViewNode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowScreenPreview(!showScreenPreview);
              }}
              className="screen-toggle-pill"
              title="Toggle SwiftUI screen preview"
            >
              <Smartphone size={12} />
              <span>UI</span>
            </button>
          )}
          <button
            onClick={toggleCollapse}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            title={collapsed ? "Expand node" : "Collapse node"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {!collapsed && (
        <>
          {/* Compound Node Nested Subviews Chip Summary (when collapsed into screen) */}
          {isCompound && !isExpanded && childNodeIds.length > 0 && (
            <div className="node-subviews-summary">
              <div className="subviews-summary-header">
                <span>Nested Subviews ({childNodeIds.length})</span>
                <span className="subviews-hint">Click ⤢ to expand</span>
              </div>
              <div className="subviews-chips">
                {childNodeIds.slice(0, 4).map((cid) => {
                  const rawName = cid.replace(/^node_/, '');
                  const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                  return (
                    <span key={cid} className="subview-chip" title={cid}>
                      {cleanName}
                    </span>
                  );
                })}
                {childNodeIds.length > 4 && (
                  <span className="subview-chip more">+{childNodeIds.length - 4} more</span>
                )}
              </div>
            </div>
          )}

          {/* Dedicated External Cloud Backend Indicator Card */}
          {Boolean(data.serviceMeta) && (
            <div
              className="node-service-card"
              onClick={(e) => {
                e.stopPropagation();
                data.onOpenServicePreview?.(data);
              }}
              title="Click to open Firebase Service Inspector"
            >
              <div className="node-service-badge-header">
                <div className="node-service-provider">
                  <div className="service-logo-box">
                    <FirebaseLogo size={20} />
                  </div>
                  <div className="node-service-names">
                    <div className="node-service-title">
                      {data.serviceMeta?.provider || 'Firebase Authentication & Firestore'}
                    </div>
                    <div className="node-service-sub">
                      <span className="service-dot-online" />
                      <span>{data.serviceMeta?.projectRef ? `Project: ${data.serviceMeta.projectRef}` : 'Cloud Service Backend'}</span>
                    </div>
                  </div>
                </div>
                <span className="service-card-inspect-tag">
                  <span>Inspect</span>
                  <ExternalLink size={10} />
                </span>
              </div>
              {data.serviceMeta?.collections && data.serviceMeta.collections.length > 0 && (
                <div className="node-service-collections">
                  <span className="collections-label">Collections:</span>
                  <div className="collections-chips">
                    {data.serviceMeta.collections.map((col, idx) => (
                      <span key={idx} className="collection-chip">{col}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Universal Cross-Project Linkages */}
          {data.crossReferences && data.crossReferences.length > 0 && (
            <div className="node-cross-refs-section">
              <div className="cross-refs-header">
                <span>Cross-Project Links</span>
              </div>
              <div className="cross-refs-pills">
                {data.crossReferences.map((ref, idx) => {
                  const parsed = parseSaagUri(ref.targetUri);
                  return (
                    <button
                      key={idx}
                      className="cross-ref-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        data.onNavigateCrossReference?.(ref.targetUri);
                      }}
                      title={`Jump to: ${ref.targetUri}\nRelationship: ${ref.relationship || 'links_to'}\nContract: ${ref.contract || 'None'}`}
                    >
                      <span className="cross-ref-icon">{parsed?.icon || '🔗'}</span>
                      <span className="cross-ref-label">{ref.label || parsed?.typeLabel || 'Link'}</span>
                      <ExternalLink size={10} className="cross-ref-arrow" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dedicated Hardware Specification Card */}
          {Boolean(data.hardwareMeta) && (
            <div className="node-hardware-card">
              <div className="hardware-card-top">
                <div className="hardware-gpu-badge">
                  <Server size={14} color="#34d399" />
                  <span className="hardware-gpu-title">{data.hardwareMeta.gpuModel || 'GPU Server'}</span>
                </div>
                <span className="hardware-count-tag">{data.hardwareMeta.gpuCount || 1}x SXM5</span>
              </div>
              <div className="hardware-specs-row">
                <span className="hw-chip">⚡ {data.hardwareMeta.vramPerGpuGb}GB / GPU</span>
                <span className="hw-chip">🌐 {data.hardwareMeta.interconnectType}</span>
                <span className="hw-chip">{data.hardwareMeta.computeCapability || 'SM 9.0'}</span>
              </div>
              <div className="vram-meter-box">
                <div className="vram-meter-labels">
                  <span>Cluster VRAM Pool</span>
                  <strong>{(data.hardwareMeta.vramPerGpuGb || 80) * (data.hardwareMeta.gpuCount || 1)} GB HBM3</strong>
                </div>
                <div className="vram-meter-track">
                  <div className="vram-meter-bar" style={{ width: '25%' }} />
                </div>
                <div className="vram-meter-sub">
                  <span>Weights: ~16.1 GB</span>
                  <span>Bus: {data.hardwareMeta.memoryBandwidthTbSec || 3.35} TB/s</span>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated ML Model Architecture Card */}
          {data.kind === 'model' && Boolean(data.mlMeta) && (
            <div className="node-model-card">
              <div className="model-header-specs">
                <span className="model-param-badge">🧠 {data.mlMeta.paramCount || '8B'}</span>
                <span className="model-precision-badge">{data.mlMeta.precision || 'BF16'}</span>
                <span className="model-context-badge">{(data.mlMeta.contextWindow || 8192).toLocaleString()} ctx</span>
              </div>
              <div className="model-framework-row">
                <span>{data.mlMeta.framework || 'PyTorch 2.4 + CuDNN 9.1'}</span>
              </div>
            </div>
          )}

          {/* Dedicated GPU Acceleration / Preprocessor Card */}
          {data.kind === 'preprocessor' && Boolean(data.mlMeta) && (
            <div className="node-preprocessor-card">
              <div className="preprocessor-badge-row">
                <span className="cudf-glow-badge">⚡ {data.mlMeta.framework || 'cuDF GPU Acceleration'}</span>
              </div>
              <div className="preprocessor-throughput-sub">
                <span>Batch: {data.mlMeta.batchSize || 128}</span>
                <span>Throughput: ~1.4 GB/s</span>
              </div>
            </div>
          )}

          {/* Dedicated PEFT Adapter Card */}
          {data.kind === 'adapter' && Boolean(data.mlMeta) && (
            <div className="node-adapter-card">
              <div className="adapter-badge-row">
                <span className="adapter-rank-badge">LoRA Rank: r={data.mlMeta.loraRank || 16}</span>
                <span className="adapter-alpha-badge">α={data.mlMeta.loraAlpha || 32}</span>
              </div>
              <div className="adapter-sub">
                Target: {data.mlMeta.targetModules?.join(', ') || 'q_proj, v_proj'}
              </div>
            </div>
          )}

          {/* Dedicated Optimizer Card */}
          {data.kind === 'optimizer' && Boolean(data.mlMeta) && (
            <div className="node-optimizer-card">
              <div className="optimizer-badge-row">
                <span className="opt-algo-badge">⚡ {data.mlMeta.optimizerType || 'AdamW-8Bit'}</span>
                <span className="opt-zero-badge">ZeRO-{data.mlMeta.zeroStage ?? 3}</span>
              </div>
              <div className="optimizer-sub">
                <span>lr: {data.mlMeta.learningRate || '2e-5'}</span>
                {data.mlMeta.gradientCheckpointing && <span className="chkpt-badge">✓ Grad Checkpointing</span>}
              </div>
            </div>
          )}

          {/* Dedicated Autonomous Agent Card */}
          {data.kind === 'agent' && Boolean(data.agentMeta) && (
            <div className="node-agent-card">
              <div className="agent-role-badge">
                <Bot size={13} color="#c084fc" />
                <span>{data.agentMeta.role || 'Agent'}</span>
              </div>
              {data.agentMeta.authorizedTools && data.agentMeta.authorizedTools.length > 0 && (
                <div className="agent-tools-row">
                  <span className="agent-tools-label">Tools:</span>
                  <div className="agent-tools-chips">
                    {data.agentMeta.authorizedTools.map((t, idx) => (
                      <span key={idx} className="agent-tool-chip">🛠 {t.replace(/^node_/, '')}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dedicated Gate / Approval Checkpoint Card */}
          {data.kind === 'gate' && Boolean(data.gateMeta) && (
            <div className="node-gate-card">
              <div className="gate-badge-row">
                <ShieldCheck size={13} color="#ff9f0a" />
                <span>Human Approval Gate</span>
              </div>
              <div className="gate-role-row">
                Required: <strong>{data.gateMeta.requiredRole || 'Reviewer'}</strong>
              </div>
            </div>
          )}

          {/* Embedded SwiftUI Screen Preview (for View nodes) */}
          {isViewNode && showScreenPreview && (
            <div className="node-preview-wrapper" onClick={(e) => { e.stopPropagation(); data.onOpenPreviewModal?.(data); }}>
              <div className="preview-header-label">
                <span>SwiftUI #Preview (iPhone 16 Pro)</span>
                <span style={{ fontSize: '9px', opacity: 0.8 }}>Zoom 🔍</span>
              </div>
              <ScreenPreview
                size="mini"
                nodeId={data.id}
                filePath={data.sourceAnchor?.filePath}
                nodeName={data.name}
                customState={data.screenState || 'default'}
                viewElements={data.viewElements}
                stateProps={data.stateProps}
                onUpdateViewElement={data.onUpdateViewElement}
                onElementAction={(actionType, payload) => {
                  data.onScreenAction?.(data.id, actionType, payload);
                }}
              />
            </div>
          )}

          {/* Interactive Swift AST Elements (Click-to-Edit) */}
          {data.viewElements && data.viewElements.length > 0 && (
            <div className="node-section node-ast-elements-section">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Code2 size={11} color="var(--color-view)" />
                  <span>Swift AST Elements ({data.viewElements.length})</span>
                </span>
                <span className="ast-edit-hint">Click ✏️ to edit in-place</span>
              </div>
              <div className="view-elements-container">
                {data.viewElements.map((el) => (
                  <ViewElementBadge
                    key={el.id}
                    element={el}
                    filePath={data.sourceAnchor?.filePath}
                    nodeId={id}
                    onUpdateViewElement={data.onUpdateViewElement}
                  />
                ))}
              </div>
            </div>
          )}
          {/* State Variables Section */}
          {data.stateProps && data.stateProps.length > 0 && (
            <div className="node-section">
              <div className="section-label">State & Properties</div>
              <div className="state-tags">
                {data.stateProps.map((prop, idx) => {
                  const isMutated = data.activeMutations && data.activeMutations[prop.name] !== undefined;
                  return (
                    <div
                      key={idx}
                      className={`state-tag ${isMutated ? 'tag-mutated' : ''}`}
                      title={`${prop.wrapperKind || ''} ${prop.name}: ${isMutated ? JSON.stringify(data.activeMutations[prop.name]) : prop.typeAnnotation}`}
                    >
                      {prop.wrapperKind && <span className="wrapper">{prop.wrapperKind}</span>}
                      <span>{prop.name}</span>
                      {isMutated && <span style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 700 }}>*</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sockets / Ports Section */}
          <div className="node-ports-container">
            {/* Fallback target handles to ensure incoming edges always connect */}
            {(!data.inputs || !data.inputs.some((p) => p.id === `${id}_in`)) && (
              <Handle
                type="target"
                position={Position.Left}
                id={`${id}_in`}
                style={{ top: '50%', opacity: (!data.inputs || data.inputs.length === 0) ? 1 : 0, pointerEvents: (!data.inputs || data.inputs.length === 0) ? 'auto' : 'none' }}
              />
            )}
            {/* Fallback source handles to ensure outgoing edges always connect */}
            {(!data.outputs || !data.outputs.some((p) => p.id === `${id}_out`)) && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${id}_out`}
                style={{ top: '50%', opacity: (!data.outputs || data.outputs.length === 0) ? 1 : 0, pointerEvents: (!data.outputs || data.outputs.length === 0) ? 'auto' : 'none' }}
              />
            )}
            {(!data.outputs || !data.outputs.some((p) => p.id === `${id}_out_user_action`)) && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${id}_out_user_action`}
                style={{ top: '50%', opacity: 0, pointerEvents: 'none' }}
              />
            )}

            {/* Input Ports (Left handles) */}
            {data.inputs && data.inputs.map((port) => {
              const isFrozen = Boolean(data.activeScope?.frozenBoundaryPorts?.some((bp) => bp.nodeId === id && bp.portId === port.id));
              return (
                <div key={port.id} className={`port-row ${isFrozen ? 'port-frozen' : ''}`}>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={port.id}
                    style={{ top: '50%' }}
                  />
                  <div className="port-label" style={{ paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isFrozen && (
                      <span className="frozen-port-badge" title="Frozen Boundary Interface: Upstream contract locked">
                        <Lock size={9} />
                      </span>
                    )}
                    <span>{port.name}</span>
                  </div>
                  <div className="port-type" title={port.typeAnnotation}>
                    {port.isAsync ? '⚡ ' : ''}{port.typeAnnotation}
                  </div>
                </div>
              );
            })}

            {/* Output Ports (Right handles) */}
            {data.outputs && data.outputs.map((port) => {
              const isFrozen = Boolean(data.activeScope?.frozenBoundaryPorts?.some((bp) => bp.nodeId === id && bp.portId === port.id));
              return (
                <div key={port.id} className={`port-row ${isFrozen ? 'port-frozen' : ''}`} style={{ justifyContent: 'flex-end' }}>
                  <div className="port-type" style={{ marginRight: 8 }} title={port.typeAnnotation}>
                    {port.typeAnnotation}
                  </div>
                  <div className="port-label" style={{ paddingRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{port.name}</span>
                    {isFrozen && (
                      <span className="frozen-port-badge" title="Frozen Boundary Interface: Downstream contract locked">
                        <Lock size={9} />
                      </span>
                    )}
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={port.id}
                    style={{ top: '50%' }}
                  />
                </div>
              );
            })}

            {(!data.inputs?.length && !data.outputs?.length) && (
              <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active ports
              </div>
            )}
          </div>
        </>
      )}

      {/* Source Anchor Footer */}
      {data.sourceAnchor && (
        <div className="node-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Code2 size={12} />
            <span>{data.sourceAnchor.filePath.split('/').pop()}</span>
          </div>
          <span>L{data.sourceAnchor.startLine}-{data.sourceAnchor.endLine}</span>
        </div>
      )}
    </div>
  );
}

export default memo(CustomNode);
