import React from 'react';
import {
  PanelLeft,
  PanelRight,
  Plus,
  Save,
  Bot
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
  onOpenBlueprintPalette,
  isBlueprintPaletteOpen = false,
  isConnected = false,
  agentNodeCount = 0,
  isScopeIsolationActive = false,
  onToggleScopeIsolation,
  onOpenAgentScope,
  isInspectorOpen = false,
  onToggleInspector
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const domainIcons = {
    ios: '📱',
    agents: '🤖',
    ml: '🧠'
  };

  const domainLabels = {
    ios: 'iOS Clean Architecture',
    agents: 'Autonomous Agent Swarm',
    ml: 'ML Systems & Hardware'
  };

  return (
    <header className="saag-toolbar" role="toolbar" aria-label="Main Application Toolbar">
      {/* Zone 1: Leading (Navigator Toggle & Clean Project Identity) */}
      <div className="toolbar-zone toolbar-leading">
        <button
          className={`toolbar-icon-btn ${isLeftSidebarOpen ? 'active' : ''}`}
          onClick={onToggleLeftSidebar}
          title={isLeftSidebarOpen ? "Hide Navigator (⌘B)" : "Show Navigator (⌘B)"}
          aria-label="Toggle Navigator Sidebar"
        >
          <PanelLeft size={15} />
        </button>

        <div className="toolbar-project-identity">
          <span className="project-icon">{domainIcons[currentDomain] || '📱'}</span>
          <div className="project-titles">
            <span className="project-title">
              {activeProject?.name?.replace(/\s*\(.*\)/, '') || metadata?.projectName || 'Landmarks'}
            </span>
            <span className="project-subtitle">
              {domainLabels[currentDomain] || 'Clean Architecture'}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Center (macOS Standard Segmented Controls) */}
      <div className="toolbar-zone toolbar-center">
        {/* Layout Perspective Lens (Tree, Pipeline, Mesh) */}
        <div className="macos-segmented-control" role="radiogroup" aria-label="Perspective Lens">
          <button
            className={`segmented-item ${layoutMode === 'tree' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('tree')}
            title="Tree View: Hierarchical top-down containment & navigation stacks"
            role="radio"
            aria-checked={layoutMode === 'tree'}
          >
            <span>Tree</span>
          </button>
          <button
            className={`segmented-item ${layoutMode === 'pipeline' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('pipeline')}
            title="Pipeline View: Left-to-right temporal causality & execution flow"
            role="radio"
            aria-checked={layoutMode === 'pipeline'}
          >
            <span>Pipeline</span>
          </button>
          <button
            className={`segmented-item ${layoutMode === 'mesh' ? 'active' : ''}`}
            onClick={() => onLayoutModeChange && onLayoutModeChange('mesh')}
            title="Mesh View: Freeform organic graph & custom disposition"
            role="radio"
            aria-checked={layoutMode === 'mesh'}
          >
            <span>Mesh</span>
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* Abstraction Tier Picker (L1, L2, L3) */}
        <div className="macos-segmented-control" role="radiogroup" aria-label="Abstraction Tier">
          <button
            className={`segmented-item ${abstractionLevel === 'L1' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L1')}
            title="L1: High-level screens, primary navigation, and systems"
            role="radio"
            aria-checked={abstractionLevel === 'L1'}
          >
            <span>L1 Journey</span>
          </button>
          <button
            className={`segmented-item ${abstractionLevel === 'L2' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L2')}
            title="L2: Architecture components, services, and compound units"
            role="radio"
            aria-checked={abstractionLevel === 'L2'}
          >
            <span>L2 Architecture</span>
          </button>
          <button
            className={`segmented-item ${abstractionLevel === 'L3' ? 'active' : ''}`}
            onClick={() => onLevelChange && onLevelChange('L3')}
            title="L3: Execution units, source lines, and primitives"
            role="radio"
            aria-checked={abstractionLevel === 'L3'}
          >
            <span>L3 Code</span>
          </button>
        </div>
      </div>

      {/* Zone 3: Trailing (Status, Library & Utility Actions) */}
      <div className="toolbar-zone toolbar-trailing">
        {/* Subtle Live AST Watcher Indicator */}
        <div
          className={`toolbar-status-badge ${isConnected ? 'online' : 'connecting'}`}
          title={
            isConnected
              ? 'Real-Time Swift AST Watcher & WebSocket Hot-Reload Active'
              : 'Connecting to SaaG Daemon...'
          }
        >
          <span className={`status-dot ${isConnected ? 'green' : 'amber'}`} />
          <span className="status-label">{isConnected ? 'Live AST' : 'Syncing'}</span>
        </div>

        {/* AI Agent Scope (Subtle macOS pill if active) */}
        {agentNodeCount > 0 && (
          <button
            className="toolbar-scope-pill"
            onClick={onOpenAgentScope}
            title="Open AI Agent Scope Contracts & Prompt"
          >
            <Bot size={13} color="#bf5af2" />
            <span>Scope ({agentNodeCount})</span>
          </button>
        )}

        {/* Unified Apple-Style Library Button (+) */}
        {onOpenBlueprintPalette && (
          <button
            className={`toolbar-library-btn ${isBlueprintPaletteOpen ? 'active' : ''}`}
            onClick={onOpenBlueprintPalette}
            title={isBlueprintPaletteOpen ? "Close Library (Esc)" : "Open Component & Blueprint Library (⇧⌘L or Shift+A)"}
            aria-label="Toggle Component & Blueprint Library"
          >
            <Plus size={15} />
            <span className="library-btn-text">Library</span>
          </button>
        )}

        {/* Inspector Sidebar Toggle */}
        {onToggleInspector && (
          <button
            className={`toolbar-icon-btn ${isInspectorOpen ? 'active' : ''}`}
            onClick={onToggleInspector}
            title={isInspectorOpen ? "Hide Inspector (⌥⌘0)" : "Show Inspector (⌥⌘0)"}
            aria-label="Toggle Inspector Sidebar"
          >
            <PanelRight size={15} />
          </button>
        )}

        {/* Save Button */}
        <button
          className="toolbar-save-btn"
          onClick={onSave}
          disabled={isSaving}
          title="Save graph to .saag/graph.json (⌘S)"
        >
          <Save size={13} />
          <span>{isSaving ? 'Saving…' : 'Save'}</span>
        </button>
      </div>
    </header>
  );
}
