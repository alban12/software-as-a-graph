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
import LeftSidebar from './components/LeftSidebar';
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
import BottleneckDrawer from './components/BottleneckDrawer';
import AppTreeNavigator from './components/AppTreeNavigator';
import { analyzeBottlenecks } from './analysis/bottleneckEngine';
import { decomposeAppTree, getNodeDimensions, rearrangeNodes, detectCollisions, computeAdaptiveTreeLayout, isSystemDesignNode } from './analysis/treeEngine';
import { computeTemporalPipelineLayout } from './analysis/pipelineEngine';
import { computeMeshForceLayout } from './analysis/meshEngine';
import { analyzeMlConstraints } from './analysis/mlConstraintEngine';
import { parseSaagUri } from './utils/crossReferences';
import { generateScopeContract } from './utils/scopeContract';
import { validateEdgeConnection, inferEdgeContract } from './utils/edgeGuardrails';
import { PRESET_SCENARIOS } from './simulation/engine';

const nodeTypes = {
  saagNode: CustomNode,
};

const DEFAULT_EDGE_LABEL_STYLE = {
  fill: '#ffffff',
  fontWeight: 600,
  fontSize: 11.5,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
};

const DEFAULT_EDGE_LABEL_BG_STYLE = {
  fill: '#1c1c1e',
  fillOpacity: 0.94,
  stroke: 'rgba(255, 255, 255, 0.22)',
  strokeWidth: 1
};

const DEFAULT_EDGE_LABEL_PADDING = [8, 5];
const DEFAULT_EDGE_LABEL_BORDER_RADIUS = 6;

