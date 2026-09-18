import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Globe,
  Layers,
  Cpu,
  Database,
  ExternalLink,
  Sparkles,
  Smartphone,
  Eye,
  Minimize2,
  Maximize2
} from 'lucide-react';

export default function AppTreeNavigator({
  isOpen,
  onClose,
  treeData,
  selectedNodeId,
  onSelectNode,
  activeBranchId,
  onSelectBranch
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(
    new Set(['app_root', 'tab_container', 'shared_stores_folder', 'branch_featured_node_categoryhome', 'branch_list_node_landmarklist'])
  );

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set(['app_root', 'tab_container', 'shared_stores_folder']);
    (treeData?.branches || []).forEach((b) => allIds.add(b.id));
    setExpandedNodes(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  if (!isOpen) return null;

  const { rootAppNode, containerNode, branches = [], stateShelfNodes = [] } = treeData || {};

  // Filter branches and screens by search query
  const query = searchQuery.trim().toLowerCase();

  return (
    <aside className="app-tree-navigator glass-panel animate-slide-in-left">
      {/* Header */}
      <div className="tree-navigator-header">
        <div className="tree-header-title-box">
          <div className="tree-icon-badge">
            <FolderTree size={16} color="#38bdf8" />
          </div>
          <div>
            <div className="tree-header-title">App Architecture Tree</div>
            <div className="tree-header-subtitle">Tab Branches & Screen Hierarchy</div>
          </div>
        </div>
        <button className="tree-close-btn" onClick={onClose} title="Close Tree Navigator">
          <X size={15} />
        </button>
      </div>

      {/* Search Input */}
      <div className="tree-search-bar">
        <Search size={13} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Search screens & components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="tree-search-input"
        />
        {searchQuery && (
          <button className="tree-search-clear" onClick={() => setSearchQuery('')}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Quick Controls */}
      <div className="tree-toolbar-row">
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="tree-action-btn" onClick={handleExpandAll} title="Expand All Folders">
            <Maximize2 size={11} />
            <span>Expand All</span>
          </button>
          <button className="tree-action-btn" onClick={handleCollapseAll} title="Collapse All Folders">
            <Minimize2 size={11} />
            <span>Collapse</span>
          </button>
        </div>
        <span className="tree-stats-badge">
          {branches.length} Tabs · {stateShelfNodes.length} Stores
        </span>
      </div>

      {/* Tree Content */}
      <div className="tree-content-scroll">
        {/* 1. App Root Section */}
        {rootAppNode && (
          <div className="tree-branch-group">
            <div
              className={`tree-item root-app ${selectedNodeId === rootAppNode.id ? 'selected' : ''}`}
              onClick={() => onSelectNode && onSelectNode(rootAppNode.id)}
            >
              <button
                className="tree-chevron"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand('app_root');
                }}
              >
                {expandedNodes.has('app_root') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <span className="tree-item-icon">📱</span>
              <span className="tree-item-label font-bold">{rootAppNode.name}</span>
              <span className="tree-kind-tag">App</span>
            </div>

            {/* Container Node (TabView) */}
            {expandedNodes.has('app_root') && containerNode && containerNode.id !== rootAppNode.id && (
              <div className="tree-nested-level">
                <div
                  className={`tree-item tab-container ${selectedNodeId === containerNode.id ? 'selected' : ''}`}
                  onClick={() => onSelectNode && onSelectNode(containerNode.id)}
                >
                  <button
                    className="tree-chevron"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand('tab_container');
                    }}
                  >
                    {expandedNodes.has('tab_container') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="tree-item-icon">🗂️</span>
                  <span className="tree-item-label">{containerNode.name}</span>
                  <span className="tree-kind-tag">TabView</span>
                </div>

                {/* Tab Branches */}
                {expandedNodes.has('tab_container') && (
                  <div className="tree-nested-level">
                    {branches.map((branch) => {
                      const isExpanded = expandedNodes.has(branch.id);
                      const isBranchActive = activeBranchId === branch.id;

                      const matchingNodes = branch.nodes.filter((item) => {
                        if (!query) return true;
                        return item.node.name.toLowerCase().includes(query);
                      });

                      if (query && matchingNodes.length === 0) return null;

                      return (
                        <div key={branch.id} className="tree-branch-container">
                          {/* Branch Row */}
                          <div
                            className={`tree-item branch-header ${isBranchActive ? 'branch-active' : ''}`}
                            onClick={() => {
                              toggleExpand(branch.id);
                              onSelectBranch && onSelectBranch(branch.id);
                            }}
                            style={{
                              borderLeft: `3px solid ${branch.color}`
                            }}
                          >
                            <button
                              className="tree-chevron"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(branch.id);
                              }}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="tree-item-icon">{branch.icon}</span>
                            <span className="tree-item-label" style={{ fontWeight: 600, color: branch.color }}>
                              {branch.tabLabel}
                            </span>
                            <span className="tree-count-pill">{branch.nodeCount}</span>
                          </div>

                          {/* Branch Children */}
                          {isExpanded && (
                            <div className="tree-nested-level">
                              {matchingNodes.map((item) => {
                                const isSelected = selectedNodeId === item.id;
                                const isView = item.node.kind === 'view';
                                const isCompound = Boolean(item.node.isCompound);

                                return (
                                  <div
                                    key={item.id}
                                    className={`tree-item leaf-screen ${isSelected ? 'selected' : ''}`}
                                    onClick={() => onSelectNode && onSelectNode(item.id)}
                                    title={`Click to focus on ${item.node.name}`}
                                  >
                                    <span className="tree-spacer" style={{ width: (item.depth - 1) * 12 }} />
                                    <span className="tree-item-icon">
                                      {isView ? (isCompound ? '🏢' : '🧩') : '⚡'}
                                    </span>
                                    <span className="tree-item-label">{item.node.name}</span>
                                    {item.node.level && (
                                      <span className={`tree-level-tag ${item.node.level.toLowerCase()}`}>
                                        {item.node.level === 'L1_SCREEN' ? 'Screen' : 'Subview'}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Shared State Stores & Cloud Services Tier */}
        {stateShelfNodes.length > 0 && (
          <div className="tree-branch-group" style={{ marginTop: 14 }}>
            <div
              className="tree-item stores-header"
              onClick={() => toggleExpand('shared_stores_folder')}
            >
              <button className="tree-chevron">
                {expandedNodes.has('shared_stores_folder') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <span className="tree-item-icon">⚡</span>
              <span className="tree-item-label font-bold" style={{ color: '#fbbf24' }}>
                Shared Stores & Services
              </span>
              <span className="tree-count-pill">{stateShelfNodes.length}</span>
            </div>

            {expandedNodes.has('shared_stores_folder') && (
              <div className="tree-nested-level">
                {stateShelfNodes
                  .filter((node) => !query || node.name.toLowerCase().includes(query))
                  .map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isService = Boolean(node.serviceMeta);
                    return (
                      <div
                        key={node.id}
                        className={`tree-item leaf-store ${isSelected ? 'selected' : ''}`}
                        onClick={() => onSelectNode && onSelectNode(node.id)}
                      >
                        <span className="tree-item-icon">{isService ? '☁️' : '🗄️'}</span>
                        <span className="tree-item-label">{node.name}</span>
                        <span className="tree-kind-tag">{node.kind}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
