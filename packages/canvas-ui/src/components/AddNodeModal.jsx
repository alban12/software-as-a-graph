import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

export default function AddNodeModal({ isOpen, onClose, onAdd }) {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [kind, setKind] = useState('service');
  const [methodName, setMethodName] = useState('');
  const [methodType, setMethodType] = useState('Void');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const nodeId = `node_${name.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
    const inputs = methodName.trim() ? [
      {
        id: `port_${nodeId}_${methodName.trim()}`,
        name: methodName.trim(),
        typeAnnotation: methodType.trim(),
        direction: 'input',
        isAsync: false,
        canThrow: false
      }
    ] : [];

    const outputs = [
      {
        id: `${nodeId}_out_result`,
        name: 'onResult',
        typeAnnotation: 'Result<Any, Error>',
        direction: 'output'
      }
    ];

    const newNode = {
      id: nodeId,
      name: name.trim(),
      level: 'L2_COMPONENT',
      kind: kind,
      inputs: inputs,
      outputs: outputs,
      canvasMeta: {
        position: { x: 400 + Math.random() * 100, y: 200 + Math.random() * 100 },
        isCollapsed: false
      }
    };

    onAdd(newNode);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Add Architectural Node</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="sidebar-group">
            <label>Node Kind</label>
            <select className="sidebar-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="view">View (SwiftUI)</option>
              <option value="viewModel">ViewModel / Observable</option>
              <option value="service">Service / Business Logic</option>
              <option value="repository">Repository / Storage</option>
            </select>
          </div>

          <div className="sidebar-group">
            <label>Node Name</label>
            <input
              className="sidebar-input"
              placeholder="e.g. BiometricsService"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="sidebar-group">
            <label>Primary Input Port / Method (Optional)</label>
            <input
              className="sidebar-input"
              placeholder="e.g. authenticate()"
              value={methodName}
              onChange={(e) => setMethodName(e.target.value)}
            />
          </div>

          <div className="sidebar-group">
            <label>Return / Type Annotation</label>
            <input
              className="sidebar-input"
              placeholder="e.g. Bool, UserSession"
              value={methodType}
              onChange={(e) => setMethodType(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-pill" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-pill primary">
              <Plus size={14} />
              <span>Create Node</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
