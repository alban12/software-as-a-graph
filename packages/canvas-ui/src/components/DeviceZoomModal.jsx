import React, { useState, useEffect } from 'react';
import { X, Smartphone, Code2, Edit3, Check, RefreshCw } from 'lucide-react';
import ScreenPreview from './ScreenPreview';

function ModalViewElementRow({ element, filePath, nodeId, onUpdate }) {
  const [val, setVal] = useState(element.label || '');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setVal(element.label || '');
  }, [element.label]);

  const handleSave = async () => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === element.label) return;
    setIsSaving(true);
    try {
      const ok = await onUpdate?.({
        nodeId,
        elementId: element.id,
        oldLabel: element.label,
        newLabel: trimmed,
        lineSpan: element.startLine ? { startLine: element.startLine, endLine: element.endLine } : undefined,
        filePath
      });
      if (ok) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`ast-element-row ${justSaved ? 'row-saved' : ''}`}>
      <div className="ast-row-info">
        <span className="ast-row-type">{element.type || 'element'}</span>
        {element.startLine && <span className="ast-row-line">L{element.startLine}</span>}
      </div>
      <div className="ast-row-input-group">
        <input
          type="text"
          className="ast-row-input"
          value={val}
          onFocus={(e) => e.target.select()}
          disabled={isSaving}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="Element label..."
        />
        <button
          type="button"
          className="ast-row-save-btn"
          onClick={handleSave}
          disabled={isSaving || !val.trim() || val.trim() === element.label}
          title="Save to Swift file"
        >
          {isSaving ? <RefreshCw size={12} className="spin" /> : justSaved ? <Check size={12} color="#10b981" /> : 'Update Swift'}
        </button>
      </div>
    </div>
  );
}

export default function DeviceZoomModal({ isOpen, onClose, node }) {
  if (!isOpen || !node) return null;

  const [activeVariant, setActiveVariant] = useState('default');

  const variants = [
    { id: 'default', label: 'Default State' },
    { id: 'loading', label: 'Loading State' },
    { id: 'error', label: 'Error State' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel device-zoom-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={20} color="var(--color-view)" />
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{node.name} — SwiftUI Screen Preview</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Target: Apple iPhone 16 Pro · iOS 17+
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* State Switcher Pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {variants.map((v) => (
            <button
              key={v.id}
              className={`btn-pill ${activeVariant === v.id ? 'primary' : ''}`}
              onClick={() => setActiveVariant(v.id)}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Device Frame Display */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <ScreenPreview
            nodeId={node.id}
            filePath={node.sourceAnchor?.filePath}
            nodeName={node.name}
            variant={activeVariant}
            size="full"
            viewElements={node.viewElements}
            stateProps={node.stateProps}
            onUpdateViewElement={node.onUpdateViewElement}
            onElementAction={(actionType, payload) => {
              onClose();
              node.onScreenAction?.(node.id, actionType, payload);
            }}
          />
        </div>

        {/* Interactive Swift AST Elements (Click-to-Edit in Modal) */}
        {node.viewElements && node.viewElements.length > 0 && (
          <div className="ast-elements-modal-panel">
            <div className="ast-elements-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Edit3 size={13} color="var(--color-view)" />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Interactive Swift AST Elements</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Edits write directly to {node.sourceAnchor?.filePath?.split('/').pop() || 'Swift file'}
              </span>
            </div>
            <div className="ast-elements-grid">
              {node.viewElements.map((el) => (
                <ModalViewElementRow
                  key={el.id}
                  element={el}
                  filePath={node.sourceAnchor?.filePath}
                  nodeId={node.id}
                  onUpdate={node.onUpdateViewElement}
                />
              ))}
            </div>
          </div>
        )}

        {/* Swift #Preview Code Anchor */}
        <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)', marginBottom: 4 }}>
            <Code2 size={13} />
            <span>Extracted from {node.sourceAnchor?.filePath || 'LoginView.swift'}</span>
          </div>
          <pre style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
            {activeVariant === 'error'
              ? `#Preview("Error State") {\n    let vm = AuthViewModel()\n    vm.errorMessage = "Password must be at least 6 characters."\n    return LoginView(viewModel: vm)\n}`
              : `#Preview("${activeVariant === 'loading' ? 'Loading State' : 'Default State'}") {\n    LoginView()\n}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
