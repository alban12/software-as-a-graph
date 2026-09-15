import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ShieldCheck, AlertTriangle, FileCode, Lock, Download, RefreshCw, Layers } from 'lucide-react';

export default function AgentScopeModal({
  isOpen,
  onClose,
  scope,
  initialTab = 'prompt',
  onUnlock
}) {
  if (!isOpen || !scope) return null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [copied, setCopied] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [testFilePath, setTestFilePath] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleCopyPrompt = () => {
    if (!scope.agentPrompt) return;
    navigator.clipboard.writeText(scope.agentPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scope, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "agent-scope.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const runValidation = async (customFiles = null) => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/validate-agent-scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, customFiles })
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (err) {
      console.error('Validation failed:', err);
      setValidationResult({
        isCompliant: false,
        violations: [{ message: `Validation check error: ${err.message}` }],
        allowedFiles: scope.allowedFilePaths || [],
        modifiedFiles: []
      });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'validate' && !validationResult) {
      runValidation();
    }
  }, [activeTab]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel agent-scope-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="agent-scope-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="scope-modal-icon-badge">
              <Lock size={18} color="#a855f7" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {scope.name}
                </h3>
                <span className="badge-scope-active">
                  <span className="pulse-dot purple" />
                  <span>Scope Active</span>
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{scope.id}</strong> · {scope.lockedNodeIds?.length || 0} Nodes Locked · {scope.allowedFilePaths?.length || 0} Authorized Files
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn-pill"
              onClick={handleDownloadJson}
              style={{ fontSize: '11px', gap: 4 }}
              title="Download agent-scope.json specification"
            >
              <Download size={12} />
              <span>Export JSON</span>
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="service-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            <FileCode size={14} />
            <span>Agent Prompt Contract</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'contracts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contracts')}
          >
            <Layers size={14} />
            <span>Frozen Boundary Interfaces ({scope.frozenBoundaryPorts?.length || 0})</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'validate' ? 'active' : ''}`}
            onClick={() => setActiveTab('validate')}
          >
            <ShieldCheck size={14} />
            <span>Scope Violation Checker</span>
          </button>
        </div>

        {/* Tab 1: Agent Prompt */}
        {activeTab === 'prompt' && (
          <div className="scope-tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Pass this generated prompt to your AI coding agent (Claude, Gemini, Antigravity, Cursor) to enforce strict boundary guardrails:
              </div>
              <button
                className={`btn-pill ${copied ? 'success' : 'primary'}`}
                onClick={handleCopyPrompt}
                style={{ fontSize: '11px', gap: 5, padding: '4px 10px' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Agent Prompt'}</span>
              </button>
            </div>

            <div className="code-display-block" style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <pre style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {scope.agentPrompt}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Frozen Boundary Interfaces */}
        {activeTab === 'contracts' && (
          <div className="scope-tab-content">
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>
              The following sockets cross the agent workspace boundary perimeter. Their names, argument structures, and return types are strictly frozen to prevent breaking caller subsystems.
            </div>

            {scope.frozenBoundaryPorts && scope.frozenBoundaryPorts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '340px', overflowY: 'auto' }}>
                {scope.frozenBoundaryPorts.map((bp, idx) => (
                  <div key={idx} className="boundary-port-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`direction-tag ${bp.direction}`}>
                        {bp.direction === 'input' ? '📥 IN' : '📤 OUT'}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {bp.nodeName}.<span style={{ color: '#38bdf8' }}>{bp.portName}</span>
                      </span>
                      <span className="frozen-lock-badge">
                        <Lock size={10} />
                        <span>FROZEN</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '11px', marginTop: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Contract: <strong style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{bp.typeAnnotation}</strong>
                      </span>
                      {bp.connectedToNodeName && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          Connected to: <strong style={{ color: 'var(--text-primary)' }}>{bp.connectedToNodeName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No external boundary sockets found for this selection.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Scope Violation Checker */}
        {activeTab === 'validate' && (
          <div className="scope-tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Git Working Tree Architectural Guardrail
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Verifies that current uncommitted edits stay strictly within authorized files.
                </div>
              </div>

              <button
                className="btn-pill"
                onClick={() => runValidation()}
                disabled={isValidating}
                style={{ fontSize: '11px', gap: 5 }}
              >
                <RefreshCw size={12} className={isValidating ? 'spin' : ''} />
                <span>{isValidating ? 'Checking...' : 'Check Git Status'}</span>
              </button>
            </div>

            {/* Validation Result Banner */}
            {validationResult && (
              <div className={`validation-status-box ${validationResult.isCompliant ? 'compliant' : 'violation'}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {validationResult.isCompliant ? (
                    <ShieldCheck size={18} color="#22c55e" />
                  ) : (
                    <AlertTriangle size={18} color="#ef4444" />
                  )}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      {validationResult.isCompliant ? 'Architecture Compliant' : 'Scope Violations Detected!'}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.9 }}>
                      {validationResult.isCompliant
                        ? 'All modified files are strictly within authorized boundaries.'
                        : `${validationResult.violations.length} unauthorized file modification(s) flagged.`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Violations List */}
            {validationResult && validationResult.violations.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validationResult.violations.map((v, i) => (
                  <div key={i} className="violation-item">
                    <span style={{ color: '#ef4444' }}>❌</span>
                    <span>{typeof v === 'string' ? v : v.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Hypothetical Test */}
            <div style={{ marginTop: 14, background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                🧪 Test Hypothetical File Violation
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="e.g. AuthSample/LoginView.swift"
                  className="sidebar-input"
                  value={testFilePath}
                  onChange={(e) => setTestFilePath(e.target.value)}
                  style={{ flex: 1, fontSize: '11px' }}
                />
                <button
                  type="button"
                  className="btn-pill"
                  onClick={() => {
                    const files = testFilePath.trim() ? [testFilePath.trim()] : [];
                    runValidation(files);
                  }}
                  style={{ fontSize: '11px' }}
                >
                  Test File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
