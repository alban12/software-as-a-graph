import React from 'react';
import {
  PanelLeft,
  Plus,
  Save
} from 'lucide-react';

export default function Toolbar({
  metadata,
  nodeCount,
  edgeCount,
  visibleNodeCount,
  totalNodeCount,
  onSave,
  isSaving,
  projects = [],
  activeProjectId = 'landmarks',
  abstractionLevel = 'L1',
  onLevelChange,
  layoutMode = 'tree',
  onLayoutModeChange,
  currentDomain = 'ios',
  isLeftSidebarOpen = true,
  onToggleLeftSidebar,
  onOpenAddModal
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const domainIcons = {
    ios: '📱',
    agents: '🤖',
    ml: '🧠'
  };

  const domainLabels = {
    ios: 'iOS',
    agents: 'Agent',
    ml: 'ML'
  };

  return (
    <header className="saag-toolbar glass-panel">
      {/* Left Section: Sidebar Toggle & Active Scheme Breadcrumb */}
      <div className="toolbar-left">
        <button
          className={`btn-icon-square sidebar-toggle-btn ${!isLeftSidebarOpen ? 'highlight' : ''}`}
          onClick={onToggleLeftSidebar}
          title={isLeftSidebarOpen ? "Collapse Sidebar (⌘B)" : "Expand Sidebar (⌘B)"}
          aria-label="Toggle Left Navigation Sidebar"
        >
          <PanelLeft size={16} />
        </button>

        <div className="toolbar-project-tag" title={`Active Project: ${activeProject?.name || activeProjectId}`}>
          <span className="project-domain-icon">{domainIcons[currentDomain] || '📱'}</span>
          <span className="project-title-text">{activeProject?.name?.replace(/\s*\(.*\)/, '') || metadata?.projectName || 'Project'}</span>
          <span className="project-domain-badge">{domainLabels[currentDomain] || 'Workspace'}</span>
        </div>
      </div>

      {/* Center Section: Core Canvas Switchers (Abstraction Level & Layout Mode) */}
      <div className="toolbar-center">
        {/* Multi-Scale Abstraction Level Switcher */}
        <div className="abstraction-level-selector" role="group" aria-label="Abstraction Level">
          <button
            className={`level-segment ${abstractionLevel === 'L1' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L1')}
            title="L1: High-level system overview & central stores"
          >
            <span className="level-icon">{currentDomain === 'ios' ? '🏢' : '🌐'}</span>
            <span>{currentDomain === 'ios' ? 'L1 Journey' : 'L1 System'}</span>
          </button>
          <button
            className={`level-segment ${abstractionLevel === 'L2' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L2')}
            title="L2 Components: Nested components & processing stages"
          >
            <span className="level-icon">🧩</span>
            <span>L2 Components</span>
          </button>
          <button
            className={`level-segment ${abstractionLevel === 'L3' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L3')}
            title="L3: Execution units, kernels, test suites & low-level details"
          >
            <span className="level-icon">🔬</span>
            <span>{currentDomain === 'ios' ? 'L3 Details' : 'L3 Execution'}</span>
          </button>
        </div>

        {/* Layout Mode Switcher: Tree View vs Pipeline */}
        <div className="layout-mode-selector" role="group" aria-label="Layout Mode">
          <button
            className={`level-segment ${layoutMode === 'tree' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('tree')}
            title="Tree View: Hierarchy with zero edge crossings"
          >
            <span>🌳 Tree</span>
          </button>
          <button
            className={`level-segment ${layoutMode === 'pipeline' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('pipeline')}
            title="Pipeline View: Left-to-right sequential architectural stages"
          >
            <span>🏢 Pipeline</span>
          </button>
        </div>
      </div>

      {/* Right Section: Node/Edge Stats & Quick Actions */}
      <div className="toolbar-right">
        <div
          className="toolbar-stats-pill"
          title={`${visibleNodeCount !== undefined ? visibleNodeCount : nodeCount} nodes visible, ${edgeCount} connections`}
        >
          <span className="stats-dot" />
          <span>
            {visibleNodeCount !== undefined && totalNodeCount !== undefined
              ? `${visibleNodeCount}/${totalNodeCount}`
              : nodeCount}{' '}
            nodes
          </span>
          <span className="stats-separator">·</span>
          <span>{edgeCount} edges</span>
        </div>

        {onOpenAddModal && (
          <button
            className="btn-icon-square toolbar-add-btn"
            onClick={onOpenAddModal}
            title="Add Node to Canvas (A)"
            aria-label="Add Node"
          >
            <Plus size={15} />
          </button>
        )}

        <button
          className="btn-pill primary toolbar-quick-save"
          onClick={onSave}
          disabled={isSaving}
          title="Save graph to .saag/graph.json (⌘S)"
        >
          <Save size={13} />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>
    </header>
  );
}
