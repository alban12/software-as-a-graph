import React, { useState, useMemo } from 'react';
import { X, Play, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { getScenariosForGraph, executeCustomSimulation } from '../simulation/engine';

export default function SimulationModal({ isOpen, onClose, onStartSimulation, graph }) {
  if (!isOpen) return null;

  const scenarios = useMemo(() => getScenariosForGraph(graph), [graph]);
  const [selectedPreset, setSelectedPreset] = useState(scenarios[0]?.id || 'happy_path');
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'custom'

  const [customNode, setCustomNode] = useState(Object.keys(graph?.nodes || {})[0] || '');
  const [customPayload, setCustomPayload] = useState('{\n  "email": "user@example.com",\n  "password": "secretPassword"\n}');

  const handleRun = () => {
    if (activeTab === 'presets') {
      const preset = scenarios.find(p => p.id === selectedPreset) || scenarios[0];
      if (preset) {
        onStartSimulation(preset.traceGenerator(graph), preset.title);
      }
    } else {
      try {
        const parsed = JSON.parse(customPayload);
        const node = graph.nodes[customNode];
        const portId = node?.inputs?.[0]?.id || `${customNode}_in`;
        // Execute custom simulation
        const trace = executeCustomSimulation(customNode, portId, parsed, graph);
        onStartSimulation(trace, `Custom Test: ${node?.name || customNode}`);
      } catch (err) {
        alert('Invalid JSON payload: ' + err.message);
        return;
      }
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--color-accent)" />
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Test Dataflow & Simulation</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
          <button
            className={`btn-pill ${activeTab === 'presets' ? 'primary' : ''}`}
            onClick={() => setActiveTab('presets')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Scenario Presets (RFC-003)
          </button>
          <button
            className={`btn-pill ${activeTab === 'custom' ? 'primary' : ''}`}
            onClick={() => setActiveTab('custom')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Custom Injection
          </button>
        </div>

        {activeTab === 'presets' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {scenarios.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {preset.id.includes('happy') || preset.id.includes('favorite') || preset.id.includes('create') ? (
                        <CheckCircle2 size={15} color="var(--color-success)" />
                      ) : preset.id.includes('validation') || preset.id.includes('profile') || preset.id.includes('nav') ? (
                        <AlertTriangle size={15} color="var(--color-repository)" />
                      ) : preset.id.includes('error') ? (
                        <XCircle size={15} color="var(--color-danger)" />
                      ) : (
                        <Sparkles size={15} color="var(--color-accent)" />
                      )}
                      <span>{preset.title}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4, lineHeight: '1.4' }}>
                    {preset.description}
                  </div>
                  <div style={{ marginTop: 6, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    Payload: {JSON.stringify(preset.payload)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sidebar-group">
              <label>Target Node for Input Injection</label>
              <select className="sidebar-select" value={customNode} onChange={(e) => setCustomNode(e.target.value)}>
                {Object.values(graph?.nodes || {}).map((n) => (
                  <option key={n.id} value={n.id}>{n.name} ({n.kind})</option>
                ))}
              </select>
            </div>

            <div className="sidebar-group">
              <label>Input Payload (JSON)</label>
              <textarea
                className="sidebar-input"
                style={{ height: 110, resize: 'none', lineHeight: '1.4' }}
                value={customPayload}
                onChange={(e) => setCustomPayload(e.target.value)}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button className="btn-pill" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-pill primary" onClick={handleRun}>
            <Play size={14} />
            <span>Launch Simulation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
