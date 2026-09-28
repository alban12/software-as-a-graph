import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  BookOpen,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
  HardDrive,
  Cpu,
  Layers
} from 'lucide-react';
import { generateRunbookMarkdown } from '../simulation/runbookGenerator.js';

export { generateRunbookMarkdown };

export default function RunbookExportModal({ isOpen, onClose, simulation, graph }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'raw'
  const [copied, setCopied] = useState(false);

  const markdownContent = generateRunbookMarkdown(simulation, graph);
  const scenarioTitle = simulation?.title || 'Dataflow Scenario';

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const safeTitle = (simulation?.id || 'saag-runbook').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SaaG-Runbook-${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const steps = simulation?.steps || [];
  const totalLatency = steps.reduce((sum, s) => sum + (s.perfMetrics?.latencyMs || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel runbook-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="runbook-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="runbook-header-icon">
              <BookOpen size={20} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Architectural Runbook & Trace Walkthrough
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                Scenario: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{scenarioTitle}</span> · Total Latency: <strong>{totalLatency}ms</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Tab switch */}
            <div className="runbook-tabs">
              <button
                className={`runbook-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Layers size={13} />
                <span>Formatted Preview</span>
              </button>
              <button
                className={`runbook-tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
                onClick={() => setActiveTab('raw')}
              >
                <FileText size={13} />
                <span>Raw Markdown</span>
              </button>
            </div>

            <button onClick={onClose} className="modal-close-btn" title="Close runbook">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="runbook-modal-body">
          {activeTab === 'preview' ? (
            <div className="runbook-preview-content">
              {/* Summary Banner */}
              <div className="runbook-summary-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>Executable Architectural Runbook</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Steps: <strong>{steps.length}</strong></span>
                  <span>Latency: <strong style={{ color: '#10b981' }}>{totalLatency}ms</strong></span>
                  <span>Mermaid Sequence: <strong style={{ color: '#c084fc' }}>Included</strong></span>
                </div>
              </div>

              {/* Execution Flow Cards */}
              <div className="runbook-flow-timeline">
                {steps.map((step, idx) => (
                  <div key={idx} className={`runbook-step-card ${step.status === 'error' ? 'error-card' : ''}`}>
                    <div className="runbook-step-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="step-badge">{idx + 1}</span>
                        <span className="step-card-title">{step.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="step-node-tag">{step.activeNodeId}</span>
                        {step.perfMetrics?.latencyMs !== undefined && (
                          <span className="step-latency-tag">
                            <Zap size={10} /> {step.perfMetrics.latencyMs}ms
                          </span>
                        )}
                        {step.status === 'error' ? (
                          <span className="step-status-tag error"><AlertCircle size={11} /> Halt</span>
                        ) : (
                          <span className="step-status-tag success"><CheckCircle2 size={11} /> Pass</span>
                        )}
                      </div>
                    </div>

                    <div className="step-card-desc">{step.explanation}</div>

                    {/* Payloads & Mutations grid */}
                    {(step.payload || (step.mutations && Object.keys(step.mutations).length > 0)) && (
                      <div className="step-data-grid">
                        {step.payload && (
                          <div className="step-data-block">
                            <span className="data-title">Socket Payload</span>
                            <pre>{JSON.stringify(step.payload, null, 2)}</pre>
                          </div>
                        )}
                        {step.mutations && Object.keys(step.mutations).length > 0 && (
                          <div className="step-data-block">
                            <span className="data-title mutations">State Mutations</span>
                            <pre>{JSON.stringify(step.mutations, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <textarea
              className="runbook-raw-textarea"
              value={markdownContent}
              readOnly
              onClick={(e) => e.target.select()}
            />
          )}
        </div>

        {/* Footer */}
        <div className="runbook-modal-footer">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Includes Mermaid sequence diagrams compatible with GitHub Flavored Markdown and Notion.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-pill" onClick={handleDownload}>
              <Download size={13} />
              <span>Download .md</span>
            </button>
            <button className="btn-pill primary" onClick={handleCopy}>
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
