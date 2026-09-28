import React, { useState, useEffect } from 'react';
import { X, Smartphone, Tablet, Watch, Sun, Moon, Code2, Edit3, Check, RefreshCw } from 'lucide-react';
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
  const [deviceType, setDeviceType] = useState('iphone'); // 'iphone' | 'ipad' | 'watch'
  const [colorScheme, setColorScheme] = useState('dark'); // 'dark' | 'light'
  const [zoomScale, setZoomScale] = useState('fit'); // 'fit' | '100'
  const [copiedCode, setCopiedCode] = useState(false);

  const variants = [
    { id: 'default', label: 'Default State' },
    { id: 'loading', label: 'Loading State' },
    { id: 'error', label: 'Error State' }
  ];

  const devices = [
    { id: 'iphone', label: 'iPhone 16 Pro', icon: Smartphone, meta: 'Apple iPhone 16 Pro · iOS 18' },
    { id: 'ipad', label: 'iPad Pro 11"', icon: Tablet, meta: 'Apple iPad Pro 11" · iPadOS 18' },
    { id: 'watch', label: 'Watch Ultra 2', icon: Watch, meta: 'Apple Watch Ultra 2 · watchOS 11' }
  ];

  const currentDevice = devices.find((d) => d.id === deviceType) || devices[0];

  const previewCodeString =
    activeVariant === 'error'
      ? `#Preview("Error State") {\n    let vm = AuthViewModel()\n    vm.errorMessage = "Password must be at least 6 characters."\n    return ${node.name}(viewModel: vm)\n}`
      : `#Preview("${activeVariant === 'loading' ? 'Loading State' : 'Default State'}") {\n    ${node.name}()\n}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel device-zoom-modal studio-layout" onClick={(e) => e.stopPropagation()}>
        {/* Header - Fixed */}
        <div className="device-zoom-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {React.createElement(currentDevice.icon, { size: 20, color: 'var(--color-view)' })}
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{node.name} — SwiftUI Screen Preview</h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                Target: <strong>{currentDevice.meta}</strong> · Scheme: <strong style={{ color: colorScheme === 'dark' ? '#38bdf8' : '#f59e0b' }}>{colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</strong>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Close preview">
            <X size={18} />
          </button>
        </div>

        {/* Two-Column Studio Layout */}
        <div className="device-zoom-two-column-body">
          {/* Left Stage: Device Showcase */}
          <div className="device-stage-column">
            {/* Stage Controls: Scale & Color Scheme */}
            <div className="device-stage-toolbar">
              <div className="device-scale-toggle">
                <button
                  className={`scale-btn ${zoomScale === 'fit' ? 'active' : ''}`}
                  onClick={() => setZoomScale('fit')}
                  title="Fit entire device chassis in stage"
                >
                  <span>Fit</span>
                </button>
                <button
                  className={`scale-btn ${zoomScale === '100' ? 'active' : ''}`}
                  onClick={() => setZoomScale('100')}
                  title="100% Native Scale"
                >
                  <span>100%</span>
                </button>
              </div>

              <div className="color-scheme-toggle">
                <button
                  className={`scheme-btn ${colorScheme === 'dark' ? 'active' : ''}`}
                  onClick={() => setColorScheme('dark')}
                  title="Preview in Apple HIG Dark Mode"
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
                <button
                  className={`scheme-btn ${colorScheme === 'light' ? 'active' : ''}`}
                  onClick={() => setColorScheme('light')}
                  title="Preview in Apple HIG Light Mode"
                >
                  <Sun size={12} />
                  <span>Light</span>
                </button>
              </div>
            </div>

            {/* Device Stage Viewport (Full Device Frame Showcase) */}
            <div className="device-stage-viewport">
              <div className={`device-zoom-frame-wrapper ${zoomScale === 'fit' ? 'scale-fit' : 'scale-100'} device-${deviceType}`}>
                <ScreenPreview
                  nodeId={node.id}
                  filePath={node.sourceAnchor?.filePath}
                  nodeName={node.name}
                  variant={activeVariant}
                  size="full"
                  deviceType={deviceType}
                  colorScheme={colorScheme}
                  viewElements={node.viewElements}
                  stateProps={node.stateProps}
                  onUpdateViewElement={node.onUpdateViewElement}
                  onElementAction={(actionType, payload) => {
                    node.onScreenAction?.(node.id, actionType, payload);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Studio Inspector Panel */}
          <div className="device-inspector-column">
            {/* Device Target Selector */}
            <div className="inspector-section">
              <div className="inspector-section-label">Target Chassis</div>
              <div className="device-type-selector full-width">
                {devices.map((d) => {
                  const IconComp = d.icon;
                  return (
                    <button
                      key={d.id}
                      className={`device-btn ${deviceType === d.id ? 'active' : ''}`}
                      onClick={() => setDeviceType(d.id)}
                      title={`Switch chassis to ${d.label}`}
                    >
                      <IconComp size={13} />
                      <span>{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* State Variant Switcher */}
            <div className="inspector-section">
              <div className="inspector-section-label">Preview State</div>
              <div className="state-variant-pills full-width">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    className={`btn-pill ${activeVariant === v.id ? 'primary' : ''}`}
                    onClick={() => setActiveVariant(v.id)}
                    style={{ fontSize: '11px', padding: '6px 10px', flex: 1, textAlign: 'center' }}
                  >
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
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
                    Syncs to {node.sourceAnchor?.filePath?.split('/').pop() || 'Swift file'}
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

            {/* Swift #Preview Code Anchor with Copy */}
            <div className="modal-preview-code-box">
              <div className="modal-code-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Code2 size={13} />
                  <span>Extracted from {node.sourceAnchor?.filePath || `${node.name}.swift`}</span>
                </div>
                <button
                  className="copy-code-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(previewCodeString);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  title="Copy Swift Preview Code"
                >
                  {copiedCode ? <Check size={11} color="#10b981" /> : 'Copy'}
                </button>
              </div>
              <pre className="modal-code-pre">
                {previewCodeString}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
