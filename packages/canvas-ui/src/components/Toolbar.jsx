import React from 'react';
import { Plus, LayoutGrid, Save, RefreshCw, Radio } from 'lucide-react';

export default function Toolbar({
  metadata,
  nodeCount,
  edgeCount,
  onAddNode,
  onAutoLayout,
  onSave,
  onRefresh,
  onOpenSimulation,
  isSaving,
  isConnected
}) {
  return (
    <header className="saag-toolbar glass-panel">
      <div className="toolbar-brand">
        <div className="brand-badge">S</div>
        <div>
          <div className="brand-title">SaaG Canvas</div>
        </div>
        <span className="brand-project">{metadata?.projectName || 'Project'}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </div>

      <div className="toolbar-actions">
        <div className="sync-status">
          <span className="status-dot" style={{ backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }} />
          <span>{isConnected ? 'Bridge Connected' : 'Disconnected'}</span>
        </div>

        <button className="btn-pill" onClick={onRefresh} title="Reload graph from disk">
          <RefreshCw size={14} />
          <span>Reload</span>
        </button>

        <button className="btn-pill" onClick={onAutoLayout} title="Auto-align nodes by architectural layer">
          <LayoutGrid size={14} />
          <span>Auto Layout</span>
        </button>

        <button className="btn-pill" onClick={onAddNode} title="Add new architectural node">
          <Plus size={14} />
          <span>Add Node</span>
        </button>

        <button
          className="btn-pill"
          onClick={onOpenSimulation}
          style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(56, 189, 248, 0.2))', borderColor: 'var(--color-service)' }}
          title="Simulate dataflow across nodes based on inputs"
        >
          <Radio size={14} color="var(--color-service)" />
          <span style={{ color: 'var(--color-service)', fontWeight: 600 }}>Test Dataflow</span>
        </button>

        <button className="btn-pill primary" onClick={onSave} disabled={isSaving} title="Save graph to .saag/graph.json">
          <Save size={14} />
          <span>{isSaving ? 'Saving...' : 'Save Graph'}</span>
        </button>
      </div>
    </header>
  );
}
