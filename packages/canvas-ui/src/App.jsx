import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ViewportPortal,
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
import DeviceZoomModal from './components/DeviceZoomModal';
import ServicePreviewModal from './components/ServicePreviewModal';
import AgentScopeModal from './components/AgentScopeModal';
import PerformanceProfilingModal from './components/PerformanceProfilingModal';
import EdgeGuardrailToast from './components/EdgeGuardrailToast';
import { generateScopeContract } from './utils/scopeContract';
import { validateEdgeConnection, inferEdgeContract } from './utils/edgeGuardrails';
import { PRESET_SCENARIOS } from './simulation/engine';

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
  const [guardrailAlert, setGuardrailAlert] = useState(null);

  const rawGraphRef = useRef(null);
  const transformRef = useRef(null);

  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPerfModalOpen, setIsPerfModalOpen] = useState(false);
  const [zoomPreviewNode, setZoomPreviewNode] = useState(null);
  const [servicePreviewNode, setServicePreviewNode] = useState(null);
  const [simulation, setSimulation] = useState(null); // { title, steps }
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Multi-Scale Abstraction Level ('L1' | 'L2' | 'L3')
  const [abstractionLevel, setAbstractionLevel] = useState('L1');
  const [expandedCompoundIds, setExpandedCompoundIds] = useState(new Set());

  const handleToggleCompound = useCallback((compoundId) => {
    setExpandedCompoundIds((prev) => {
      const next = new Set(prev);
      if (next.has(compoundId)) {
        next.delete(compoundId);
      } else {
        next.add(compoundId);
      }
      return next;
    });
  }, []);

  // Phase 8: Agent Context Selection (Select & Unselect Nodes for Agent Context)
  const [agentNodeIds, setAgentNodeIds] = useState(['node_authviewmodel', 'node_liveauthservice']);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeModalTab, setScopeModalTab] = useState('prompt');

  // Benchmark / Project Registry Switching
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState('authsample');

  const handleToggleAgentNode = useCallback((nodeId) => {
    setAgentNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }, []);

  const handleClearAgentContext = useCallback(() => {
    setAgentNodeIds([]);
  }, []);

  const handleToggleSqueeze = useCallback((nodeId) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const newSqueezed = !node.data.isSqueezed;
          return {
            ...node,
            data: {
              ...node.data,
              isSqueezed: newSqueezed
            }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

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

  // Trigger simulation dynamically from interactive screen elements
  const handleScreenAction = useCallback((nodeId, actionType, payload) => {
    const { email, password } = payload || {};
    const isShortPassword = (password || '').length < 6;
    const scenarioId = isShortPassword ? 'validation_error' : 'happy_path';
    const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId);
    const currentGraph = rawGraphRef.current;

    if (scenario && currentGraph) {
      const generatedSteps = scenario.traceGenerator(currentGraph);
      const steps = generatedSteps.map((step) => {
        if (step.payload && step.payload.email !== undefined) {
          return {
            ...step,
            payload: {
              ...step.payload,
              email: email || step.payload.email,
              password: password || step.payload.password
            }
          };
        }
        return step;
      });

      const title = isShortPassword
        ? `Screen Trigger: Validation Guard Failed (Password < 6 chars)`
        : `Screen Trigger: Live Flow for ${email || 'user'}`;

      handleStartSimulation(steps, title);
    }
  }, [handleStartSimulation]);

  const handleOpenServicePreview = useCallback((nodeData) => {
    setServicePreviewNode(nodeData);
  }, []);

  const handleOpenPreviewModal = useCallback((nodeData) => {
    setZoomPreviewNode({ ...nodeData, onScreenAction: handleScreenAction });
  }, [handleScreenAction]);

  // Selected nodes count
  const selectedNodeCount = useMemo(() => {
    return nodes.filter((n) => n.selected).length;
  }, [nodes]);

  // Transform SaagGraph to React Flow format
  const transformGraphToReactFlow = useCallback((saagGraph) => {
    if (!saagGraph || !saagGraph.nodes) return;

    rawGraphRef.current = saagGraph;
    setRawGraph(saagGraph);
    setMetadata(saagGraph.metadata);

    const rfNodes = Object.values(saagGraph.nodes).map((node) => ({
      id: node.id,
      type: 'saagNode',
      position: node.canvasMeta?.position || { x: 100, y: 100 },
      data: {
        ...node,
        onScreenAction: handleScreenAction,
        onToggleSqueeze: handleToggleSqueeze,
        onOpenServicePreview: handleOpenServicePreview,
        onOpenPreviewModal: handleOpenPreviewModal
      },
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
  }, [setNodes, setEdges, handleScreenAction, handleToggleSqueeze, handleOpenServicePreview, handleOpenPreviewModal]);

  // Keep transformRef pointing to latest transform function
  useEffect(() => {
    transformRef.current = transformGraphToReactFlow;
  }, [transformGraphToReactFlow]);

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

  // Compute active agent scope contract dynamically in-memory without disk locks
  const activeScope = useMemo(() => {
    if (!rawGraph || agentNodeIds.length === 0) return null;
    return generateScopeContract(agentNodeIds, rawGraph, `Agent Context (${agentNodeIds.length} Nodes)`);
  }, [rawGraph, agentNodeIds]);

  const handleOpenAgentContext = useCallback(() => {
    setScopeModalTab('prompt');
    setIsScopeModalOpen(true);
  }, []);

  // Load projects list
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.activeProjectId) {
          setActiveProjectId(data.activeProjectId);
        }
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    }
  }, []);

  // Switch Active Project
  const handleSwitchProject = useCallback(async (projectId) => {
    try {
      const res = await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (!res.ok) throw new Error(`Failed to switch project: ${res.status}`);
      const data = await res.json();
      setActiveProjectId(data.activeProjectId);
      if (data.graph) {
        transformGraphToReactFlow(data.graph);
        setSelectedElement(null);
        setAgentNodeIds([]);
        setExpandedCompoundIds(new Set());
      }
    } catch (err) {
      console.error('Error switching project:', err);
    }
  }, [transformGraphToReactFlow]);

  // Initial load on mount
  useEffect(() => {
    loadProjects();
    loadGraph();
  }, [loadProjects, loadGraph]);

  // WebSocket connection for real-time live reload (connect once on mount)
  useEffect(() => {
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
          if (message.type === 'GRAPH_UPDATED' && message.graph) {
            transformRef.current?.(message.graph);
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
  }, []);

  // Compute active simulation decorators on nodes and edges
  const currentStep = simulation ? simulation.steps[currentStepIndex] : null;

  const displayNodes = useMemo(() => {
    const rawNodes = rawGraphRef.current?.nodes || {};

    // 1. Filter nodes based on Abstraction Level and compound expansion
    const visibleNodes = nodes.filter((n) => {
      const nodeLevel = n.data?.level || rawNodes[n.id]?.level || 'L1_SCREEN';
      const parentId = n.data?.parentId || rawNodes[n.id]?.parentId;

      if (abstractionLevel === 'L1') {
        // If node is a nested child of a compound screen:
        // Only show if user explicitly clicked expand on the parent
        if (parentId) {
          return expandedCompoundIds.has(parentId);
        }
        // At L1 level, show strictly high-level screens and central state hubs
        return nodeLevel === 'L1_SCREEN';
      }

      if (abstractionLevel === 'L2') {
        // L2 Components: Show screens and subviews, hide L3 primitives
        if (nodeLevel === 'L3_PRIMITIVE') return false;
        return true;
      }

      // L3 Details: Show all nodes
      return true;
    });

    const isExpandedMap = new Map();
    visibleNodes.forEach((n) => {
      const isExpanded =
        expandedCompoundIds.has(n.id) ||
        (abstractionLevel === 'L2' && Boolean(n.data?.isCompound)) ||
        (abstractionLevel === 'L3' && Boolean(n.data?.isCompound));
      isExpandedMap.set(n.id, isExpanded);
    });

    if (!simulation || !currentStep) {
      return visibleNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          agentNodeIds,
          onToggleAgentNode: handleToggleAgentNode,
          activeScope,
          isExpanded: isExpandedMap.get(n.id) || false,
          onToggleCompound: handleToggleCompound,
          onScreenAction: handleScreenAction,
          onToggleSqueeze: handleToggleSqueeze,
          onOpenServicePreview: handleOpenServicePreview,
          onOpenPreviewModal: handleOpenPreviewModal
        }
      }));
    }

    const visitedNodes = new Set();
    for (let i = 0; i <= currentStepIndex; i++) {
      if (simulation.steps[i].activeNodeId) {
        visitedNodes.add(simulation.steps[i].activeNodeId);
      }
    }

    // Determine screen state for View previews
    let screenState = 'default';
    if (simulation) {
      if (currentStep?.status === 'error' || currentStep?.mutations?.node_authviewmodel?.errorMessage) {
        screenState = 'error';
      } else if (currentStep?.mutations?.node_authviewmodel?.isLoading || currentStep?.stepIndex === 1 || currentStep?.stepIndex === 2) {
        screenState = 'loading';
      }
    }

    return visibleNodes.map((n) => {
      const isActive = n.id === currentStep.activeNodeId;
      const isVisited = visitedNodes.has(n.id);
      const isError = isActive && currentStep.status === 'error';
      const nodeMutations = currentStep.mutations?.[n.id] || null;
      const hasMutations = isActive && nodeMutations && Object.keys(nodeMutations).length > 0;
      const activeStepPerf = isActive ? currentStep.perfMetrics : null;

      let status = 'dimmed';
      if (isError) status = 'error';
      else if (hasMutations) status = 'mutated';
      else if (isActive) status = 'active';
      else if (isVisited) status = 'active';

      return {
        ...n,
        data: {
          ...n.data,
          agentNodeIds,
          onToggleAgentNode: handleToggleAgentNode,
          activeScope,
          isExpanded: isExpandedMap.get(n.id) || false,
          onToggleCompound: handleToggleCompound,
          simulationStatus: status,
          activeMutations: nodeMutations,
          activeStepPerf,
          screenState: n.data.kind === 'view' ? screenState : undefined,
          onScreenAction: handleScreenAction,
          onToggleSqueeze: handleToggleSqueeze,
          onOpenServicePreview: handleOpenServicePreview,
          onOpenPreviewModal: handleOpenPreviewModal
        }
      };
    });
  }, [
    nodes,
    abstractionLevel,
    expandedCompoundIds,
    simulation,
    currentStep,
    currentStepIndex,
    agentNodeIds,
    activeScope,
    handleToggleCompound,
    handleToggleAgentNode,
    handleScreenAction,
    handleToggleSqueeze,
    handleOpenServicePreview,
    handleOpenPreviewModal
  ]);

  const displayEdges = useMemo(() => {
    const rawNodes = rawGraphRef.current?.nodes || {};
    const visibleNodeIdSet = new Set(displayNodes.map((n) => n.id));

    // Resolve effective node ID for edge endpoint if original node is hidden inside a compound parent
    const resolveEffectiveEndpoint = (nodeId) => {
      if (visibleNodeIdSet.has(nodeId)) {
        return { nodeId, isRerouted: false };
      }
      const parentId = rawNodes[nodeId]?.parentId;
      if (parentId && visibleNodeIdSet.has(parentId)) {
        return { nodeId: parentId, isRerouted: true };
      }
      return null;
    };

    // Filter, reroute, and deduplicate edges
    const reroutedEdges = [];
    const seenEdgePairs = new Set();

    edges.forEach((e) => {
      const effSource = resolveEffectiveEndpoint(e.source);
      const effTarget = resolveEffectiveEndpoint(e.target);

      // If either endpoint cannot be resolved to a visible node, omit
      if (!effSource || !effTarget) return;

      // Internal edges within the same collapsed compound node (or self-loops after rerouting)
      if (effSource.nodeId === effTarget.nodeId) return;

      // Deduplicate edges connecting the same pair when collapsed
      const pairKey = `${effSource.nodeId}->${effTarget.nodeId}`;
      if (seenEdgePairs.has(pairKey)) return;
      seenEdgePairs.add(pairKey);

      const sourceHandle = effSource.isRerouted ? `${effSource.nodeId}_out` : e.sourceHandle;
      const targetHandle = effTarget.isRerouted ? `${effTarget.nodeId}_in` : e.targetHandle;

      reroutedEdges.push({
        ...e,
        source: effSource.nodeId,
        target: effTarget.nodeId,
        sourceHandle,
        targetHandle
      });
    });

    if (!simulation || !currentStep) return reroutedEdges;

    const activeEdgeId = currentStep.activeEdgeId;
    const visitedEdges = new Set();
    const edgeStepMap = new Map();
    for (let i = 0; i <= currentStepIndex; i++) {
      if (simulation.steps[i].activeEdgeId) {
        visitedEdges.add(simulation.steps[i].activeEdgeId);
        edgeStepMap.set(simulation.steps[i].activeEdgeId, simulation.steps[i]);
      }
    }

    return reroutedEdges.map((e) => {
      const isActive = e.id === activeEdgeId;
      const isVisited = visitedEdges.has(e.id);
      const isError = isActive && currentStep.status === 'error';
      const stepForEdge = edgeStepMap.get(e.id) || (isActive ? currentStep : null);
      const latency = stepForEdge?.perfMetrics?.latencyMs || e.data?.perfMeta?.averageLatencyMs || 0;

      // Latency Heatmap: <50ms green, 50-250ms amber, >250ms red
      const heatmapColor = isError
        ? '#ef4444'
        : latency > 250
        ? '#f43f5e'
        : latency > 50
        ? '#f59e0b'
        : '#10b981';

      const perfPrefix = latency > 0 ? (latency > 250 ? '⏳ ' : '⚡ ') + latency + 'ms' : '';
      const baseLabel = e.data?.contract?.payloadType ? e.data.contract.payloadType.split('->').pop().trim() : (e.label || '');
      const fullLabel = perfPrefix ? `${perfPrefix} · ${baseLabel}` : baseLabel;

      if (isActive) {
        return {
          ...e,
          animated: true,
          style: {
            stroke: heatmapColor,
            strokeWidth: 4,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: heatmapColor,
          },
          label: fullLabel || undefined
        };
      } else if (isVisited) {
        return {
          ...e,
          animated: false,
          style: { stroke: heatmapColor, strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: heatmapColor },
          label: fullLabel || undefined
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
  }, [edges, displayNodes, simulation, currentStep, currentStepIndex]);

  // Validate edge connection in real time against architectural guardrails
  const isValidConnection = useCallback(
    (connection) => {
      const graph = rawGraphRef.current;
      const result = validateEdgeConnection(
        connection,
        graph,
        edges,
        activeScope
      );
      if (!result.isValid) {
        setGuardrailAlert({
          rule: result.rule,
          reason: result.reason
        });
      }
      return result.isValid;
    },
    [edges, activeScope]
  );

  // Handle new edge connection with architectural guardrails & contract inference
  const onConnect = useCallback(
    (params) => {
      const graph = rawGraphRef.current;
      const validation = validateEdgeConnection(params, graph, edges, activeScope);
      if (!validation.isValid) {
        setGuardrailAlert({ rule: validation.rule, reason: validation.reason });
        return;
      }

      const sourceNode = graph?.nodes?.[params.source];
      const targetNode = graph?.nodes?.[params.target];
      const inferred = inferEdgeContract(sourceNode, targetNode, params.targetHandle);

      const edgeId = `edge_${params.source}_to_${params.target}_${Date.now()}`;
      const newEdge = {
        ...params,
        id: edgeId,
        animated: inferred.executionMode === 'async',
        style: {
          stroke: inferred.perfMeta?.averageLatencyMs > 250
            ? '#f43f5e'
            : inferred.executionMode === 'async'
            ? '#38bdf8'
            : '#94a3b8',
          strokeWidth: 2
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: inferred.perfMeta?.averageLatencyMs > 250 ? '#f43f5e' : '#38bdf8'
        },
        data: {
          id: edgeId,
          sourceNodeId: params.source,
          sourcePortId: params.sourceHandle,
          targetNodeId: params.target,
          targetPortId: params.targetHandle,
          edgeKind: inferred.edgeKind,
          executionMode: inferred.executionMode,
          contract: inferred.contract,
          perfMeta: inferred.perfMeta
        },
        label: inferred.contract?.payloadType
      };
      setEdges((eds) => addEdge(newEdge, eds));
      setGuardrailAlert(null);
    },
    [edges, activeScope, setEdges]
  );

  // Handle edge reconnection by dragging endpoints
  const onReconnect = useCallback(
    (oldEdge, newConnection) => {
      const graph = rawGraphRef.current;
      const otherEdges = edges.filter((e) => e.id !== oldEdge.id);
      const validation = validateEdgeConnection(newConnection, graph, otherEdges, activeScope);
      if (!validation.isValid) {
        setGuardrailAlert({ rule: validation.rule, reason: validation.reason });
        return;
      }

      const sourceNode = graph?.nodes?.[newConnection.source];
      const targetNode = graph?.nodes?.[newConnection.target];
      const inferred = inferEdgeContract(sourceNode, targetNode, newConnection.targetHandle);

      setEdges((prevEdges) =>
        prevEdges.map((e) => {
          if (e.id === oldEdge.id) {
            return {
              ...e,
              source: newConnection.source,
              target: newConnection.target,
              sourceHandle: newConnection.sourceHandle,
              targetHandle: newConnection.targetHandle,
              animated: inferred.executionMode === 'async',
              style: {
                stroke: inferred.perfMeta?.averageLatencyMs > 250
                  ? '#f43f5e'
                  : inferred.executionMode === 'async'
                  ? '#38bdf8'
                  : '#94a3b8',
                strokeWidth: 2
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: inferred.perfMeta?.averageLatencyMs > 250 ? '#f43f5e' : '#38bdf8'
              },
              data: {
                ...e.data,
                sourceNodeId: newConnection.source,
                sourcePortId: newConnection.sourceHandle,
                targetNodeId: newConnection.target,
                targetPortId: newConnection.targetHandle,
                edgeKind: inferred.edgeKind,
                executionMode: inferred.executionMode,
                contract: inferred.contract,
                perfMeta: inferred.perfMeta
              },
              label: inferred.contract?.payloadType
            };
          }
          return e;
        })
      );
      setGuardrailAlert(null);
    },
    [edges, activeScope, setEdges]
  );

  // Handle re-routing edge from Inspector Sidebar
  const handleUpdateEdge = useCallback(
    (edgeId, newTargetData) => {
      const { target, targetHandle } = newTargetData;
      const graph = rawGraphRef.current;
      const targetNode = graph?.nodes?.[target];
      const edgeToUpdate = edges.find((e) => e.id === edgeId);
      if (!edgeToUpdate) return;

      const sourceNode = graph?.nodes?.[edgeToUpdate.source];
      const inferred = inferEdgeContract(sourceNode, targetNode, targetHandle);

      setEdges((prev) =>
        prev.map((e) => {
          if (e.id === edgeId) {
            const updated = {
              ...e,
              target,
              targetHandle,
              animated: inferred.executionMode === 'async',
              style: {
                stroke: inferred.perfMeta?.averageLatencyMs > 250
                  ? '#f43f5e'
                  : inferred.executionMode === 'async'
                  ? '#38bdf8'
                  : '#94a3b8',
                strokeWidth: 2
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: inferred.perfMeta?.averageLatencyMs > 250 ? '#f43f5e' : '#38bdf8'
              },
              data: {
                ...e.data,
                targetNodeId: target,
                targetPortId: targetHandle,
                edgeKind: inferred.edgeKind,
                executionMode: inferred.executionMode,
                contract: inferred.contract,
                perfMeta: inferred.perfMeta
              },
              label: inferred.contract?.payloadType
            };
            setSelectedElement(updated);
            return updated;
          }
          return e;
        })
      );
      setGuardrailAlert(null);
    },
    [edges, setEdges]
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

  // Auto Layout: Sequential Pipeline Architecture & Hierarchical SwiftUI View Layers
  const handleAutoLayout = useCallback(() => {
    // Sequential Pipeline Stages:
    // Stage 0 (x: 60): App Roots & Navigation Containers (e.g. LandmarksApp, ContentView)
    // Stage 1 (x: 440): Primary Top-Level Screens (e.g. CategoryHome, LandmarkList, LoginView, RemindersListView)
    // Stage 2 (x: 840): ViewModels & Detail/Sheet Screens (e.g. ModelData, LandmarkDetail, ProfileHost, ReminderDetailsView, BiometricApprovalView)
    // Stage 3 (x: 1240): Rows, Sub-Screens & Component Sections (e.g. CategoryRow, LandmarkRow, ProfileSummary, HikeView)
    // Stage 4 (x: 1640): Leaf Subviews & Domain Services (e.g. MapView, CircleImage, FavoriteButton, LiveAuthService)
    // Stage 5 (x: 2040): Graphic Primitives & Repositories (e.g. BadgeBackground, BadgeSymbol, KeychainStorage)
    // Stage 6 (x: 2440): Test Suites & Verification (e.g. LandmarksTests, AuthSampleTests)
    const stageByNodeId = {};
    nodes.forEach((node) => {
      const name = node.data?.name || '';
      const kind = node.data?.kind || '';
      if (name.endsWith('App')) {
        stageByNodeId[node.id] = 0; // Stage 0: App Entry
      } else if (name === 'ContentView' || name === 'RootView') {
        stageByNodeId[node.id] = 1; // Stage 1: Main Tab / Navigation Hub
      } else if (kind === 'viewModel' || name.endsWith('Home') || name.endsWith('List') || name === 'LoginView' || name === 'RemindersListView') {
        stageByNodeId[node.id] = 2; // Stage 2: Central State Store & Primary Screens
      } else if (name.endsWith('Detail') || name.endsWith('Host') || name.endsWith('Details') || name.includes('Approval')) {
        stageByNodeId[node.id] = 3; // Stage 3: Detail Views & Sheets
      } else if (name === 'Badge' || name === 'HikeView') {
        stageByNodeId[node.id] = 4; // Stage 4: Reusable Compound Widgets
      } else if (name.includes('Test')) {
        stageByNodeId[node.id] = 6;
      } else if (kind === 'repository' || name.includes('Storage')) {
        stageByNodeId[node.id] = 5;
      } else if (kind === 'service') {
        stageByNodeId[node.id] = 4;
      } else {
        stageByNodeId[node.id] = 3;
      }
    });

    const xByStage = {
      0: 60,
      1: 440,
      2: 840,
      3: 1240,
      4: 1640,
      5: 2040,
      6: 2440,
    };

    const yByStage = {
      0: 220,
      1: 220,
      2: 120,
      3: 160,
      4: 160,
      5: 160,
      6: 160,
    };

    const rawNodes = rawGraphRef.current?.nodes || {};
    // Separate top-level / screen nodes from nested child subviews
    const topLevelNodes = nodes
      .filter((n) => !(n.data?.parentId || rawNodes[n.id]?.parentId))
      .sort((a, b) => {
        const stageA = stageByNodeId[a.id] ?? 3;
        const stageB = stageByNodeId[b.id] ?? 3;
        if (stageA !== stageB) return stageA - stageB;
        if (a.data?.kind === 'viewModel') return -1;
        if (b.data?.kind === 'viewModel') return 1;
        return (a.data?.name || '').localeCompare(b.data?.name || '');
      });

    const childNodes = nodes.filter((n) => Boolean(n.data?.parentId || rawNodes[n.id]?.parentId));

    const newPositions = {};
    topLevelNodes.forEach((node) => {
      const stage = stageByNodeId[node.id] ?? 3;
      const x = xByStage[stage] ?? 840;
      const y = yByStage[stage] ?? 120;
      newPositions[node.id] = { x, y };
      yByStage[stage] = y + 290;
    });

    // Group child subviews by parentId and position them adjacent to the compound screen container
    const childrenByParent = {};
    childNodes.forEach((node) => {
      const pId = node.data?.parentId || rawNodes[node.id]?.parentId;
      if (!childrenByParent[pId]) childrenByParent[pId] = [];
      childrenByParent[pId].push(node);
    });

    Object.entries(childrenByParent).forEach(([pId, children]) => {
      const parentPos = newPositions[pId] || { x: 840, y: 120 };
      children.forEach((child, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        newPositions[child.id] = {
          x: parentPos.x + 360 + col * 340,
          y: parentPos.y + 40 + row * 250
        };
      });
    });

    setNodes((nds) =>
      nds.map((node) => {
        const pos = newPositions[node.id] || node.position;
        return {
          ...node,
          position: pos,
          data: {
            ...node.data,
            canvasMeta: {
              ...node.data?.canvasMeta,
              position: pos,
            }
          }
        };
      })
    );
  }, [nodes, setNodes]);

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
          contract: e.data?.contract || { payloadType: 'Payload' },
          perfMeta: e.data?.perfMeta
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
        onAutoLayout={handleAutoLayout}
        onSave={handleSave}
        onOpenSimulation={() => setIsSimModalOpen(true)}
        isSaving={isSaving}
        isConnected={isConnected}
        agentNodeCount={agentNodeIds.length}
        onOpenAgentContext={handleOpenAgentContext}
        onClearAgentContext={handleClearAgentContext}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        abstractionLevel={abstractionLevel}
        onLevelChange={setAbstractionLevel}
        visibleNodeCount={displayNodes.length}
        totalNodeCount={nodes.length}
      />

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        isValidConnection={isValidConnection}
        edgesReconnectable={true}
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
        onUpdateEdge={handleUpdateEdge}
        rawGraph={rawGraph}
        edges={edges}
        activeScope={activeScope}
        onOpenServicePreview={handleOpenServicePreview}
        agentNodeIds={agentNodeIds}
        onToggleAgentNode={handleToggleAgentNode}
      />

      <EdgeGuardrailToast
        alert={guardrailAlert}
        onClose={() => setGuardrailAlert(null)}
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
        onOpenProfiler={() => setIsPerfModalOpen(true)}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />

      <ExportTestModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        simulation={simulation}
      />

      <PerformanceProfilingModal
        isOpen={isPerfModalOpen}
        onClose={() => setIsPerfModalOpen(false)}
        steps={simulation?.steps || (rawGraph ? PRESET_SCENARIOS[0].traceGenerator(rawGraph) : [])}
        graph={rawGraph}
      />

      <DeviceZoomModal
        isOpen={!!zoomPreviewNode}
        onClose={() => setZoomPreviewNode(null)}
        node={zoomPreviewNode ? { ...zoomPreviewNode, onScreenAction: handleScreenAction } : null}
      />

      <ServicePreviewModal
        isOpen={Boolean(servicePreviewNode)}
        onClose={() => setServicePreviewNode(null)}
        node={servicePreviewNode}
      />

      <AgentScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        scope={activeScope}
        initialTab={scopeModalTab}
        onUnlock={handleClearAgentContext}
      />
    </div>
  );
}
