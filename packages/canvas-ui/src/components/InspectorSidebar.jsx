import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Code2, Layers, Cpu, Database, Globe, Smartphone, Check, RefreshCw, Flame, Minimize2, Bot, ShieldCheck, ShieldAlert, GitCommit } from 'lucide-react';
import FirebaseLogo from './FirebaseLogo';
import { validateEdgeConnection, inferEdgeContract } from '../utils/edgeGuardrails';

export default function InspectorSidebar({
  selectedElement,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDeleteEdge,
  onUpdateEdge,
  rawGraph,
  edges = [],
  activeScope = null,
  onOpenServicePreview,
  agentNodeIds = [],
  onToggleAgentNode
}) {
  if (!selectedElement) return null;

  const isNode = selectedElement.data !== undefined && selectedElement.source === undefined;
  const node = isNode ? selectedElement.data : null;
  const edge = !isNode ? selectedElement : null;

  // Edge rewire state
  const [rewireTarget, setRewireTarget] = useState(edge?.target || '');
  const [rewirePort, setRewirePort] = useState(edge?.targetHandle || '');
  const [rewireSuccess, setRewireSuccess] = useState(false);

  useEffect(() => {
    if (edge) {
      setRewireTarget(edge.target || '');
      setRewirePort(edge.targetHandle || '');
      setRewireSuccess(false);
    }
  }, [edge?.id, edge?.target, edge?.targetHandle]);

  const [newPortName, setNewPortName] = useState('');
  const [newPortType, setNewPortType] = useState('Void');
  const [newPortDirection, setNewPortDirection] = useState('input');

  const [editingLabels, setEditingLabels] = useState({});
  const [syncStatus, setSyncStatus] = useState({});
  const [syncingId, setSyncingId] = useState(null);

  const handleLabelChange = (elId, val) => {
    setEditingLabels((prev) => ({ ...prev, [elId]: val }));
  };

  const handleSyncElement = async (el) => {
    const newLabel = editingLabels[el.id];
    if (!newLabel || newLabel === el.label || !node?.sourceAnchor?.filePath) return;

    setSyncingId(el.id);
    try {
      const res = await fetch('/api/update-view-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: node.sourceAnchor.filePath,
          elementId: el.id,
          oldLabel: el.label,
          newLabel: newLabel.trim(),
          lineSpan: { startLine: el.startLine, endLine: el.endLine }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update element');

      setSyncStatus((prev) => ({ ...prev, [el.id]: `Synced to Swift (L${el.startLine})` }));
      
      const updatedElements = (node.viewElements || []).map((e) =>
        e.id === el.id ? { ...e, label: newLabel.trim() } : e
      );
      onUpdateNode(node.id, { ...node, viewElements: updatedElements });
    } catch (err) {
      alert('Error updating Swift element: ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleAddPort = (e) => {
    e.preventDefault();
    if (!newPortName.trim() || !node) return;

    const newPort = {
      id: `port_${node.id}_${Date.now()}`,
      name: newPortName.trim(),
      typeAnnotation: newPortType.trim(),
      direction: newPortDirection,
      isAsync: false,
      canThrow: false
    };

    const updated = { ...node };
    if (newPortDirection === 'input') {
      updated.inputs = [...(updated.inputs || []), newPort];
    } else {
      updated.outputs = [...(updated.outputs || []), newPort];
    }

    onUpdateNode(node.id, updated);
    setNewPortName('');
  };

  const handleRemovePort = (portId, direction) => {
    const updated = { ...node };
    if (direction === 'input') {
      updated.inputs = updated.inputs.filter(p => p.id !== portId);
    } else {
      updated.outputs = updated.outputs.filter(p => p.id !== portId);
    }
    onUpdateNode(node.id, updated);
  };

  return (
    <aside className="inspector-sidebar glass-panel">
      <div className="sidebar-header">
        <div className="sidebar-title">
          {isNode ? (
            <>
              <span className={`node-kind-badge`}>{node.kind}</span>
              <span>{node.name}</span>
            </>
          ) : (
            <span>Edge: {edge.id}</span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {isNode ? (
          <>
            <div className="sidebar-group">
              <label>Node Kind</label>
              <select
                className="sidebar-select"
                value={node.kind}
                onChange={(e) => onUpdateNode(node.id, { ...node, kind: e.target.value })}
              >
                <option value="view">View (SwiftUI)</option>
                <option value="viewModel">ViewModel / Observable</option>
                <option value="service">Service / Client</option>
                <option value="repository">Repository / Storage</option>
              </select>
            </div>

            <div className="sidebar-group">
              <label>Node Name</label>
              <input
                className="sidebar-input"
                value={node.name}
                onChange={(e) => onUpdateNode(node.id, { ...node, name: e.target.value })}
              />
            </div>

            {/* AI Agent Context Toggle */}
            <div className="sidebar-group">
              <label>AI Agent Context</label>
              <button
                type="button"
                className={`btn-pill ${agentNodeIds?.includes(node.id) ? 'primary' : ''}`}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '11px',
                  background: agentNodeIds?.includes(node.id) ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(99, 102, 241, 0.25))' : undefined,
                  borderColor: agentNodeIds?.includes(node.id) ? '#a855f7' : undefined,
                  color: agentNodeIds?.includes(node.id) ? '#e9d5ff' : undefined
                }}
                onClick={() => onToggleAgentNode?.(node.id)}
              >
                <Bot size={13} color={agentNodeIds?.includes(node.id) ? '#c084fc' : undefined} />
                <span>{agentNodeIds?.includes(node.id) ? '✓ In Agent Context (Click to remove)' : '+ Add to Agent Context'}</span>
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
                Selected nodes define the scope, contracts, and authorized files for AI coding agents.
              </div>
            </div>

            {/* Presentation & Squeezing */}
            <div className="sidebar-group">
              <label>Node Presentation & Folding</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`btn-pill ${node.isSqueezed ? 'primary' : ''}`}
                  style={{ flex: 1, justifyContent: 'center', fontSize: '11px' }}
                  onClick={() => onUpdateNode(node.id, { ...node, isSqueezed: !node.isSqueezed, isTransient: true })}
                >
                  <Minimize2 size={12} />
                  <span>{node.isSqueezed ? 'Squeezed (Pass-Through)' : 'Squeeze into Capsule'}</span>
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
                Squeezing collapses intermediate or approval nodes into a compact pass-through capsule on the canvas.
              </div>
            </div>

            {/* External Cloud Service Configuration */}
            {Boolean(node.serviceMeta) && (
              <div className="sidebar-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FirebaseLogo size={14} />
                  <span>External Cloud Service</span>
                </label>
                <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 8, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{node.serviceMeta?.provider || 'Firebase Authentication & Firestore'}</span>
                    <span className="badge-online" style={{ fontSize: '9px' }}>{node.serviceMeta?.status || 'Online'}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Project: <strong style={{ color: 'var(--text-primary)' }}>{node.serviceMeta?.projectRef || 'authsample-dev'}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn-pill primary"
                    style={{ marginTop: 2, justifyContent: 'center', fontSize: '11px', background: '#d97706', borderColor: '#f59e0b', color: '#ffffff' }}
                    onClick={() => onOpenServicePreview?.(node)}
                  >
                    <FirebaseLogo size={13} />
                    <span>Open Firebase Preview Window</span>
                  </button>
                </div>
              </div>
            )}

            {node.sourceAnchor && (
              <div className="sidebar-group">
                <label>Source Code Anchor</label>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div>📄 {node.sourceAnchor.filePath}</div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Lines {node.sourceAnchor.startLine} to {node.sourceAnchor.endLine}</div>
                </div>
              </div>
            )}

            {/* SwiftUI View Elements & Reconciliation */}
            {node.viewElements && node.viewElements.length > 0 && (
              <div className="sidebar-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Smartphone size={13} color="var(--color-view)" />
                    <span>UI Elements ({node.viewElements.length})</span>
                  </label>
                  <span className="sync-status-badge">
                    <Check size={11} />
                    <span>AST Synced</span>
                  </span>
                </div>

                <div className="ui-elements-container">
                  {node.viewElements.map((el) => {
                    const currentVal = editingLabels[el.id] !== undefined ? editingLabels[el.id] : el.label;
                    const hasChanged = currentVal !== el.label;
                    const isSyncing = syncingId === el.id;
                    const statusText = syncStatus[el.id];

                    return (
                      <div key={el.id} className="ui-element-item">
                        <div className="ui-element-header">
                          <span className="ui-element-kind">{el.type}</span>
                          <span className="ui-element-lines">
                            {el.startLine ? `L${el.startLine}${el.endLine && el.endLine !== el.startLine ? `-${el.endLine}` : ''}` : ''}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="sidebar-input"
                            style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}
                            value={currentVal}
                            onChange={(e) => handleLabelChange(el.id, e.target.value)}
                            placeholder="Element label/placeholder"
                          />
                          {hasChanged && (
                            <button
                              type="button"
                              className="btn-pill primary"
                              style={{ padding: '4px 8px', fontSize: '10px' }}
                              disabled={isSyncing}
                              onClick={() => handleSyncElement(el)}
                              title={`Sync changes directly to ${node.sourceAnchor?.filePath || 'Swift file'}`}
                            >
                              {isSyncing ? <RefreshCw size={11} className="spin-animation" /> : <span>Sync</span>}
                            </button>
                          )}
                        </div>

                        {el.binding && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Binding: <span style={{ color: '#38bdf8' }}>{el.binding}</span>
                          </div>
                        )}

                        {el.action && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Action: <span style={{ color: '#a855f7' }}>{el.action}</span>
                          </div>
                        )}

                        {statusText && (
                          <div style={{ fontSize: '9px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={10} />
                            <span>{statusText}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ports Section */}
            <div className="sidebar-group">
              <label>Input Ports ({node.inputs?.length || 0})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.inputs?.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.typeAnnotation}</div>
                    </div>
                    <button
                      onClick={() => handleRemovePort(p.id, 'input')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-group">
              <label>Output Ports ({node.outputs?.length || 0})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.outputs?.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.typeAnnotation}</div>
                    </div>
                    <button
                      onClick={() => handleRemovePort(p.id, 'output')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Port Form */}
            <form onSubmit={handleAddPort} style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px dashed var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '10px', fontWeight: 700 }}>+ Add Sockets / Port</label>
              <input
                className="sidebar-input"
                placeholder="Port name (e.g. login(creds:))"
                value={newPortName}
                onChange={(e) => setNewPortName(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="sidebar-input"
                  style={{ flex: 1 }}
                  placeholder="Type (e.g. Void, Result)"
                  value={newPortType}
                  onChange={(e) => setNewPortType(e.target.value)}
                />
                <select
                  className="sidebar-select"
                  value={newPortDirection}
                  onChange={(e) => setNewPortDirection(e.target.value)}
                >
                  <option value="input">In</option>
                  <option value="output">Out</option>
                </select>
              </div>
              <button type="submit" className="btn-pill" style={{ justifyContent: 'center' }}>
                <Plus size={14} />
                <span>Add Port</span>
              </button>
            </form>

            <button
              onClick={() => onDeleteNode(node.id)}
              className="btn-pill"
              style={{ marginTop: 10, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              <span>Delete Node</span>
            </button>
          </>
        ) : (
          <>
            {/* Source Node Info */}
            <div className="sidebar-group">
              <label>Source Socket</label>
              <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                <strong>{rawGraph?.nodes?.[edge.source]?.name || edge.source}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: 2 }}>
                  Port: {edge.sourceHandle || 'Default Output'}
                </div>
              </div>
            </div>

            {/* Target Re-Routing with Guardrails */}
            <div className="sidebar-group" style={{ border: '1px solid rgba(255,255,255,0.08)', padding: 10, borderRadius: 8, background: 'rgba(15, 23, 42, 0.4)' }}>
              <label style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <GitCommit size={13} />
                Rewire Target Connection
              </label>

              {/* Target Node Dropdown */}
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Node:</span>
                <select
                  value={rewireTarget}
                  onChange={(e) => {
                    const newTarget = e.target.value;
                    setRewireTarget(newTarget);
                    const targetNodeObj = rawGraph?.nodes?.[newTarget];
                    const defaultPort = targetNodeObj?.inputs?.[0]?.id || `${newTarget}_in`;
                    setRewirePort(defaultPort);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 mt-1"
                >
                  {Object.values(rawGraph?.nodes || {}).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.kind})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Port Dropdown */}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Port / Socket:</span>
                <select
                  value={rewirePort}
                  onChange={(e) => setRewirePort(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded p-1.5 mt-1 font-mono"
                >
                  {rawGraph?.nodes?.[rewireTarget]?.inputs?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.typeAnnotation || 'Void'})
                    </option>
                  )) || (
                    <option value={rewirePort}>{rewirePort || 'Default Input'}</option>
                  )}
                </select>
              </div>

              {/* Guardrail Real-Time Evaluation */}
              {(() => {
                const otherEdges = (edges || []).filter((e) => e.id !== edge.id);
                const guardrail = validateEdgeConnection(
                  {
                    source: edge.source,
                    target: rewireTarget,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: rewirePort
                  },
                  rawGraph,
                  otherEdges,
                  activeScope
                );

                const isTargetChanged = rewireTarget !== edge.target || rewirePort !== edge.targetHandle;

                return (
                  <div style={{ marginTop: 10 }}>
                    {guardrail.isValid ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 p-2 rounded">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Architecturally Valid Connection</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-xs text-rose-300 bg-rose-950/30 border border-rose-500/30 p-2 rounded">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div className="leading-snug">
                          <strong className="text-rose-400 block font-semibold">Connection Prohibited</strong>
                          <span>{guardrail.reason}</span>
                        </div>
                      </div>
                    )}

                    {isTargetChanged && (
                      <button
                        onClick={() => {
                          if (guardrail.isValid) {
                            onUpdateEdge?.(edge.id, {
                              target: rewireTarget,
                              targetHandle: rewirePort
                            });
                            setRewireSuccess(true);
                            setTimeout(() => setRewireSuccess(false), 2000);
                          }
                        }}
                        disabled={!guardrail.isValid}
                        className={`w-full mt-2.5 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          guardrail.isValid
                            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg shadow-blue-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        {rewireSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <GitCommit className="w-3.5 h-3.5" />}
                        <span>{rewireSuccess ? 'Reconnected!' : 'Apply Reconnection'}</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Edge Contract & Performance Info */}
            <div className="sidebar-group">
              <label>Data Contract & Execution</label>
              <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6, fontSize: '11px', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Payload: </span>
                  <span style={{ color: '#38bdf8' }}>{edge.data?.contract?.payloadType || 'Void'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Kind: </span>
                  <span>{edge.data?.edgeKind || 'call'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Mode: </span>
                  <span>{edge.data?.executionMode || 'sync'}</span>
                </div>
                {edge.data?.perfMeta?.averageLatencyMs && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Avg Latency: </span>
                    <span style={{ color: edge.data.perfMeta.averageLatencyMs > 250 ? '#f43f5e' : '#10b981' }}>
                      {edge.data.perfMeta.averageLatencyMs} ms
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => onDeleteEdge(edge.id)}
              className="btn-pill"
              style={{ marginTop: 10, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              <span>Delete Edge</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
