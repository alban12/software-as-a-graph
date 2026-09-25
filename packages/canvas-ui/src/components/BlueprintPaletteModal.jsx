import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  Plus,
  GripVertical,
  Code2,
  Layers,
  Sparkles,
  Smartphone,
  Cpu,
  Bot,
  Sliders,
  ArrowRight,
  Database,
  Box,
  Puzzle,
  ChevronLeft
} from 'lucide-react';
import { CAPABILITY_BLUEPRINTS } from '../blueprints/blueprintsRegistry';
import { SINGLE_NODE_TEMPLATES } from '../blueprints/singleNodesRegistry';

export default function BlueprintPaletteModal({
  isOpen,
  onClose,
  onAddBlueprint,
  onAddNodeTemplate,
  scaffoldCodeEnabled = true,
  onToggleScaffoldCode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCatalog, setActiveCatalog] = useState('all'); // 'all' | 'blueprints' | 'nodes'
  const [activeDomain, setActiveDomain] = useState('all'); // 'all' | 'ios' | 'agents' | 'ml'

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter Blueprints
  const filteredBlueprints = useMemo(() => {
    if (activeCatalog === 'nodes') return [];
    return CAPABILITY_BLUEPRINTS.filter((bp) => {
      const matchDomain = activeDomain === 'all' || bp.domain === activeDomain;
      if (!matchDomain) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = bp.title.toLowerCase().includes(q);
      const matchDesc = bp.description.toLowerCase().includes(q);
      const matchTags = (bp.tags || []).some((t) => t.toLowerCase().includes(q));
      const matchNodes = bp.relativeNodes.some((n) => n.name.toLowerCase().includes(q));

      return matchTitle || matchDesc || matchTags || matchNodes;
    });
  }, [searchQuery, activeCatalog, activeDomain]);

  // Filter Single Nodes
  const filteredNodes = useMemo(() => {
    if (activeCatalog === 'blueprints') return [];
    return SINGLE_NODE_TEMPLATES.filter((nt) => {
      const matchDomain = activeDomain === 'all' || nt.domain === activeDomain;
      if (!matchDomain) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = nt.name.toLowerCase().includes(q);
      const matchKind = nt.kind.toLowerCase().includes(q);
      const matchDesc = nt.description.toLowerCase().includes(q);
      const matchTags = (nt.tags || []).some((t) => t.toLowerCase().includes(q));

      return matchName || matchKind || matchDesc || matchTags;
    });
  }, [searchQuery, activeCatalog, activeDomain]);

  const totalResults = filteredBlueprints.length + filteredNodes.length;

  if (!isOpen) return null;

  return (
    <aside className="saag-palette-drawer glass-panel" aria-label="Nodes and Capability Blueprints Palette">
      {/* Header */}
      <div className="palette-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="palette-icon-badge">
            <Sparkles size={16} color="var(--accent-purple, #bf5af2)" />
          </div>
          <div>
            <h3 className="palette-title">Palette & Library</h3>
            <p className="palette-subtitle">
              Drag components directly onto the canvas
            </p>
          </div>
        </div>
        <button
          className="drawer-close-btn"
          onClick={onClose}
          title="Collapse Palette (Esc or Shift+A)"
          aria-label="Close Palette"
        >
          <X size={15} />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="palette-search-container">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search nodes or blueprints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Catalog Mode Selector (All / Blueprints / Single Nodes) */}
        <div className="palette-catalog-pills">
          <button
            className={`catalog-pill ${activeCatalog === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCatalog('all')}
          >
            <span>All ({CAPABILITY_BLUEPRINTS.length + SINGLE_NODE_TEMPLATES.length})</span>
          </button>
          <button
            className={`catalog-pill ${activeCatalog === 'blueprints' ? 'active' : ''}`}
            onClick={() => setActiveCatalog('blueprints')}
          >
            <Sparkles size={11} style={{ marginRight: 3 }} />
            <span>Blueprints ({CAPABILITY_BLUEPRINTS.length})</span>
          </button>
          <button
            className={`catalog-pill ${activeCatalog === 'nodes' ? 'active' : ''}`}
            onClick={() => setActiveCatalog('nodes')}
          >
            <Puzzle size={11} style={{ marginRight: 3 }} />
            <span>Nodes ({SINGLE_NODE_TEMPLATES.length})</span>
          </button>
        </div>

        {/* Domain Filter Pills */}
        <div className="category-pills">
          <button
            className={`category-pill ${activeDomain === 'all' ? 'active' : ''}`}
            onClick={() => setActiveDomain('all')}
          >
            All
          </button>
          <button
            className={`category-pill ${activeDomain === 'ios' ? 'active' : ''}`}
            onClick={() => setActiveDomain('ios')}
          >
            <Smartphone size={12} style={{ marginRight: 3 }} />
            iOS
          </button>
          <button
            className={`category-pill ${activeDomain === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveDomain('agents')}
          >
            <Bot size={12} style={{ marginRight: 3 }} />
            Agents
          </button>
          <button
            className={`category-pill ${activeDomain === 'ml' ? 'active' : ''}`}
            onClick={() => setActiveDomain('ml')}
          >
            <Cpu size={12} style={{ marginRight: 3 }} />
            ML
          </button>
        </div>
      </div>

      {/* Scaffolding Toggle Setting */}
      <div className="palette-scaffolding-strip">
        <label className="scaffolding-mini-label">
          <input
            type="checkbox"
            checked={scaffoldCodeEnabled}
            onChange={(e) => onToggleScaffoldCode?.(e.target.checked)}
            className="scaffolding-checkbox"
          />
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
            ⚡ <strong>Auto-scaffold source files</strong> on drop
          </span>
        </label>
      </div>

      {/* Scrollable Results List */}
      <div className="palette-scroll-content">
        {totalResults === 0 ? (
          <div className="blueprint-empty-state">
            <span style={{ fontSize: 28 }}>🔍</span>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              No matches for "{searchQuery}"
            </p>
          </div>
        ) : (
          <>
            {/* Capability Blueprints Section */}
            {filteredBlueprints.length > 0 && (
              <div className="palette-section">
                <div className="palette-section-title">
                  <Sparkles size={12} />
                  <span>Capability Blueprints ({filteredBlueprints.length})</span>
                </div>
                {filteredBlueprints.map((bp) => (
                  <div
                    key={bp.id}
                    className="palette-item-card blueprint-style"
                    draggable
                    onDragStart={(e) => {
                      const payload = { type: 'blueprint', blueprint: bp };
                      e.dataTransfer.setData('application/saag-dnd', JSON.stringify(payload));
                      e.dataTransfer.setData('application/saag-blueprint', JSON.stringify(bp));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <div className="palette-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="item-icon">{bp.icon}</span>
                        <div>
                          <h4 className="item-title">{bp.title}</h4>
                          <span className={`blueprint-domain-badge ${bp.domain}`}>
                            {bp.badge}
                          </span>
                        </div>
                      </div>
                      <div className="blueprint-drag-grip" title="Drag onto canvas">
                        <GripVertical size={14} />
                        <span className="drag-hint">DRAG</span>
                      </div>
                    </div>

                    <p className="item-desc">{bp.description}</p>

                    {/* Sub-node micro pipeline preview */}
                    <div className="blueprint-micro-nodes">
                      {bp.relativeNodes.map((rn, idx) => (
                        <React.Fragment key={rn.idSuffix}>
                          <span className={`micro-node-pill kind-${rn.kind}`}>
                            {rn.name}
                          </span>
                          {idx < bp.relativeNodes.length - 1 && (
                            <ArrowRight size={10} className="micro-arrow" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="palette-item-footer">
                      <div className="blueprint-tags">
                        {bp.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="blueprint-tag">#{tag}</span>
                        ))}
                      </div>
                      <button
                        className="btn-add-palette"
                        onClick={() => onAddBlueprint?.(bp)}
                        title="Add to canvas"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Single Nodes Section */}
            {filteredNodes.length > 0 && (
              <div className="palette-section">
                <div className="palette-section-title">
                  <Puzzle size={12} />
                  <span>Single Architectural Nodes ({filteredNodes.length})</span>
                </div>
                {filteredNodes.map((nt) => (
                  <div
                    key={nt.id}
                    className="palette-item-card node-style"
                    draggable
                    onDragStart={(e) => {
                      const payload = { type: 'node', nodeTemplate: nt };
                      e.dataTransfer.setData('application/saag-dnd', JSON.stringify(payload));
                      e.dataTransfer.setData('application/saag-node', JSON.stringify(nt));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <div className="palette-item-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="item-icon">{nt.icon}</span>
                        <div>
                          <h4 className="item-title">{nt.name}</h4>
                          <span className={`micro-node-pill kind-${nt.kind}`}>
                            {nt.badge}
                          </span>
                        </div>
                      </div>
                      <div className="blueprint-drag-grip" title="Drag onto canvas">
                        <GripVertical size={14} />
                        <span className="drag-hint">DRAG</span>
                      </div>
                    </div>

                    <p className="item-desc">{nt.description}</p>

                    <div className="palette-item-footer">
                      <div className="blueprint-tags">
                        {nt.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="blueprint-tag">#{tag}</span>
                        ))}
                      </div>
                      <button
                        className="btn-add-palette"
                        onClick={() => onAddNodeTemplate?.(nt)}
                        title="Add to canvas"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

// Backwards compatibility alias
export { BlueprintPaletteModal };
