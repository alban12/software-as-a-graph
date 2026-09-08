import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, ChevronDown, ChevronRight, Code2, Database, Globe, Cpu } from 'lucide-react';

const KIND_ICONS = {
  view: Globe,
  viewModel: Layers,
  service: Cpu,
  repository: Database,
};

function CustomNode({ id, data, selected }) {
  const [collapsed, setCollapsed] = useState(data.canvasMeta?.isCollapsed ?? false);
  const IconComponent = KIND_ICONS[data.kind] || Cpu;

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const isSimActive = data.simulationStatus === 'active';
  const isSimError = data.simulationStatus === 'error';
  const isSimMutated = data.simulationStatus === 'mutated';
  const isSimDimmed = data.simulationStatus === 'dimmed';

  let simClasses = '';
  if (isSimActive) simClasses += ' sim-active';
  if (isSimError) simClasses += ' sim-error';
  if (isSimMutated) simClasses += ' sim-mutated';
  if (isSimDimmed) simClasses += ' sim-dimmed';

  return (
    <div className={`saag-node kind-${data.kind} ${selected ? 'selected' : ''} ${simClasses}`}>
      {/* Node Header */}
      <div className="node-header">
        <div className="node-title-group">
          <span className="node-kind-badge">{data.kind}</span>
          <div className="node-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconComponent size={14} />
            <span>{data.name}</span>
          </div>
        </div>
        <button
          onClick={toggleCollapse}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          title={collapsed ? "Expand node" : "Collapse node"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded Content */}
      {!collapsed && (
        <>
          {/* State Variables Section */}
          {data.stateProps && data.stateProps.length > 0 && (
            <div className="node-section">
              <div className="section-label">State & Properties</div>
              <div className="state-tags">
                {data.stateProps.map((prop, idx) => {
                  const isMutated = data.activeMutations && data.activeMutations[prop.name] !== undefined;
                  return (
                    <div
                      key={idx}
                      className={`state-tag ${isMutated ? 'tag-mutated' : ''}`}
                      title={`${prop.wrapperKind || ''} ${prop.name}: ${isMutated ? JSON.stringify(data.activeMutations[prop.name]) : prop.typeAnnotation}`}
                    >
                      {prop.wrapperKind && <span className="wrapper">{prop.wrapperKind}</span>}
                      <span>{prop.name}</span>
                      {isMutated && <span style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 700 }}>*</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sockets / Ports Section */}
          <div className="node-ports-container">
            {/* Input Ports (Left handles) */}
            {data.inputs && data.inputs.map((port) => (
              <div key={port.id} className="port-row">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={port.id}
                  style={{ top: '50%' }}
                />
                <div className="port-label" style={{ paddingLeft: 4 }}>
                  <span>{port.name}</span>
                </div>
                <div className="port-type" title={port.typeAnnotation}>
                  {port.isAsync ? '⚡ ' : ''}{port.typeAnnotation}
                </div>
              </div>
            ))}

            {/* Output Ports (Right handles) */}
            {data.outputs && data.outputs.map((port) => (
              <div key={port.id} className="port-row" style={{ justifyContent: 'flex-end' }}>
                <div className="port-type" style={{ marginRight: 8 }} title={port.typeAnnotation}>
                  {port.typeAnnotation}
                </div>
                <div className="port-label" style={{ paddingRight: 4 }}>
                  <span>{port.name}</span>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  style={{ top: '50%' }}
                />
              </div>
            ))}

            {(!data.inputs?.length && !data.outputs?.length) && (
              <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active ports
              </div>
            )}
          </div>
        </>
      )}

      {/* Source Anchor Footer */}
      {data.sourceAnchor && (
        <div className="node-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Code2 size={12} />
            <span>{data.sourceAnchor.filePath.split('/').pop()}</span>
          </div>
          <span>L{data.sourceAnchor.startLine}-{data.sourceAnchor.endLine}</span>
        </div>
      )}
    </div>
  );
}

export default memo(CustomNode);
