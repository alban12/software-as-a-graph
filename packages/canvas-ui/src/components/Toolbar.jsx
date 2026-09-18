import React from 'react';
import { Plus, LayoutGrid, Save, RefreshCw, Radio, Bot, Lock, Zap, AlertTriangle, FolderTree, Move } from 'lucide-react';

export default function Toolbar({
  metadata,
  nodeCount,
  edgeCount,
  onAutoLayout,
  onRearrangeAndPack,
  onSave,
  onOpenSimulation,
  isSaving,
  isConnected,
  agentNodeCount = 0,
  onOpenAgentContext,
  onClearAgentContext,
  projects = [],
  activeProjectId = 'authsample',
  onSwitchProject,
  abstractionLevel = 'L1',
  onLevelChange,
  visibleNodeCount,
  totalNodeCount,
  bottleneckCount = 0,
  isBottleneckLensActive = false,
  onToggleBottleneckLens,
  onOpenBottlenecks,
  layoutMode = 'tree',
  onLayoutModeChange,
  branches = [],
  activeBranchId = 'all',
  onSelectBranch,
  isTreeNavigatorOpen = false,
  onToggleTreeNavigator
}) {
  return (
    <header className="saag-toolbar glass-panel">
      <div className="toolbar-brand">
        <div className="brand-badge">S</div>
        <div>
          <div className="brand-title">SaaG Canvas</div>
        </div>

        {projects.length > 0 ? (
          <div className="project-selector-wrapper">
            <select
              className="project-dropdown"
              value={activeProjectId}
              onChange={(e) => onSwitchProject && onSwitchProject(e.target.value)}
              title="Switch Architecture Project"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.exists}>
                  {p.name} {!p.exists ? '(Not Found)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="brand-project">{metadata?.projectName || 'Project'}</span>
        )}

        {/* Multi-Scale Abstraction Level Switcher */}
        <div className="abstraction-level-selector" role="group" aria-label="Abstraction Level">
          <button
            className={`level-segment ${abstractionLevel === 'L1' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L1')}
            title="L1 Journey: High-level screen navigation & central data stores (clean overview)"
          >
            <span className="level-icon">🏢</span>
            <span>L1 Journey</span>
          </button>
          <button
            className={`level-segment ${abstractionLevel === 'L2' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L2')}
            title="L2 Components: Screens + nested row items, cards & subview components"
          >
            <span className="level-icon">🧩</span>
            <span>L2 Components</span>
          </button>
          <button
            className={`level-segment ${abstractionLevel === 'L3' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L3')}
            title="L3 Details: Complete AST including vector primitives, shapes & test suites"
          >
            <span className="level-icon">🔬</span>
            <span>L3 Details</span>
          </button>
        </div>

        {/* Layout Mode Switcher: Tree View vs Pipeline */}
        <div className="layout-mode-selector" role="group" aria-label="Layout Mode">
          <button
            className={`level-segment ${layoutMode === 'tree' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('tree')}
            title="Tree View: Tab-as-a-Branch hierarchy with zero edge crossings"
          >
            <span>🌳 Tree View</span>
          </button>
          <button
            className={`level-segment ${layoutMode === 'pipeline' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('pipeline')}
            title="Pipeline View: Left-to-right sequential architectural stages"
          >
            <span>🏢 Pipeline</span>
          </button>
        </div>



        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {visibleNodeCount !== undefined && totalNodeCount !== undefined
            ? `${visibleNodeCount} / ${totalNodeCount} nodes`
            : `${nodeCount} nodes`} · {edgeCount} edges
        </span>
        <div className="sync-status" style={{ marginLeft: 6 }}>
          <span className="status-dot" style={{ backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isConnected ? 'Live Sync' : 'Offline'}</span>
        </div>
      </div>

      <div className="toolbar-actions">
        <button
          className={`btn-pill ${isTreeNavigatorOpen ? 'active' : ''}`}
          onClick={onToggleTreeNavigator}
          style={{
            background: isTreeNavigatorOpen
              ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(99, 102, 241, 0.25))'
              : 'rgba(56, 189, 248, 0.12)',
            borderColor: '#38bdf8',
            color: '#7dd3fc',
            fontWeight: 600
          }}
          title="Toggle App Architecture Tree Navigator"
        >
          <FolderTree size={14} color="#38bdf8" />
          <span>App Tree</span>
        </button>

        <button className="btn-pill" onClick={onAutoLayout} title="Auto-align nodes by architectural layer">
          <LayoutGrid size={14} />
          <span>Auto Layout</span>
        </button>

        <button
          className="btn-pill"
          onClick={onRearrangeAndPack}
          title="Auto-Space: Automatically rearrange overlapping nodes and optimize canvas space"
        >
          <Move size={13} color="#38bdf8" />
          <span>Auto-Space</span>
        </button>

        <button
          className="btn-pill"
          onClick={onOpenSimulation}
          style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(56, 189, 248, 0.2))', borderColor: 'var(--color-service)' }}
          title="Trace dataflow across nodes based on runtime inputs"
        >
          <Radio size={14} color="var(--color-service)" />
          <span style={{ color: 'var(--color-service)', fontWeight: 600 }}>Test Dataflow</span>
        </button>

        <button
          className={`btn-pill ${isBottleneckLensActive ? 'active' : ''}`}
          onClick={onToggleBottleneckLens}
          style={{
            background: isBottleneckLensActive
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(239, 68, 68, 0.25))'
              : 'rgba(245, 158, 11, 0.12)',
            borderColor: '#f59e0b',
            color: '#fbbf24',
            fontWeight: 600
          }}
          title="Toggle Bottleneck Lens: Highlight state fanout re-render storms & critical path latency"
        >
          <AlertTriangle size={14} color="#f59e0b" />
          <span>Bottlenecks ({bottleneckCount})</span>
        </button>

        {agentNodeCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn-pill"
              onClick={onOpenAgentContext}
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(99, 102, 241, 0.25))',
                borderColor: '#a855f7',
                color: '#d8b4fe'
              }}
              title="Open AI Agent Context Prompt & Contracts"
            >
              <Bot size={14} color="#c084fc" />
              <span style={{ fontWeight: 600 }}>
                Agent Context ({agentNodeCount})
              </span>
            </button>
            <button
              className="btn-pill"
              onClick={onClearAgentContext}
              style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
              title="Clear all nodes from Agent Context"
            >
              Clear
            </button>
          </div>
        )}

        <button className="btn-pill primary" onClick={onSave} disabled={isSaving} title="Save graph to .saag/graph.json">
          <Save size={14} />
          <span>{isSaving ? 'Saving...' : 'Save Graph'}</span>
        </button>
      </div>
    </header>
  );
}
