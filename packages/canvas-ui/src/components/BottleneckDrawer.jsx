import React, { useState } from 'react';
import { X, AlertTriangle, Zap, Layers, Cpu, ArrowRight, Check, Sparkles, Code2, RefreshCw, GitCommit, FileCode, CheckCircle2 } from 'lucide-react';

export default function BottleneckDrawer({
  isOpen,
  onClose,
  bottleneckData = { bottlenecks: [], stats: {} },
  onApplyGraphRefactor,
  onApplyCodebaseRefactor,
  isApplyingCode = false,
  appliedRefactors = new Set()
}) {
  if (!isOpen) return null;

  const { bottlenecks = [], stats = {} } = bottleneckData;
  const [selectedBottleneckId, setSelectedBottleneckId] = useState(bottlenecks[0]?.id || null);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'blast' | 'latency' | 'memory'

  const filteredBottlenecks = bottlenecks.filter((b) => {
    if (activeTab === 'blast') return b.type === 'STATE_BLAST_RADIUS';
    if (activeTab === 'latency') return b.type === 'CRITICAL_PATH_LATENCY';
    if (activeTab === 'memory') return b.type === 'RETAIN_CYCLE_RISK';
    return true;
  });

  const selectedBottleneck = bottlenecks.find((b) => b.id === selectedBottleneckId) || filteredBottlenecks[0];

  return (
    <div className="bottleneck-drawer-overlay animate-fade-in" onClick={onClose}>
      <aside
        className="bottleneck-drawer glass-panel animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div className="drawer-icon-box">
              <AlertTriangle size={18} color="#f59e0b" />
            </div>
            <div>
              <div className="drawer-title">Architectural Bottlenecks</div>
              <div className="drawer-subtitle">Flow Optimization & Refactoring Co-Pilot</div>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="drawer-stats-row">
          <div className="drawer-stat-item">
            <span className="stat-label">Total Issues</span>
            <span className="stat-value">{stats.totalIssues || 0}</span>
          </div>
          <div className="drawer-stat-item critical">
            <span className="stat-label">Critical</span>
            <span className="stat-value">{stats.criticalCount || 0}</span>
          </div>
          <div className="drawer-stat-item warning">
            <span className="stat-label">Warnings</span>
            <span className="stat-value">{stats.warningCount || 0}</span>
          </div>
          <div className="drawer-stat-item">
            <span className="stat-label">Max Blast</span>
            <span className="stat-value">{stats.avgBlastRadius || 0} Views</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="drawer-filter-pills">
          <button
            className={`filter-pill ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({bottlenecks.length})
          </button>
          <button
            className={`filter-pill ${activeTab === 'blast' ? 'active' : ''}`}
            onClick={() => setActiveTab('blast')}
          >
            Blast Radius ({bottlenecks.filter((b) => b.type === 'STATE_BLAST_RADIUS').length})
          </button>
          <button
            className={`filter-pill ${activeTab === 'latency' ? 'active' : ''}`}
            onClick={() => setActiveTab('latency')}
          >
            Latency ({bottlenecks.filter((b) => b.type === 'CRITICAL_PATH_LATENCY').length})
          </button>
          <button
            className={`filter-pill ${activeTab === 'memory' ? 'active' : ''}`}
            onClick={() => setActiveTab('memory')}
          >
            Retain Risks ({bottlenecks.filter((b) => b.type === 'RETAIN_CYCLE_RISK').length})
          </button>
        </div>

        {/* Body Split View */}
        <div className="drawer-body">
          {/* List Column */}
          <div className="drawer-list-col">
            {filteredBottlenecks.map((b) => {
              const isSelected = b.id === selectedBottleneck?.id;
              const isApplied = appliedRefactors.has(b.refactoringPlan?.id);

              return (
                <div
                  key={b.id}
                  className={`bottleneck-card ${isSelected ? 'selected' : ''} severity-${b.severity}`}
                  onClick={() => setSelectedBottleneckId(b.id)}
                >
                  <div className="card-top">
                    <span className={`severity-tag ${b.severity}`}>
                      {b.severity}
                    </span>
                    <span className="metric-chip">
                      {b.metricLabel}: <strong>{b.metricValue}</strong>
                    </span>
                  </div>
                  <div className="card-title">{b.title}</div>
                  <div className="card-meta">
                    <span>Component: <code>{b.nodeName}</code></span>
                    {isApplied && (
                      <span className="applied-tag">
                        <CheckCircle2 size={11} /> Reorganized
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredBottlenecks.length === 0 && (
              <div className="empty-state">
                <Check size={24} color="#10b981" />
                <span>No bottlenecks detected in this category!</span>
              </div>
            )}
          </div>

          {/* Details & Proposal Column */}
          {selectedBottleneck && (
            <div className="drawer-detail-col">
              <div className="detail-header">
                <div className="detail-type-tag">{selectedBottleneck.type}</div>
                <h3 className="detail-title">{selectedBottleneck.title}</h3>
                <p className="detail-description">{selectedBottleneck.description}</p>
              </div>

              <div className="recommendation-box">
                <div className="rec-header">
                  <Sparkles size={14} color="#38bdf8" />
                  <span>Architectural Remedy</span>
                </div>
                <div className="rec-text">{selectedBottleneck.recommendation}</div>
              </div>

              {/* Actionable Refactoring Plan */}
              {selectedBottleneck.refactoringPlan && (
                <div className="refactoring-plan-box">
                  <div className="plan-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GitCommit size={15} color="#c084fc" />
                      <span className="plan-title">{selectedBottleneck.refactoringPlan.name}</span>
                    </div>
                    <span className="plan-action-type">{selectedBottleneck.refactoringPlan.actionType}</span>
                  </div>

                  <p className="plan-summary">{selectedBottleneck.refactoringPlan.summary}</p>

                  {/* Architecture Delta Preview */}
                  <div className="delta-specs">
                    {selectedBottleneck.refactoringPlan.newNodes?.length > 0 && (
                      <div className="delta-row">
                        <span className="delta-label">New Node:</span>
                        <div className="delta-nodes">
                          {selectedBottleneck.refactoringPlan.newNodes.map((n) => (
                            <span key={n.id} className="node-chip new">
                              + {n.name} ({n.kind})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedBottleneck.refactoringPlan.edgesToAdd?.length > 0 && (
                      <div className="delta-row">
                        <span className="delta-label">New Connection:</span>
                        <div className="delta-edges">
                          {selectedBottleneck.refactoringPlan.edgesToAdd.map((e) => (
                            <span key={e.id} className="edge-chip add">
                              + {e.sourceNodeId.replace(/^node_/, '')} → {e.targetNodeId.replace(/^node_/, '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedBottleneck.refactoringPlan.edgesToRemove?.length > 0 && (
                      <div className="delta-row">
                        <span className="delta-label">Decouple Edge:</span>
                        <div className="delta-edges">
                          {selectedBottleneck.refactoringPlan.edgesToRemove.map((edgeId) => (
                            <span key={edgeId} className="edge-chip remove">
                              - {edgeId}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Swift Code Diff Preview */}
                  {selectedBottleneck.refactoringPlan.swiftChanges && (
                    <div className="swift-diff-box">
                      <div className="diff-header">
                        <FileCode size={13} color="#a5b4fc" />
                        <span>Swift Codegen Preview ({selectedBottleneck.refactoringPlan.swiftChanges[0]?.filePath})</span>
                      </div>
                      <pre className="diff-code-snippet">
                        <code>{selectedBottleneck.refactoringPlan.swiftChanges[0]?.code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="plan-actions-bar">
                    <button
                      className={`btn-plan-action primary ${appliedRefactors.has(selectedBottleneck.refactoringPlan.id) ? 'applied' : ''}`}
                      onClick={() => onApplyGraphRefactor && onApplyGraphRefactor(selectedBottleneck.refactoringPlan)}
                    >
                      {appliedRefactors.has(selectedBottleneck.refactoringPlan.id) ? (
                        <>
                          <Check size={13} color="#10b981" />
                          <span style={{ color: '#10b981' }}>Reorganized on Canvas ✓</span>
                        </>
                      ) : (
                        <>
                          <Layers size={13} />
                          <span>1-Click Reorganize Graph</span>
                        </>
                      )}
                    </button>

                    <button
                      className="btn-plan-action secondary"
                      disabled={isApplyingCode}
                      onClick={() => onApplyCodebaseRefactor && onApplyCodebaseRefactor(selectedBottleneck.refactoringPlan)}
                      title="Write Swift code refactoring to project on disk"
                    >
                      {isApplyingCode ? <RefreshCw size={13} className="spin" /> : <Code2 size={13} />}
                      <span>{isApplyingCode ? 'Syncing...' : 'Apply to Codebase (.swift)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
