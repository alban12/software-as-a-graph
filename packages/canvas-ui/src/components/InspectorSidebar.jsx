import React, { useState } from 'react';
import { X, Trash2, Plus, Code2, Layers, Cpu, Database, Globe } from 'lucide-react';

export default function InspectorSidebar({
  selectedElement,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDeleteEdge
}) {
  if (!selectedElement) return null;

  const isNode = selectedElement.data !== undefined;
  const node = isNode ? selectedElement.data : null;
  const edge = !isNode ? selectedElement : null;

  const [newPortName, setNewPortName] = useState('');
  const [newPortType, setNewPortType] = useState('Void');
  const [newPortDirection, setNewPortDirection] = useState('input');

  const handleAddPort = (e) => {
    e.preventDefault();
    if (!newPortName.trim() || !node) return;

    const newPort = {
      id: `port_${node.id}_${Date.now()}`,
      name: newPortName.trim(),
      typeAnnotation: newPortType.trim(),
      direction: newPortDirection,
      isAsync: false,
      canThrow: false
    };

    const updated = { ...node };
    if (newPortDirection === 'input') {
      updated.inputs = [...(updated.inputs || []), newPort];
    } else {
      updated.outputs = [...(updated.outputs || []), newPort];
    }

    onUpdateNode(node.id, updated);
    setNewPortName('');
  };

  const handleRemovePort = (portId, direction) => {
    const updated = { ...node };
    if (direction === 'input') {
      updated.inputs = updated.inputs.filter(p => p.id !== portId);
    } else {
      updated.outputs = updated.outputs.filter(p => p.id !== portId);
    }
    onUpdateNode(node.id, updated);
  };

  return (
    <aside className="inspector-sidebar glass-panel">
      <div className="sidebar-header">
        <div className="sidebar-title">
          {isNode ? (
            <>
              <span className={`node-kind-badge`}>{node.kind}</span>
              <span>{node.name}</span>
            </>
          ) : (
            <span>Edge: {edge.id}</span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {isNode ? (
          <>
            <div className="sidebar-group">
              <label>Node Kind</label>
              <select
                className="sidebar-select"
                value={node.kind}
                onChange={(e) => onUpdateNode(node.id, { ...node, kind: e.target.value })}
              >
                <option value="view">View (SwiftUI)</option>
                <option value="viewModel">ViewModel / Observable</option>
                <option value="service">Service / Client</option>
                <option value="repository">Repository / Storage</option>
              </select>
            </div>

            <div className="sidebar-group">
              <label>Node Name</label>
              <input
                className="sidebar-input"
                value={node.name}
                onChange={(e) => onUpdateNode(node.id, { ...node, name: e.target.value })}
              />
            </div>

            {node.sourceAnchor && (
              <div className="sidebar-group">
                <label>Source Code Anchor</label>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div>📄 {node.sourceAnchor.filePath}</div>
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>Lines {node.sourceAnchor.startLine} to {node.sourceAnchor.endLine}</div>
                </div>
              </div>
            )}

            {/* Ports Section */}
            <div className="sidebar-group">
              <label>Input Ports ({node.inputs?.length || 0})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.inputs?.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.typeAnnotation}</div>
                    </div>
                    <button
                      onClick={() => handleRemovePort(p.id, 'input')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-group">
              <label>Output Ports ({node.outputs?.length || 0})</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {node.outputs?.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.typeAnnotation}</div>
                    </div>
                    <button
                      onClick={() => handleRemovePort(p.id, 'output')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Port Form */}
            <form onSubmit={handleAddPort} style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, border: '1px dashed var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '10px', fontWeight: 700 }}>+ Add Sockets / Port</label>
              <input
                className="sidebar-input"
                placeholder="Port name (e.g. login(creds:))"
                value={newPortName}
                onChange={(e) => setNewPortName(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="sidebar-input"
                  style={{ flex: 1 }}
                  placeholder="Type (e.g. Void, Result)"
                  value={newPortType}
                  onChange={(e) => setNewPortType(e.target.value)}
                />
                <select
                  className="sidebar-select"
                  value={newPortDirection}
                  onChange={(e) => setNewPortDirection(e.target.value)}
                >
                  <option value="input">In</option>
                  <option value="output">Out</option>
                </select>
              </div>
              <button type="submit" className="btn-pill" style={{ justifyContent: 'center' }}>
                <Plus size={14} />
                <span>Add Port</span>
              </button>
            </form>

            <button
              onClick={() => onDeleteNode(node.id)}
              className="btn-pill"
              style={{ marginTop: 10, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              <span>Delete Node</span>
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-group">
              <label>Source Node & Port</label>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {edge.source} ({edge.sourceHandle})
              </div>
            </div>
            <div className="sidebar-group">
              <label>Target Node & Port</label>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {edge.target} ({edge.targetHandle})
              </div>
            </div>
            {edge.data?.contract && (
              <div className="sidebar-group">
                <label>Data Contract</label>
                <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6, fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  Payload: {edge.data.contract.payloadType}
                </div>
              </div>
            )}
            <button
              onClick={() => onDeleteEdge(edge.id)}
              className="btn-pill"
              style={{ marginTop: 10, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} />
              <span>Delete Edge</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
