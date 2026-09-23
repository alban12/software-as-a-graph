import React, { useState } from 'react';
import { X, Smartphone, Code2 } from 'lucide-react';
import ScreenPreview from './ScreenPreview';

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
            onElementAction={(actionType, payload) => {
              onClose();
              node.onScreenAction?.(node.id, actionType, payload);
            }}
          />
        </div>

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
