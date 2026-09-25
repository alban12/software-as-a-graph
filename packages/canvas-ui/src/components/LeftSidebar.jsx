import React from 'react';
import {
  ChevronLeft,
  PanelLeftClose,
  FolderTree,
  Radio,
  AlertTriangle,
  Bot,
  LayoutGrid,
  Move,
  Save,
  Zap,
  Globe,
  Database,
  Cpu,
  Server,
  Brain,
  Check,
  ExternalLink,
  Sparkles
} from 'lucide-react';

export default function LeftSidebar({
  isOpen = true,
  onToggle,
  projects = [],
  activeProjectId = 'landmarks',
  onSwitchProject,
  currentDomain = 'ios',
  onSwitchDomain,
  mlConstraintData,
  onOpenMlDiagnostics,
  // Tool Lenses
  isBlueprintPaletteOpen = false,
  onToggleBlueprintPalette,
  isTreeNavigatorOpen = false,
  onToggleTreeNavigator,
  onOpenSimulation,
  bottleneckCount = 0,
  isBottleneckLensActive = false,
  onToggleBottleneckLens,
  onOpenBottlenecks,
  agentNodeCount = 0,
  onOpenAgentContext,
  // Layout Actions
  onAutoLayout,
  onRearrangeAndPack,
  // Persistence & Status
  onSave,
  isSaving = false,
  isConnected = false,
  metadata
}) {
  if (!isOpen) return null;

  const iosProjects = projects.filter((p) => !p.projectType || p.projectType === 'ios');
  const agentProjects = projects.filter((p) => p.projectType === 'agents');
  const mlProjects = projects.filter((p) => p.projectType === 'ml');

  return (
    <aside className="saag-left-sidebar glass-panel" aria-label="Project Navigation and Studio Tools">
      {/* Sidebar Header with macOS Window Controls & Branding */}
      <div className="sidebar-brand-header">
        <div className="mac-window-controls" aria-hidden="true" title="macOS Window Controls">
          <div className="mac-dot close" />
          <div className="mac-dot minimize" />
          <div className="mac-dot maximize" />
        </div>
        
        <div className="sidebar-title-box">
          <div className="sidebar-app-badge">S</div>
          <div className="sidebar-app-info">
            <span className="sidebar-app-title">SaaG Studio</span>
            <span className="sidebar-app-subtitle">Visual Architecture</span>
          </div>
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={onToggle}
          title="Collapse Sidebar (⌘B)"
          aria-label="Collapse Sidebar"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="sidebar-scrollable-content">
        {/* Section 1: Workspaces & Domains */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Graph Workspaces</span>
            <span className="section-badge">{projects.length} Schemes</span>
          </div>

          {/* Domain 1: iOS Applications */}
          <div className="sidebar-domain-group">
            <div className="domain-header-row">
              <span className="domain-group-icon">📱</span>
              <span className="domain-group-title">iOS Applications</span>
            </div>
            <div className="domain-projects-list">
              {iosProjects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <button
                    key={p.id}
                    className={`sidebar-project-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSwitchProject && onSwitchProject(p.id)}
                    disabled={!p.exists}
                    title={`${p.name}\n${p.description || ''}`}
                  >
                    <div className="project-item-lead">
                      <span className={`project-status-indicator ${isActive ? 'active' : ''}`} />
                      <span className="project-item-name">{p.name.replace(/\s*\(.*\)/, '')}</span>
                    </div>
                    {isActive && <span className="project-active-tag">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Domain 2: Autonomous Agents */}
          <div className="sidebar-domain-group">
            <div className="domain-header-row">
              <span className="domain-group-icon">🤖</span>
              <span className="domain-group-title">Autonomous Agents</span>
            </div>
            <div className="domain-projects-list">
              {agentProjects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <button
                    key={p.id}
                    className={`sidebar-project-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSwitchProject && onSwitchProject(p.id)}
                    disabled={!p.exists}
                    title={`${p.name}\n${p.description || ''}`}
                  >
                    <div className="project-item-lead">
                      <span className={`project-status-indicator ${isActive ? 'active' : ''}`} />
                      <span className="project-item-name">{p.name.replace(/\s*\(.*\)/, '')}</span>
                    </div>
                    {isActive && <span className="project-active-tag">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Domain 3: ML Systems & Hardware */}
          <div className="sidebar-domain-group">
            <div className="domain-header-row">
              <span className="domain-group-icon">🧠</span>
              <span className="domain-group-title">ML Systems & Hardware</span>
            </div>
            <div className="domain-projects-list">
              {mlProjects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <button
                    key={p.id}
                    className={`sidebar-project-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSwitchProject && onSwitchProject(p.id)}
                    disabled={!p.exists}
                    title={`${p.name}\n${p.description || ''}`}
                  >
                    <div className="project-item-lead">
                      <span className={`project-status-indicator ${isActive ? 'active' : ''}`} />
                      <span className="project-item-name">{p.name.replace(/\s*\(.*\)/, '')}</span>
                    </div>
                    {isActive && <span className="project-active-tag">Active</span>}
                  </button>
                );
              })}

              {/* Real-Time ML Hardware Constraint Solver Status */}
              {currentDomain === 'ml' && mlConstraintData && (
                <button
                  className={`sidebar-ml-status-pill status-${mlConstraintData.status}`}
                  onClick={onOpenMlDiagnostics}
                  title={mlConstraintData.summary}
                >
                  <div className="ml-status-lead">
                    {mlConstraintData.status === 'safe' ? (
                      <Zap size={12} color="#30d158" />
                    ) : (
                      <AlertTriangle size={12} color={mlConstraintData.status === 'oom_error' ? '#ff453a' : '#ff9f0a'} />
                    )}
                    <span className="ml-status-text">
                      {mlConstraintData.status === 'safe'
                        ? 'CUDA Safe (640GB HBM3)'
                        : mlConstraintData.status === 'oom_error'
                        ? `Predicted OOM (${mlConstraintData.stats.criticalCount})`
                        : `Hardware Alert (${mlConstraintData.stats.warningCount})`}
                    </span>
                  </div>
                  <span className="ml-status-inspect">Inspect ↗</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Architecture Studio Lenses & Tools */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Studio Lenses & Tools</span>
          </div>

          <div className="sidebar-tools-grid">
            {onToggleBlueprintPalette && (
              <button
                className={`sidebar-tool-row blueprint-palette-tool-btn ${isBlueprintPaletteOpen ? 'active' : ''}`}
                onClick={onToggleBlueprintPalette}
                title="Expand Nodes & Capability Blueprints Palette (Shift+A or ⌘K)"
              >
                <div className="tool-row-left">
                  <Sparkles size={14} color="#bf5af2" />
                  <span style={{ color: isBlueprintPaletteOpen ? '#ffffff' : '#d8b4fe' }}>Palette & Library</span>
                </div>
                <span className="tool-status-pill purple">16 Items</span>
              </button>
            )}

            <button
              className={`sidebar-tool-row ${isTreeNavigatorOpen ? 'active' : ''}`}
              onClick={onToggleTreeNavigator}
              title="Toggle App Architecture Tree Navigator"
            >
              <div className="tool-row-left">
                <FolderTree size={14} color={isTreeNavigatorOpen ? '#0a84ff' : 'var(--text-secondary)'} />
                <span>App Tree Navigator</span>
              </div>
              <span className="tool-shortcut-tag">Tree</span>
            </button>

            <button
              className="sidebar-tool-row simulation-btn"
              onClick={onOpenSimulation}
              title="Test dynamic dataflow and inspect runtime port mutations"
            >
              <div className="tool-row-left">
                <Radio size={14} color="#30d158" />
                <span style={{ color: '#30d158' }}>Dataflow Simulator</span>
              </div>
              <span className="tool-status-pill green">Ready</span>
            </button>

            <button
              className={`sidebar-tool-row bottleneck-btn ${isBottleneckLensActive ? 'active' : ''}`}
              onClick={onToggleBottleneckLens}
              title="Diagnostic Lens: Identify re-render storms & critical path latency bottlenecks"
            >
              <div className="tool-row-left">
                <AlertTriangle size={14} color="#ff9f0a" />
                <span>Bottlenecks</span>
              </div>
              {bottleneckCount > 0 ? (
                <span className="tool-count-badge orange">{bottleneckCount}</span>
              ) : (
                <span className="tool-count-badge gray">0</span>
              )}
            </button>

            {agentNodeCount > 0 ? (
              <button
                className="sidebar-tool-row agent-btn active"
                onClick={onOpenAgentContext}
                title="Open AI Agent Context Prompt & Contracts"
              >
                <div className="tool-row-left">
                  <Bot size={14} color="#bf5af2" />
                  <span>AI Agent Scope</span>
                </div>
                <span className="tool-count-badge purple">{agentNodeCount} Nodes</span>
              </button>
            ) : (
              <button
                className="sidebar-tool-row agent-btn"
                onClick={onOpenAgentContext}
                title="Select nodes to define AI Agent context and boundary contracts"
              >
                <div className="tool-row-left">
                  <Bot size={14} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-secondary)' }}>AI Agent Scope</span>
                </div>
                <span className="tool-count-badge gray">0</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 3: Canvas Layout & Organization */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Canvas Actions</span>
          </div>

          <div className="sidebar-actions-grid">
            <button
              className="sidebar-action-pill"
              onClick={onAutoLayout}
              title="Auto-align nodes by architectural layer hierarchy"
            >
              <LayoutGrid size={13} color="var(--text-secondary)" />
              <span>Auto Layout</span>
            </button>

            <button
              className="sidebar-action-pill"
              onClick={onRearrangeAndPack}
              title="Auto-Space: Automatically rearrange overlapping nodes and optimize canvas space"
            >
              <Move size={13} color="var(--text-secondary)" />
              <span>Auto-Space</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Footer: Live Sync & Save */}
      <div className="sidebar-footer">
        <div className="footer-status-row">
          <div className="sync-status">
            <span className="status-dot" style={{ backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isConnected ? 'Live Sync Active' : 'Daemon Offline'}
            </span>
          </div>
          <span className="shortcut-hint">⌘B toggle</span>
        </div>

        <button
          className="btn-pill primary sidebar-save-btn"
          onClick={onSave}
          disabled={isSaving}
          title="Save graph directly to .saag/graph.json (⌘S)"
        >
          <Save size={13} />
          <span>{isSaving ? 'Saving...' : 'Save Graph'}</span>
        </button>
      </div>
    </aside>
  );
}