export default function App() {
  const defaultEdgeOptions = useMemo(
    () => ({
      labelStyle: DEFAULT_EDGE_LABEL_STYLE,
      labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
      labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
      labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
    }),
    []
  );

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
  const abstractionLevelRef = useRef('L1');
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
  const [taskObjective, setTaskObjective] = useState('');
  const [isScopeIsolationActive, setIsScopeIsolationActive] = useState(false);
  const [selectedCanvasNodeIds, setSelectedCanvasNodeIds] = useState([]);
  const [hotReloadToast, setHotReloadToast] = useState(null);

  // Modern Left Navigation Sidebar (Collapsible with Cmd+B)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Benchmark / Project Registry Switching
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState('landmarks');

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || {
      id: activeProjectId,
      projectType: metadata?.projectType || 'ios'
    };
  }, [projects, activeProjectId, metadata?.projectType]);

  const currentDomain = activeProject?.projectType || metadata?.projectType || 'ios';

  // ML Systems & Hardware Constraint Engine Evaluation
  const mlConstraintData = useMemo(() => {
    if (!rawGraph) return null;
    const projectType = rawGraph.metadata?.projectType;
    const hasMlNodes = Object.values(rawGraph.nodes || {}).some((n) =>
      ['model', 'hardware', 'dataset', 'preprocessor', 'optimizer', 'interconnect', 'exporter'].includes(n.kind)
    );
    if (projectType === 'ml' || hasMlNodes) {
      return analyzeMlConstraints(rawGraph);
    }
    return null;
  }, [rawGraph]);

  // Bottleneck Diagnostic Engine & Architectural Reorganization
  const [isBottleneckLensActive, setIsBottleneckLensActive] = useState(false);
  const [isBottleneckDrawerOpen, setIsBottleneckDrawerOpen] = useState(false);
  const [selectedBottleneck, setSelectedBottleneck] = useState(null);
  const [appliedRefactorIds, setAppliedRefactorIds] = useState(new Set());

  const bottleneckData = useMemo(() => {
    return analyzeBottlenecks(rawGraph);
  }, [rawGraph]);

  const bottleneckNodeMap = useMemo(() => {
    const map = {};
    (bottleneckData.bottlenecks || []).forEach((b) => {
      if (b.plan && appliedRefactorIds.has(b.plan.id)) return;
      if (!map[b.nodeId]) map[b.nodeId] = [];
      map[b.nodeId].push(b);
    });
    return map;
  }, [bottleneckData, appliedRefactorIds]);

  const handleToggleBottleneckLens = useCallback(() => {
    setIsBottleneckLensActive((prev) => {
      const next = !prev;
      if (next) {
        setIsBottleneckDrawerOpen(true);
      }
      return next;
    });
  }, []);

  const handleOpenBottlenecks = useCallback(() => {
    setIsBottleneckDrawerOpen(true);
  }, []);

  // Layout Mode & Tab-as-a-Branch Tree View (3 Fluid Lenses: Tree, Pipeline, Mesh)
  const [layoutMode, setLayoutMode] = useState('tree'); // 'tree' | 'pipeline' | 'mesh'
  const meshPositionsRef = useRef({});
  const [activeBranchId, setActiveBranchId] = useState('all');
  const [isTreeNavigatorOpen, setIsTreeNavigatorOpen] = useState(false);
  const reactFlowInstanceRef = useRef(null);

  const treeData = useMemo(() => {
    return decomposeAppTree(rawGraph);
  }, [rawGraph]);

  const handleSelectTreeNode = useCallback((nodeId) => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    setSelectedElement({ type: 'node', data: targetNode.data });

    if (reactFlowInstanceRef.current) {
      const pos = targetNode.position || { x: 0, y: 0 };
      reactFlowInstanceRef.current.setCenter(pos.x + 160, pos.y + 120, {
        zoom: 1.15,
        duration: 600
      });
    }
  }, [nodes]);

  const handleToggleAgentNode = useCallback((nodeId) => {
    setAgentNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }, []);

  const handleClearAgentContext = useCallback(() => {
    setAgentNodeIds([]);
  }, []);

  const handleToggleSqueeze = useCallback((nodeId) => {
    setNodes((nds) => {
      const updated = nds.map((node) => {
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
      });

      const currentPositions = {};
      const nodeMap = {};
      updated.forEach((n) => {
        currentPositions[n.id] = n.position;
        nodeMap[n.id] = n.data || n;
      });
      const { positions: rearranged } = rearrangeNodes(currentPositions, nodeMap, nodeId, {
        paddingX: 40,
        paddingY: 35
      });
      return updated.map((n) => ({
        ...n,
        position: rearranged[n.id] || n.position
      }));
    });
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

  // Handle 1-Click Interactive Canvas Graph Reorganization
  const handleApplyGraphRefactor = useCallback((plan) => {
    if (!plan || !plan.architecturalChanges) return;
    const { newNodes, removeEdges, addEdges } = plan.architecturalChanges;

    // 1. Add new nodes to React Flow nodes state
    if (newNodes && newNodes.length > 0) {
      setNodes((currentNodes) => {
        const existingIds = new Set(currentNodes.map((n) => n.id));
        const formattedNew = newNodes
          .filter((n) => !existingIds.has(n.id))
          .map((n) => ({
            id: n.id,
            type: 'saagNode',
            position: n.canvasMeta?.position || { x: 450, y: 350 },
            data: {
              ...n,
              onScreenAction: handleScreenAction,
              onToggleSqueeze: handleToggleSqueeze,
              onOpenServicePreview: handleOpenServicePreview,
              onOpenPreviewModal: handleOpenPreviewModal
            }
          }));
        return [...currentNodes, ...formattedNew];
      });
    }

    // 2. Remove decoupled edges & add rewired edges
    const removeSet = new Set(removeEdges || []);
    setEdges((currentEdges) => {
      const remaining = currentEdges.filter((e) => !removeSet.has(e.id));
      const newRfEdges = (addEdges || []).map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourcePortId,
        targetHandle: edge.targetPortId,
        animated: edge.executionMode === 'async',
        style: {
          stroke: edge.executionMode === 'async' ? '#38bdf8' : '#94a3b8',
          strokeWidth: 2
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edge.executionMode === 'async' ? '#38bdf8' : '#94a3b8',
        },
        data: edge,
        label: edge.contract?.payloadType ? edge.contract.payloadType.split('->').pop().trim() : undefined,
        labelStyle: DEFAULT_EDGE_LABEL_STYLE,
        labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
        labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
        labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS,
      }));
      return [...remaining, ...newRfEdges];
    });

    // 3. Update rawGraphRef and rawGraph so bottleneckEngine immediately recalculates
    setRawGraph((prev) => {
      if (!prev) return prev;
      const updatedNodes = { ...prev.nodes };
      const updatedEdges = { ...prev.edges };

      (newNodes || []).forEach((n) => {
        updatedNodes[n.id] = n;
      });
      (removeEdges || []).forEach((eid) => {
        delete updatedEdges[eid];
      });
      (addEdges || []).forEach((e) => {
        updatedEdges[e.id] = e;
      });

      const nextGraph = {
        ...prev,
        nodes: updatedNodes,
        edges: updatedEdges
      };
      rawGraphRef.current = nextGraph;
      return nextGraph;
    });

    setAppliedRefactorIds((prev) => new Set([...prev, plan.id]));
  }, [setNodes, setEdges, handleScreenAction, handleToggleSqueeze, handleOpenServicePreview, handleOpenPreviewModal]);

  // Handle Bi-Directional Code-Sync to .swift files on disk
  const handleApplyCodebaseRefactor = useCallback(async (plan) => {
    try {
      const res = await fetch('/api/apply-refactor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to apply refactoring to codebase');
      }

      handleApplyGraphRefactor(plan);
      return data;
    } catch (err) {
      console.error('Code refactoring error:', err);
      throw err;
    }
  }, [handleApplyGraphRefactor]);

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

    const tree = decomposeAppTree(saagGraph);
    const currentLevel = abstractionLevelRef.current || 'L1';

    // Filter visible nodes based on active abstraction level and layout mode
    const rawNodes = saagGraph.nodes;
    const initialVisible = Object.values(rawNodes).filter((n) => {
      if (!isSystemDesignNode(n)) return false;
      if (currentLevel === 'L1') {
        return n.level === 'L1_SCREEN' || n.level === 'L1_SYSTEM' || !n.level;
      }
      if (currentLevel === 'L2') {
        return n.level !== 'L3_PRIMITIVE' && n.level !== 'L3_EXECUTION';
      }
      return true;
    });

    const isIosProject = !saagGraph.metadata?.projectType || saagGraph.metadata.projectType === 'ios';
    const adaptivePositions = isIosProject
      ? computeAdaptiveTreeLayout(initialVisible, tree, saagGraph)
      : {};
    const fullTreePositions = tree?.treePositions || {};

    // Seed meshPositionsRef with saved positions from graph JSON (or algorithmic fallbacks)
    const initialMesh = {};
    Object.values(saagGraph.nodes).forEach((node) => {
      const fallbackPos = (isIosProject && adaptivePositions[node.id]) || fullTreePositions[node.id] || { x: 100, y: 100 };
      initialMesh[node.id] = node.canvasMeta?.position || fallbackPos;
    });
    meshPositionsRef.current = initialMesh;

    const rfNodes = Object.values(saagGraph.nodes).map((node) => {
      const computedPos = layoutMode === 'mesh'
        ? (meshPositionsRef.current[node.id] || { x: 100, y: 100 })
        : ((isIosProject && adaptivePositions[node.id]) || fullTreePositions[node.id] || node.canvasMeta?.position || { x: 100, y: 100 });
      return {
        id: node.id,
        type: 'saagNode',
        position: computedPos,
        data: {
          ...node,
          canvasMeta: {
            ...node.canvasMeta,
            position: computedPos
          },
          onScreenAction: handleScreenAction,
          onToggleSqueeze: handleToggleSqueeze,
          onOpenServicePreview: handleOpenServicePreview,
          onOpenPreviewModal: handleOpenPreviewModal,
          onNavigateCrossReference: handleNavigateCrossReference
        },
      };
    });

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
      labelStyle: DEFAULT_EDGE_LABEL_STYLE,
      labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
      labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
      labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS,
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);

    if (reactFlowInstanceRef.current) {
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 400 });
      }, 100);
    }
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
    return generateScopeContract(
      agentNodeIds,
      rawGraph,
      `Agent Context (${agentNodeIds.length} Nodes)`,
      { taskObjective }
    );
  }, [rawGraph, agentNodeIds, taskObjective]);

  const handleSelectionChange = useCallback(({ nodes: selNodes }) => {
    const ids = (selNodes || []).map((n) => n.id);
    setSelectedCanvasNodeIds(ids);
  }, []);

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

  // Switch Domain Mode (iOS App | Agents Graph | ML as a Graph)
  const handleSwitchDomain = useCallback(async (domainId) => {
    if (domainId === currentDomain) return;

    const domainProjects = projects.filter((p) => (p.projectType || 'ios') === domainId);
    let targetProjectId = domainProjects[0]?.id;

    if (!targetProjectId) {
      if (domainId === 'ios') targetProjectId = 'landmarks';
      else if (domainId === 'agents') targetProjectId = 'agent_orchestrator';
      else if (domainId === 'ml') targetProjectId = 'ml_pipeline';
    }

    if (targetProjectId) {
      await handleSwitchProject(targetProjectId);
    }
  }, [currentDomain, projects, handleSwitchProject]);

  // Navigate Cross-Project References: saag://<projectType>/<projectId>/<nodeId>
  const handleNavigateCrossReference = useCallback(async (targetUri) => {
    const parsed = parseSaagUri(targetUri);
    if (!parsed) {
      console.warn('Invalid SaaG URI:', targetUri);
      return;
    }

    const { projectId, nodeId } = parsed;

    // Switch project if navigating across projects
    if (projectId && projectId !== activeProjectId) {
      await handleSwitchProject(projectId);
    }

    // Highlight and center target node
    if (nodeId) {
      setTimeout(() => {
        const currentNodes = rawGraphRef.current?.nodes || {};
        const targetNode = currentNodes[nodeId];
        if (targetNode) {
          setSelectedElement({ data: targetNode });
          const pos = targetNode.canvasMeta?.position;
          if (pos && reactFlowInstanceRef.current) {
            reactFlowInstanceRef.current.setCenter(pos.x + 140, pos.y + 100, { zoom: 1.15, duration: 600 });
          }
        }
      }, 400);
    }
  }, [activeProjectId, handleSwitchProject]);

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
            if (message.source === 'SWIFT_WATCHER') {
              setHotReloadToast({
                filename: message.changedFile || 'Swift Source',
                timestamp: message.timestamp || Date.now()
              });
              setTimeout(() => setHotReloadToast(null), 3200);
            }
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

      // Filter out non-architectural noise (abstract away what an LLM handles: tests, drawing helpers)
      if (!isSystemDesignNode(n)) return false;

      if (abstractionLevel === 'L1') {
        // If node is a nested child of a compound screen:
        // Only show if user explicitly clicked expand on the parent
        if (parentId) {
          return expandedCompoundIds.has(parentId);
        }
        // At L1 level, show strictly high-level screens and central architecture nodes
        return nodeLevel === 'L1_SCREEN' || nodeLevel === 'L1_SYSTEM' || !nodeLevel;
      }

      if (abstractionLevel === 'L2') {
        // L2 Components: Show screens and subviews, hide L3 primitives and execution units
        if (nodeLevel === 'L3_PRIMITIVE' || nodeLevel === 'L3_EXECUTION') return false;
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
      return visibleNodes.map((n) => {
        const isNodeInActiveBranch =
          activeBranchId === 'all' ||
          treeData?.branchMap?.[n.id] === activeBranchId ||
          treeData?.rootAppNode?.id === n.id ||
          treeData?.containerNode?.id === n.id ||
          Boolean(treeData?.stateShelfNodes?.some((s) => s.id === n.id));

        return {
          ...n,
          data: {
            ...n.data,
            agentNodeIds,
            onToggleAgentNode: handleToggleAgentNode,
            activeScope,
            isDimmedByScope: isScopeIsolationActive && agentNodeIds.length > 0 && !agentNodeIds.includes(n.id),
            isExpanded: isExpandedMap.get(n.id) || false,
            onToggleCompound: handleToggleCompound,
            isBottleneckLensActive,
            bottlenecks: bottleneckNodeMap[n.id] || [],
            onOpenBottleneckDrawer: (b) => {
              setSelectedBottleneck(b);
              setIsBottleneckDrawerOpen(true);
            },
            isBranchDimmed: !isNodeInActiveBranch,
            onScreenAction: handleScreenAction,
            onToggleSqueeze: handleToggleSqueeze,
            onOpenServicePreview: handleOpenServicePreview,
            onOpenPreviewModal: handleOpenPreviewModal,
            onNavigateCrossReference: handleNavigateCrossReference
          }
        };
      });
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

      const isNodeInActiveBranch =
        activeBranchId === 'all' ||
        treeData?.branchMap?.[n.id] === activeBranchId ||
        treeData?.rootAppNode?.id === n.id ||
        treeData?.containerNode?.id === n.id ||
        Boolean(treeData?.stateShelfNodes?.some((s) => s.id === n.id));

      return {
        ...n,
        data: {
          ...n.data,
          agentNodeIds,
          onToggleAgentNode: handleToggleAgentNode,
          activeScope,
          isDimmedByScope: isScopeIsolationActive && agentNodeIds.length > 0 && !agentNodeIds.includes(n.id),
          isExpanded: isExpandedMap.get(n.id) || false,
          onToggleCompound: handleToggleCompound,
          isBottleneckLensActive,
          bottlenecks: bottleneckNodeMap[n.id] || [],
          onOpenBottleneckDrawer: (b) => {
            setSelectedBottleneck(b);
            setIsBottleneckDrawerOpen(true);
          },
          isBranchDimmed: !isNodeInActiveBranch,
          simulationStatus: status,
          activeMutations: nodeMutations,
          activeStepPerf,
          screenState: n.data.kind === 'view' ? screenState : undefined,
          onScreenAction: handleScreenAction,
          onToggleSqueeze: handleToggleSqueeze,
          onOpenServicePreview: handleOpenServicePreview,
          onOpenPreviewModal: handleOpenPreviewModal,
          onNavigateCrossReference: handleNavigateCrossReference
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
    isScopeIsolationActive,
    isBottleneckLensActive,
    bottleneckNodeMap,
    activeBranchId,
    treeData,
    layoutMode,
    handleToggleCompound,
    handleToggleAgentNode,
    handleScreenAction,
    handleToggleSqueeze,
    handleOpenServicePreview,
    handleOpenPreviewModal,
    handleNavigateCrossReference
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

    if (!simulation || !currentStep) {
      return reroutedEdges.map((e) => {
        const latency = e.data?.perfMeta?.averageLatencyMs || 0;
        const isCritical = isBottleneckLensActive && (latency >= 200 || e.data?.perfMeta?.isCriticalPath);

        const srcInScope = agentNodeIds.includes(e.source);
        const tgtInScope = agentNodeIds.includes(e.target);
        const isBoundaryContract = agentNodeIds.length > 0 && srcInScope !== tgtInScope;
        const isDimmedByScope = isScopeIsolationActive && agentNodeIds.length > 0 && !srcInScope && !tgtInScope;

        // Frozen Boundary Contract crossing styling
        if (isBoundaryContract) {
          const rawEdge = e.data || {};
          const contractLabel = rawEdge.contract?.payloadType
            ? `🔒 ${rawEdge.contract.payloadType.split('->').pop().trim()}`
            : '🔒 Boundary Contract';

          return {
            ...e,
            animated: true,
            style: {
              stroke: '#c084fc',
              strokeWidth: 2.5,
              strokeDasharray: '5 5'
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#c084fc' },
            label: contractLabel,
            labelStyle: {
              fill: '#e9d5ff',
              fontWeight: 700,
              fontSize: 11,
              fontFamily: 'var(--font-mono)'
            },
            labelBgStyle: {
              fill: '#2e1065',
              fillOpacity: 0.95,
              stroke: '#c084fc',
              strokeWidth: 1.2
            },
            labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
            labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
          };
        }

        if (isCritical) {
          return {
            ...e,
            animated: true,
            style: { stroke: '#f43f5e', strokeWidth: 3 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' },
            label: `⚠️ Latency: ${latency}ms`,
            labelStyle: {
              fill: '#fca5a5',
              fontWeight: 700,
              fontSize: 11.5,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
            },
            labelBgStyle: {
              fill: '#2a1115',
              fillOpacity: 0.96,
              stroke: '#f43f5e',
              strokeWidth: 1.2
            },
            labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
            labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
          };
        }

        // Tree View Specific Edge Styling
        if (layoutMode === 'tree') {
          const isStateBinding =
            e.data?.edgeKind === 'stateBinding' ||
            e.data?.contract?.payloadType?.includes('State') ||
            e.source === 'node_modeldata' ||
            e.target === 'node_modeldata';

          // If branch isolation is active, dim edges outside this branch
          if (activeBranchId !== 'all') {
            const edgeInBranch =
              treeData?.branchMap?.[e.source] === activeBranchId ||
              treeData?.branchMap?.[e.target] === activeBranchId;
            if (!edgeInBranch && !isStateBinding) {
              return {
                ...e,
                animated: false,
                style: { stroke: 'rgba(255, 255, 255, 0.05)', strokeWidth: 1 },
                label: undefined
              };
            }
          }

          // Subtle state bindings in Tree View so they don't clutter navigation swimlanes
          if (isStateBinding) {
            const isSelected =
              selectedElement?.data?.id === e.id ||
              selectedElement?.data?.id === e.source ||
              selectedElement?.data?.id === e.target;
            return {
              ...e,
              animated: false,
              style: {
                stroke: isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.22)',
                strokeWidth: isSelected ? 2 : 1,
                strokeDasharray: '4 4'
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.25)'
              },
              labelStyle: {
                fill: isSelected ? '#fde68a' : '#fbbf24',
                fontWeight: 600,
                fontSize: 11,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
              },
              labelBgStyle: {
                fill: '#1c1c1e',
                fillOpacity: 0.94,
                stroke: isSelected ? '#f59e0b' : 'rgba(245, 158, 11, 0.35)',
                strokeWidth: 1
              },
              labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
              labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
            };
          }
        }

        return {
          ...e,
          labelStyle: DEFAULT_EDGE_LABEL_STYLE,
          labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
          labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
          labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
        };
      });
    }

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
          label: fullLabel || undefined,
          labelStyle: {
            fill: '#ffffff',
            fontWeight: 700,
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
          },
          labelBgStyle: {
            fill: '#18181b',
            fillOpacity: 0.96,
            stroke: heatmapColor,
            strokeWidth: 1.5
          },
          labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
          labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
        };
      } else if (isVisited) {
        return {
          ...e,
          animated: false,
          style: { stroke: heatmapColor, strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: heatmapColor },
          label: fullLabel || undefined,
          labelStyle: {
            fill: '#f4f4f5',
            fontWeight: 600,
            fontSize: 11.5,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
          },
          labelBgStyle: {
            fill: '#1c1c1e',
            fillOpacity: 0.94,
            stroke: heatmapColor,
            strokeWidth: 1
          },
          labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
          labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
        };
      } else {
        return {
          ...e,
          animated: false,
          style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1.5, strokeDasharray: '4 4' },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,0.1)' },
          labelStyle: {
            fill: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 500,
            fontSize: 10.5,
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace'
          },
          labelBgStyle: {
            fill: '#141416',
            fillOpacity: 0.8,
            stroke: 'rgba(255, 255, 255, 0.08)',
            strokeWidth: 0.5
          },
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 5
        };
      }
    });
  }, [
    edges,
    displayNodes,
    simulation,
    currentStep,
    currentStepIndex,
    layoutMode,
    activeBranchId,
    treeData,
    selectedElement,
    isBottleneckLensActive,
    agentNodeIds,
    isScopeIsolationActive
  ]);

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
        label: inferred.contract?.payloadType,
        labelStyle: DEFAULT_EDGE_LABEL_STYLE,
        labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
        labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
        labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
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
              label: inferred.contract?.payloadType,
              labelStyle: DEFAULT_EDGE_LABEL_STYLE,
              labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
              labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
              labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
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
              label: inferred.contract?.payloadType,
              labelStyle: DEFAULT_EDGE_LABEL_STYLE,
              labelBgStyle: DEFAULT_EDGE_LABEL_BG_STYLE,
              labelBgPadding: DEFAULT_EDGE_LABEL_PADDING,
              labelBgBorderRadius: DEFAULT_EDGE_LABEL_BORDER_RADIUS
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

  // Handle Multi-Scale Abstraction Level Change with Zero-Void Adaptive Packing
  const handleLevelChange = useCallback((newLevel) => {
    setAbstractionLevel(newLevel);
    abstractionLevelRef.current = newLevel;

    const rawNodes = rawGraphRef.current?.nodes || {};
    const visibleUnderNewLevel = nodes.filter((n) => {
      const nodeLevel = n.data?.level || rawNodes[n.id]?.level || 'L1_SCREEN';
      const parentId = n.data?.parentId || rawNodes[n.id]?.parentId;

      if (newLevel === 'L1') {
        if (parentId) return expandedCompoundIds.has(parentId);
        return nodeLevel === 'L1_SCREEN' || nodeLevel === 'L1_SYSTEM' || !nodeLevel;
      }
      if (newLevel === 'L2') {
        if (nodeLevel === 'L3_PRIMITIVE' || nodeLevel === 'L3_EXECUTION') return false;
        return true;
      }
      return true;
    });

    const newPositions = computePositionsForMode(layoutMode, visibleUnderNewLevel);
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

    if (reactFlowInstanceRef.current) {
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 450 });
      }, 50);
    }
  }, [nodes, treeData, layoutMode, expandedCompoundIds, setNodes]);

  // Compute Layout Positions for 3 Fluid Lenses (Tree, Pipeline, Mesh)
  const computePositionsForMode = useCallback((targetMode, targetNodes) => {
    if (targetMode === 'mesh') {
      const positions = {};
      targetNodes.forEach((n) => {
        positions[n.id] = meshPositionsRef.current[n.id] || n.position || { x: 100, y: 100 };
      });
      return positions;
    } else if (targetMode === 'tree' && treeData) {
      const adaptivePositions = computeAdaptiveTreeLayout(targetNodes, treeData, rawGraphRef.current);
      const fullTreePositions = treeData.treePositions || {};
      return { ...fullTreePositions, ...adaptivePositions };
    } else if (targetMode === 'pipeline') {
      const pipelineRes = computeTemporalPipelineLayout(targetNodes, rawGraphRef.current, { treeData });
      return pipelineRes.positions || {};
    }
    return {};
  }, [treeData]);

  // Auto Layout: Tree View, Left-to-Right Temporal Pipeline, & Equidistant Force-Directed Mesh
  const handleAutoLayout = useCallback(() => {
    let newPositions = {};
    if (layoutMode === 'mesh') {
      const meshRes = computeMeshForceLayout(displayNodes, rawGraphRef.current);
      newPositions = meshRes.positions || {};
      Object.assign(meshPositionsRef.current, newPositions);
    } else {
      newPositions = computePositionsForMode(layoutMode, displayNodes);
    }

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

    if (reactFlowInstanceRef.current) {
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 450 });
      }, 50);
    }
  }, [displayNodes, layoutMode, computePositionsForMode, setNodes]);

  // Dynamic Live Rearrangement: when dragging a node, push overlapping neighbors aside
  const handleNodeDragStop = useCallback((event, movedNode) => {
    if (!movedNode) return;
    const currentPositions = {};
    const nodeMap = {};
    nodes.forEach((n) => {
      currentPositions[n.id] = n.id === movedNode.id ? movedNode.position : n.position;
      nodeMap[n.id] = n.data || n;
    });

    const collisions = detectCollisions(currentPositions, nodeMap, 30, 30);
    const isMovedColliding = collisions.some((c) => c.idA === movedNode.id || c.idB === movedNode.id);

    let finalPositions = currentPositions;
    if (isMovedColliding) {
      const { positions: rearranged } = rearrangeNodes(currentPositions, nodeMap, movedNode.id, {
        paddingX: 45,
        paddingY: 40,
        maxIterations: 25
      });
      finalPositions = rearranged;
    }

    // Record all positions into meshPositionsRef (Mesh acts as custom freeform disposition)
    Object.entries(finalPositions).forEach(([id, pos]) => {
      meshPositionsRef.current[id] = pos;
    });

    // Seamlessly transition to 'mesh' mode (Option 1) if currently viewing Tree or Pipeline
    if (layoutMode !== 'mesh') {
      setLayoutMode('mesh');
    }

    setNodes((nds) =>
      nds.map((n) => {
        const newPos = finalPositions[n.id];
        if (newPos && (newPos.x !== n.position.x || newPos.y !== n.position.y)) {
          return {
            ...n,
            position: newPos,
            data: {
              ...n.data,
              canvasMeta: {
                ...n.data?.canvasMeta,
                position: newPos
              }
            }
          };
        }
        return n;
      })
    );
  }, [nodes, layoutMode, setNodes]);

  // Manual Trigger: Auto-Space & Pack Canvas
  const handleRearrangeAndPack = useCallback(() => {
    const currentPositions = {};
    const nodeMap = {};
    nodes.forEach((n) => {
      currentPositions[n.id] = n.position;
      nodeMap[n.id] = n.data || n;
    });

    const { positions: rearranged } = rearrangeNodes(currentPositions, nodeMap, null, {
      paddingX: 50,
      paddingY: 45,
      maxIterations: 35
    });

    Object.assign(meshPositionsRef.current, rearranged);

    setNodes((nds) =>
      nds.map((n) => {
        const newPos = rearranged[n.id];
        if (newPos) {
          return {
            ...n,
            position: newPos,
            data: {
              ...n.data,
              canvasMeta: {
                ...n.data?.canvasMeta,
                position: newPos
              }
            }
          };
        }
        return n;
      })
    );
  }, [nodes, setNodes]);

  // Save graph back to .saag/graph.json on disk
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const nodesMap = {};
      nodes.forEach((n) => {
        const posToSave = meshPositionsRef.current[n.id] || n.position;
        nodesMap[n.id] = {
          ...n.data,
          canvasMeta: {
            ...n.data.canvasMeta,
            position: posToSave,
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
    <div className="saag-app-layout">
      <LeftSidebar
        isOpen={isLeftSidebarOpen}
        onToggle={() => setIsLeftSidebarOpen((prev) => !prev)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={handleSwitchProject}
        currentDomain={currentDomain}
        onSwitchDomain={handleSwitchDomain}
        mlConstraintData={mlConstraintData}
        onOpenMlDiagnostics={() => {
          if (mlConstraintData) {
            alert(`🧠 ML Systems & Hardware Analysis:\n\n${mlConstraintData.summary}\n\nIssues (${mlConstraintData.issues.length}):\n${mlConstraintData.issues.map(i => `• [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`).join('\n') || 'All hardware and VRAM constraints satisfied.'}`);
          }
        }}
        isTreeNavigatorOpen={isTreeNavigatorOpen}
        onToggleTreeNavigator={() => setIsTreeNavigatorOpen((prev) => !prev)}
        onOpenSimulation={() => setIsSimModalOpen(true)}
        bottleneckCount={bottleneckData.bottlenecks?.length || 0}
        isBottleneckLensActive={isBottleneckLensActive}
        onToggleBottleneckLens={handleToggleBottleneckLens}
        onOpenBottlenecks={handleOpenBottlenecks}
        agentNodeCount={agentNodeIds.length}
        onOpenAgentContext={handleOpenAgentContext}
        onAutoLayout={handleAutoLayout}
        onRearrangeAndPack={handleRearrangeAndPack}
        onSave={handleSave}
        isSaving={isSaving}
        isConnected={isConnected}
        metadata={metadata}
      />

      <div className="saag-main-content">
        <Toolbar
          metadata={metadata}
          nodeCount={nodes.length}
          edgeCount={edges.length}
          onAutoLayout={handleAutoLayout}
          onRearrangeAndPack={handleRearrangeAndPack}
          onSave={handleSave}
          onOpenSimulation={() => setIsSimModalOpen(true)}
          isSaving={isSaving}
          isConnected={isConnected}
          agentNodeCount={agentNodeIds.length}
          isScopeIsolationActive={isScopeIsolationActive}
          onToggleScopeIsolation={() => setIsScopeIsolationActive((prev) => !prev)}
          onOpenAgentScope={handleOpenAgentContext}
          onOpenAgentContext={handleOpenAgentContext}
          onClearAgentContext={handleClearAgentContext}
          projects={projects}
          activeProjectId={activeProjectId}
          onSwitchProject={handleSwitchProject}
          abstractionLevel={abstractionLevel}
          onLevelChange={handleLevelChange}
          visibleNodeCount={displayNodes.length}
          totalNodeCount={nodes.length}
          bottleneckCount={bottleneckData.bottlenecks?.length || 0}
          isBottleneckLensActive={isBottleneckLensActive}
          onToggleBottleneckLens={handleToggleBottleneckLens}
          onOpenBottlenecks={handleOpenBottlenecks}
          layoutMode={layoutMode}
          onLayoutModeChange={(mode) => {
            setLayoutMode(mode);
            const newPositions = computePositionsForMode(mode, displayNodes);
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
            if (reactFlowInstanceRef.current) {
              setTimeout(() => {
                reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 450 });
              }, 50);
            }
          }}
          branches={treeData?.branches || []}
          activeBranchId={activeBranchId}
          onSelectBranch={setActiveBranchId}
          isTreeNavigatorOpen={isTreeNavigatorOpen}
          onToggleTreeNavigator={() => setIsTreeNavigatorOpen((prev) => !prev)}
          currentDomain={currentDomain}
          onSwitchDomain={handleSwitchDomain}
          mlConstraintData={mlConstraintData}
          onOpenMlDiagnostics={() => {
            if (mlConstraintData) {
              alert(`🧠 ML Systems & Hardware Analysis:\n\n${mlConstraintData.summary}\n\nIssues (${mlConstraintData.issues.length}):\n${mlConstraintData.issues.map(i => `• [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`).join('\n') || 'All hardware and VRAM constraints satisfied.'}`);
            }
          }}
          isLeftSidebarOpen={isLeftSidebarOpen}
          onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        <div className="saag-canvas-wrapper">
          {/* Floating Canvas Tab / Branch Switcher Filter Bar */}
          {layoutMode === 'tree' && treeData?.branches?.length > 0 && (
            <div className="canvas-tab-floating-bar glass-panel">
              <button
                className={`tab-pill ${activeBranchId === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setActiveBranchId('all');
                  setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 350 }), 50);
                }}
              >
                <span className="tab-pill-icon">🌐</span>
                <span>All Tabs ({treeData.branches.reduce((acc, b) => acc + b.nodes.length, 0)})</span>
              </button>
              {treeData.branches.map((b) => (
                <button
                  key={b.id}
                  className={`tab-pill ${activeBranchId === b.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveBranchId(b.id);
                    setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 350 }), 50);
                  }}
                >
                  <span className="tab-pill-icon">{b.icon || '📱'}</span>
                  <span>{b.title}</span>
                  <span className="tab-pill-count">{b.nodes.length}</span>
                </button>
              ))}
            </div>
          )}

          <ReactFlow
            onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onConnect={onConnect}
            onReconnect={onReconnect}
            isValidConnection={isValidConnection}
            edgesReconnectable={true}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onSelectionChange={handleSelectionChange}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="rgba(255, 255, 255, 0.08)" gap={24} size={1} />
            <Controls style={{ bottom: simulation ? 160 : 20, left: 20 }} />
            <MiniMap
              style={{
                bottom: simulation ? 160 : 20,
                right: selectedElement ? 390 : 20
              }}
              nodeColor={(n) => {
                if (n.data?.kind === 'hardware') return '#34d399';
                if (n.data?.kind === 'model') return '#ff375f';
                if (n.data?.kind === 'agent') return '#bf5af2';
                if (n.data?.kind === 'tool') return '#64d2ff';
                if (n.data?.kind === 'gate') return '#ff9f0a';
                if (n.data?.kind === 'view') return '#a855f7';
                if (n.data?.kind === 'viewModel') return '#0a84ff';
                if (n.data?.kind === 'service') return '#30d158';
                return '#f59e0b';
              }}
              maskColor="rgba(22, 22, 24, 0.78)"
            />
          </ReactFlow>

          {/* Floating Canvas Multi-Select Agent Scope Bar */}
          {selectedCanvasNodeIds.length >= 2 && (
            <div className="floating-scope-action-bar glass-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pulse-dot purple" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedCanvasNodeIds.length} Nodes Selected
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="btn-pill primary"
                  onClick={() => {
                    setAgentNodeIds(selectedCanvasNodeIds);
                    setIsScopeModalOpen(true);
                  }}
                  style={{ fontSize: '11px', gap: 4 }}
                  title="Form a new bounded AI Agent Scope with selected nodes"
                >
                  <span>🤖 Form Agent Scope</span>
                </button>
                <button
                  className="btn-pill"
                  onClick={() => {
                    setAgentNodeIds((prev) => Array.from(new Set([...prev, ...selectedCanvasNodeIds])));
                  }}
                  style={{ fontSize: '11px', gap: 4 }}
                  title="Add selected nodes to current active scope"
                >
                  <span>➕ Add to Scope</span>
                </button>
                <button
                  className="btn-pill"
                  onClick={() => setSelectedCanvasNodeIds([])}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  title="Dismiss selection"
                >
                  <span>✕</span>
                </button>
              </div>
            </div>
          )}

          {/* Real-Time Swift AST Hot-Reload Floating Toast */}
          {hotReloadToast && (
            <div className="hot-reload-toast glass-panel">
              <span className="pulse-dot green" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>⚡ Live AST Synced:</span>
              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {hotReloadToast.filename}
              </span>
            </div>
          )}
        </div>
      </div>

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
        onNavigateCrossReference={handleNavigateCrossReference}
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
        graph={rawGraph}
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
        taskObjective={taskObjective}
        onUpdateTaskObjective={setTaskObjective}
      />

      <BottleneckDrawer
        isOpen={isBottleneckDrawerOpen}
        onClose={() => setIsBottleneckDrawerOpen(false)}
        bottleneckData={bottleneckData}
        onApplyGraphRefactor={handleApplyGraphRefactor}
        onApplyCodebaseRefactor={handleApplyCodebaseRefactor}
        appliedRefactors={appliedRefactorIds}
      />

      <AppTreeNavigator
        isOpen={isTreeNavigatorOpen}
        onClose={() => setIsTreeNavigatorOpen(false)}
        treeData={treeData}
        selectedNodeId={selectedElement?.data?.id}
        onSelectNode={handleSelectTreeNode}
        activeBranchId={activeBranchId}
        onSelectBranch={setActiveBranchId}
      />
    </div>
  );
}
