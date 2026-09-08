import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from '@xyflow/react';

import CustomNode from './components/CustomNode';
import Toolbar from './components/Toolbar';
import InspectorSidebar from './components/InspectorSidebar';
import AddNodeModal from './components/AddNodeModal';
import SimulationModal from './components/SimulationModal';
import SimulationTimeline from './components/SimulationTimeline';
import ExportTestModal from './components/ExportTestModal';

const nodeTypes = {
  saagNode: CustomNode,
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawGraph, setRawGraph] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Simulation State (RFC-003)
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [simulation, setSimulation] = useState(null); // { title, steps }
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Transform SaagGraph to React Flow format
  const transformGraphToReactFlow = useCallback((saagGraph) => {
    if (!saagGraph || !saagGraph.nodes) return;

    setRawGraph(saagGraph);
    setMetadata(saagGraph.metadata);

    const rfNodes = Object.values(saagGraph.nodes).map((node) => ({
      id: node.id,
      type: 'saagNode',
      position: node.canvasMeta?.position || { x: 100, y: 100 },
      data: node,
    }));

    const rfEdges = Object.values(saagGraph.edges || {}).map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourcePortId,
      targetHandle: edge.targetPortId,
      animated: edge.executionMode === 'async',
      style: { stroke: edge.executionMode === 'async' ? '#38bdf8' : '#94a3b8' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.executionMode === 'async' ? '#38bdf8' : '#94a3b8',
      },
      data: edge,
      label: edge.contract?.payloadType ? edge.contract.payloadType.split('->').pop().trim() : undefined,
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [setNodes, setEdges]);

  // Load graph from local bridge API
  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch('/api/graph');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      transformGraphToReactFlow(data);
    } catch (err) {
      console.error('Failed to load graph:', err);
    }
  }, [transformGraphToReactFlow]);

  // WebSocket connection for real-time live reload
  useEffect(() => {
    loadGraph();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'GRAPH_UPDATED') {
            transformGraphToReactFlow(message.graph);
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };
    } catch (e) {
      console.warn('WS not available:', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [loadGraph, transformGraphToReactFlow]);

  // Simulation step start
  const handleStartSimulation = useCallback((steps, title) => {
    setSimulation({ title, steps });
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setSelectedElement(null);
  }, []);

  const handleStopSimulation = useCallback(() => {
    setSimulation(null);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, []);

  // Compute active simulation decorators on nodes and edges
  const currentStep = simulation ? simulation.steps[currentStepIndex] : null;

  const displayNodes = useMemo(() => {
    if (!simulation || !currentStep) return nodes;

    const visitedNodes = new Set();
    for (let i = 0; i <= currentStepIndex; i++) {
      if (simulation.steps[i].activeNodeId) {
        visitedNodes.add(simulation.steps[i].activeNodeId);
      }
    }

    return nodes.map((n) => {
      const isActive = n.id === currentStep.activeNodeId;
      const isVisited = visitedNodes.has(n.id);
      const isError = isActive && currentStep.status === 'error';
      const nodeMutations = currentStep.mutations?.[n.id] || null;
      const hasMutations = isActive && nodeMutations && Object.keys(nodeMutations).length > 0;

      let status = 'dimmed';
      if (isError) status = 'error';
      else if (hasMutations) status = 'mutated';
      else if (isActive) status = 'active';
      else if (isVisited) status = 'active';

      return {
        ...n,
        data: {
          ...n.data,
          simulationStatus: status,
          activeMutations: nodeMutations,
        }
      };
    });
  }, [nodes, simulation, currentStep, currentStepIndex]);

  const displayEdges = useMemo(() => {
    if (!simulation || !currentStep) return edges;

    const activeEdgeId = currentStep.activeEdgeId;
    const visitedEdges = new Set();
    for (let i = 0; i <= currentStepIndex; i++) {
      if (simulation.steps[i].activeEdgeId) {
        visitedEdges.add(simulation.steps[i].activeEdgeId);
      }
    }

    return edges.map((e) => {
      const isActive = e.id === activeEdgeId;
      const isVisited = visitedEdges.has(e.id);
      const isError = isActive && currentStep.status === 'error';

      if (isActive) {
        return {
          ...e,
          animated: true,
          style: {
            stroke: isError ? '#ef4444' : '#22c55e',
            strokeWidth: 3.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isError ? '#ef4444' : '#22c55e',
          }
        };
      } else if (isVisited) {
        return {
          ...e,
          animated: false,
          style: { stroke: '#22c55e', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' }
        };
      } else {
        return {
          ...e,
          animated: false,
          style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1.5, strokeDasharray: '4 4' },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.1)' }
        };
      }
    });
  }, [edges, simulation, currentStep, currentStepIndex]);

  // Handle new edge connection
  const onConnect = useCallback(
    (params) => {
      const edgeId = `edge_${params.source}_to_${params.target}_${Date.now()}`;
      const newEdge = {
        ...params,
        id: edgeId,
        animated: true,
        style: { stroke: '#38bdf8' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' },
        data: {
          id: edgeId,
          sourceNodeId: params.source,
          sourcePortId: params.sourceHandle,
          targetNodeId: params.target,
          targetPortId: params.targetHandle,
          edgeKind: 'call',
          executionMode: 'async',
          contract: { payloadType: 'Payload' }
        }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Selection handlers
  const onNodeClick = useCallback((_, node) => {
    setSelectedElement(node);
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    setSelectedElement(edge);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, []);

  // Update node data (from sidebar)
  const handleUpdateNode = useCallback((nodeId, updatedData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: updatedData } : n))
    );
    setSelectedElement((prev) => (prev && prev.id === nodeId ? { ...prev, data: updatedData } : prev));
  }, [setNodes]);

  // Delete node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedElement(null);
  }, [setNodes, setEdges]);

  // Delete edge
  const handleDeleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setSelectedElement(null);
  }, [setEdges]);

  // Add new node (from modal)
  const handleAddNode = useCallback((newNode) => {
    const rfNode = {
      id: newNode.id,
      type: 'saagNode',
      position: newNode.canvasMeta.position,
      data: newNode,
    };
    setNodes((nds) => [...nds, rfNode]);
    setSelectedElement(rfNode);
  }, [setNodes]);

  // Auto Layout
  const handleAutoLayout = useCallback(() => {
    const xByType = {
      view: 80,
      viewModel: 450,
      service: 820,
      repository: 1190,
    };
    const yByType = {
      view: 100,
      viewModel: 100,
      service: 100,
      repository: 100,
    };

    setNodes((nds) =>
      nds.map((node) => {
        const kind = node.data.kind || 'service';
        const x = xByType[kind] || 400;
        const y = yByType[kind] || 100;
        yByType[kind] = y + 200;

        return {
          ...node,
          position: { x, y },
          data: {
            ...node.data,
            canvasMeta: {
              ...node.data.canvasMeta,
              position: { x, y },
            }
          }
        };
      })
    );
  }, [setNodes]);

  // Save graph back to .saag/graph.json on disk
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const nodesMap = {};
      nodes.forEach((n) => {
        nodesMap[n.id] = {
          ...n.data,
          canvasMeta: {
            ...n.data.canvasMeta,
            position: n.position,
          }
        };
      });

      const edgesMap = {};
      edges.forEach((e) => {
        edgesMap[e.id] = {
          id: e.id,
          sourceNodeId: e.source,
          sourcePortId: e.sourceHandle || `${e.source}_out`,
          targetNodeId: e.target,
          targetPortId: e.targetHandle || `${e.target}_in`,
          edgeKind: e.data?.edgeKind || 'call',
          executionMode: e.data?.executionMode || 'async',
          contract: e.data?.contract || { payloadType: 'Payload' }
        };
      });

      const fullGraph = {
        schemaVersion: '1.0.0',
        metadata: {
          ...metadata,
          lastSynchronizedAt: new Date().toISOString(),
        },
        nodes: nodesMap,
        edges: edgesMap,
      };

      const res = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullGraph, null, 2),
      });

      if (!res.ok) throw new Error('Failed to save graph');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Error saving graph: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, metadata]);

  return (
    <div className="saag-app">
      <Toolbar
        metadata={metadata}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        onAddNode={() => setIsAddModalOpen(true)}
        onAutoLayout={handleAutoLayout}
        onSave={handleSave}
        onRefresh={loadGraph}
        onOpenSimulation={() => setIsSimModalOpen(true)}
        isSaving={isSaving}
        isConnected={isConnected}
      />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#1e293b" gap={24} size={1.5} />
        <Controls style={{ bottom: simulation ? 160 : 20, left: 20, borderRadius: 8, overflow: 'hidden' }} />
        <MiniMap
          style={{
            bottom: simulation ? 160 : 20,
            right: selectedElement ? 390 : 20,
            borderRadius: 8,
            overflow: 'hidden'
          }}
          nodeColor={(n) => {
            if (n.data?.kind === 'view') return '#a855f7';
            if (n.data?.kind === 'viewModel') return '#3b82f6';
            if (n.data?.kind === 'service') return '#10b981';
            return '#f59e0b';
          }}
          maskColor="rgba(9, 13, 22, 0.85)"
        />
      </ReactFlow>

      <InspectorSidebar
        selectedElement={selectedElement}
        onClose={() => setSelectedElement(null)}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        onDeleteEdge={handleDeleteEdge}
      />

      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddNode}
      />

      <SimulationModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        onStartSimulation={handleStartSimulation}
        graph={rawGraph}
      />

      <SimulationTimeline
        simulation={simulation}
        currentStepIndex={currentStepIndex}
        onStepChange={setCurrentStepIndex}
        onClose={handleStopSimulation}
        onExportTest={() => setIsExportModalOpen(true)}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />

      <ExportTestModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        simulation={simulation}
      />
    </div>
  );
}
