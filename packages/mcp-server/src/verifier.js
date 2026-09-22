/**
 * SaaG Architectural Verifier & CI/CD Linter
 * 
 * Audits architecture graphs and code modifications against:
 * 1. Clean Architecture layer separation (e.g. View bypassing ViewModel)
 * 2. Circular dependencies and retain cycle risks
 * 3. Reactive state blast-radius fan-outs
 * 4. ML hardware constraints (VRAM OOM, PCIe interconnect, data starvation)
 * 5. Agent scope boundaries and frozen socket contracts
 */

import { calculateModelMemoryFootprint } from '../../canvas-ui/src/analysis/mlConstraintEngine.js';
import { isSystemDesignNode } from '../../canvas-ui/src/analysis/treeEngine.js';

export const VIOLATION_TYPES = {
  LAYER_SEPARATION: 'LAYER_SEPARATION',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  RETAIN_CYCLE_RISK: 'RETAIN_CYCLE_RISK',
  BLAST_RADIUS_EXCEEDED: 'BLAST_RADIUS_EXCEEDED',
  ML_CUDA_OOM: 'ML_CUDA_OOM',
  ML_INTERCONNECT_BOTTLENECK: 'ML_INTERCONNECT_BOTTLENECK',
  ML_DATA_STARVATION: 'ML_DATA_STARVATION',
  AGENT_SCOPE_VIOLATION: 'AGENT_SCOPE_VIOLATION'
};

/**
 * Runs full architectural audit against a graph object.
 * 
 * @param {Object} graph SaaG graph schema IR
 * @param {Object} options Configuration options
 * @returns {Object} { passed: boolean, totalIssues: number, errors: [...], warnings: [...] }
 */
export function verifyGraph(graph, options = {}) {
  const {
    maxBlastRadius = 5,
    enforceLayerSeparation = true,
    checkCycles = true,
    checkMlHardware = true,
    modifiedFiles = [],
    activeScope = null,
    systemDesignOnly = true
  } = options;

  const errors = [];
  const warnings = [];

  if (!graph || !graph.nodes) {
    errors.push({
      type: 'INVALID_GRAPH',
      severity: 'error',
      message: 'The provided graph object is empty or contains no nodes.',
      nodeId: null
    });
    return { passed: false, totalIssues: 1, errors, warnings };
  }

  const nodes = graph.nodes;
  const edges = Object.values(graph.edges || {});

  // --------------------------------------------------------------------------
  // 1. CLEAN ARCHITECTURE LAYER SEPARATION
  // --------------------------------------------------------------------------
  if (enforceLayerSeparation) {
    edges.forEach((edge) => {
      const source = nodes[edge.sourceNodeId];
      const target = nodes[edge.targetNodeId];
      if (!source || !target) return;

      // Filter non-system design nodes if requested
      if (systemDesignOnly && (!isSystemDesignNode(source) || !isSystemDesignNode(target))) {
        return;
      }

      // Rule A: Self Loop
      if (edge.sourceNodeId === edge.targetNodeId) {
        errors.push({
          type: VIOLATION_TYPES.LAYER_SEPARATION,
          severity: 'error',
          rule: 'RULE_NO_SELF_LOOPS',
          message: `Self-connection detected on node "${source.name}". A component cannot connect to its own socket.`,
          edgeId: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId
        });
      }

      // Rule B: View directly calling Repository/Database (bypassing ViewModel)
      if (source.kind === 'view' && (target.kind === 'repository' || target.kind === 'database')) {
        errors.push({
          type: VIOLATION_TYPES.LAYER_SEPARATION,
          severity: 'error',
          rule: 'RULE_VIEW_CANNOT_BYPASS_VIEWMODEL',
          message: `Layer Violation: View "${source.name}" connects directly to Repository "${target.name}". UI Views must mediate through a ViewModel.`,
          edgeId: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId
        });
      }

      // Rule C: Service directly driving View
      // Note: App root containers (e.g. LandmarksApp, App struct) instantiate root views via WindowGroup; this is standard SwiftUI
      const isAppRoot = source.name?.endsWith('App') || source.kind === 'app';
      if (!isAppRoot && (source.kind === 'service' || source.kind === 'repository') && target.kind === 'view') {
        errors.push({
          type: VIOLATION_TYPES.LAYER_SEPARATION,
          severity: 'error',
          rule: 'RULE_SERVICE_CANNOT_DRIVE_VIEW_DIRECTLY',
          message: `Layer Violation: Service "${source.name}" drives View "${target.name}" directly. Services must notify ViewModels or State Stores.`,
          edgeId: edge.id,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. CIRCULAR DEPENDENCY & RETAIN CYCLE ANALYSIS
  // --------------------------------------------------------------------------
  if (checkCycles) {
    // Build adjacency list for procedural call edges among system design nodes
    // Exclude state bindings and parent-child containment edges (which are reactive/structural, not procedural execution loops)
    const adj = new Map();
    Object.keys(nodes).forEach((id) => {
      if (!systemDesignOnly || isSystemDesignNode(nodes[id])) {
        adj.set(id, []);
      }
    });

    edges.forEach((edge) => {
      if (
        edge.sourceNodeId &&
        edge.targetNodeId &&
        edge.sourceNodeId !== edge.targetNodeId &&
        adj.has(edge.sourceNodeId) &&
        adj.has(edge.targetNodeId)
      ) {
        // Only consider synchronous procedural call or dependency edges
        const isReactiveBinding =
          edge.edgeKind === 'stateBinding' ||
          edge.edgeKind === 'stateSubscription' ||
          edge.edgeKind === 'contains' ||
          edge.edgeKind === 'feedback' ||
          (edge.executionMode === 'async' && (edge.edgeKind === 'messagePassing' || edge.edgeKind === 'eventEmit'));

        const sourceNode = nodes[edge.sourceNodeId];
        const targetNode = nodes[edge.targetNodeId];

        // Bi-directional state communication between a View and its bound ViewModel is expected and reactive
        const isViewStorePair =
          (sourceNode?.kind === 'view' && targetNode?.kind === 'viewModel') ||
          (sourceNode?.kind === 'viewModel' && targetNode?.kind === 'view');

        if (!isReactiveBinding && !isViewStorePair) {
          adj.get(edge.sourceNodeId).push(edge.targetNodeId);
        }
      }
    });

    // Detect cycles using DFS with recursion stack
    const visited = new Set();
    const recursionStack = new Set();
    const detectedCycles = [];

    function dfs(nodeId, path) {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStartIdx = path.indexOf(neighbor);
          const cycle = path.slice(cycleStartIdx).concat(neighbor);
          detectedCycles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    }

    adj.keys().forEach((id) => {
      if (!visited.has(id)) {
        dfs(id, []);
      }
    });

    if (detectedCycles.length > 0) {
      const seen = new Set();
      detectedCycles.forEach((cycle) => {
        const sig = cycle.join('->');
        if (!seen.has(sig)) {
          seen.add(sig);
          const readable = cycle.map((id) => nodes[id]?.name || id).join(' ➔ ');
          errors.push({
            type: VIOLATION_TYPES.CIRCULAR_DEPENDENCY,
            severity: 'error',
            message: `Circular dependency detected in execution graph: ${readable}`,
            cycleNodeIds: cycle
          });
        }
      });
    }

    // Node-level retain cycle flags (from Swift AST RetainCycleDetector)
    Object.values(nodes).forEach((node) => {
      if (node.diagnostics?.retainCycleRisk) {
        warnings.push({
          type: VIOLATION_TYPES.RETAIN_CYCLE_RISK,
          severity: 'warning',
          nodeId: node.id,
          nodeName: node.name,
          message: `Retain Cycle Risk in "${node.name}": ${node.diagnostics.retainCycleRisk.reason || 'Escaping closure captures self without [weak self]'}.`
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. STATE BLAST RADIUS ANALYSIS
  // --------------------------------------------------------------------------
  Object.values(nodes).forEach((node) => {
    if (node.kind === 'viewModel' || node.name.includes('Store') || node.name.includes('ModelData')) {
      const directBoundViews = new Set();

      edges.forEach((edge) => {
        if (edge.sourceNodeId === node.id && (edge.edgeKind === 'stateBinding' || edge.contract?.payloadType?.includes('State'))) {
          directBoundViews.add(edge.targetNodeId);
        }
        if (edge.targetNodeId === node.id && (edge.edgeKind === 'eventEmit' || edge.edgeKind === 'call')) {
          if (nodes[edge.sourceNodeId]?.kind === 'view') {
            directBoundViews.add(edge.sourceNodeId);
          }
        }
      });

      // Count child views inheriting state
      const totalFanoutViews = new Set(directBoundViews);
      directBoundViews.forEach((viewId) => {
        const view = nodes[viewId];
        if (view?.childNodeIds) {
          view.childNodeIds.forEach((cId) => totalFanoutViews.add(cId));
        }
      });

      if (totalFanoutViews.size > maxBlastRadius) {
        warnings.push({
          type: VIOLATION_TYPES.BLAST_RADIUS_EXCEEDED,
          severity: 'warning',
          nodeId: node.id,
          nodeName: node.name,
          fanoutCount: totalFanoutViews.size,
          threshold: maxBlastRadius,
          message: `State Blast Radius Warning: "${node.name}" invalidates ${totalFanoutViews.size} downstream views (budget: ${maxBlastRadius}). Consider splitting into domain slices.`
        });
      }
    }
  });

  // --------------------------------------------------------------------------
  // 4. ML HARDWARE & INTERCONNECT CONSTRAINTS
  // --------------------------------------------------------------------------
  if (checkMlHardware && (graph.domain === 'ml' || graph.projectName?.includes('ML'))) {
    const modelNode = Object.values(nodes).find((n) => n.kind === 'model' || n.kind === 'llm');
    const gpuNode = Object.values(nodes).find((n) => n.kind === 'hardware' || n.kind === 'gpu');
    const adapterNode = Object.values(nodes).find((n) => n.kind === 'adapter' || n.kind === 'lora');
    const optimizerNode = Object.values(nodes).find((n) => n.kind === 'optimizer');
    const preprocNode = Object.values(nodes).find((n) => n.kind === 'preprocessor');

    if (modelNode && gpuNode) {
      const gpuMeta = gpuNode.mlMeta || {};
      const numGpus = gpuMeta.deviceCount || 1;
      const vramPerGpuGb = gpuMeta.vramPerDeviceGb || 80.0;
      const totalClusterVramGb = numGpus * vramPerGpuGb;

      const mem = calculateModelMemoryFootprint(modelNode, adapterNode, optimizerNode);

      if (mem.totalVramGb > totalClusterVramGb) {
        errors.push({
          type: VIOLATION_TYPES.ML_CUDA_OOM,
          severity: 'error',
          modelNodeId: modelNode.id,
          gpuNodeId: gpuNode.id,
          requiredVramGb: Number(mem.totalVramGb.toFixed(1)),
          availableVramGb: totalClusterVramGb,
          message: `Predicted CUDA OOM: Model requires ${mem.totalVramGb.toFixed(1)} GB VRAM but cluster only provides ${totalClusterVramGb} GB VRAM.`
        });
      }

      // Check Interconnect
      const interconnect = (gpuMeta.interconnect || 'NVLink').toUpperCase();
      if (numGpus > 1 && interconnect.includes('PCIE')) {
        warnings.push({
          type: VIOLATION_TYPES.ML_INTERCONNECT_BOTTLENECK,
          severity: 'warning',
          message: `Hardware Interconnect Bottleneck: Multi-GPU cluster (${numGpus} GPUs) is connected via PCIe instead of NVLink.`
        });
      }

      // Check Data Pipeline
      if (preprocNode) {
        const engine = (preprocNode.mlMeta?.processingEngine || '').toLowerCase();
        if (engine.includes('pandas') && numGpus >= 4) {
          warnings.push({
            type: VIOLATION_TYPES.ML_DATA_STARVATION,
            severity: 'warning',
            message: `Data Starvation Warning: CPU Pandas preprocessor will choke high-throughput GPU cluster. Recommend cuDF.`
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. AGENT SCOPE CONTRACT VALIDATION
  // --------------------------------------------------------------------------
  const scope = activeScope || graph.activeWorkspace;
  if (scope && scope.allowedFilePaths && modifiedFiles.length > 0) {
    const allowed = new Set(scope.allowedFilePaths.map((p) => p.toLowerCase()));
    modifiedFiles.forEach((file) => {
      const norm = file.toLowerCase();
      const isPermitted = Array.from(allowed).some((allow) => norm.endsWith(allow) || norm.includes(allow));
      if (!isPermitted) {
        errors.push({
          type: VIOLATION_TYPES.AGENT_SCOPE_VIOLATION,
          severity: 'error',
          file,
          message: `Agent Scope Violation: Modification of out-of-scope file "${file}" is forbidden by active workspace lock.`
        });
      }
    });
  }

  const passed = errors.length === 0;
  const totalIssues = errors.length + warnings.length;

  return {
    passed,
    totalIssues,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
      nodeCount: Object.keys(nodes).length,
      edgeCount: edges.length
    }
  };
}

/**
 * Formats a terminal-friendly report with ANSI styling.
 */
export function formatTerminalReport(result, projectName = 'Software System') {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push(`  SaaG Architectural Verification Report: ${projectName}`);
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  if (result.passed && result.warnings.length === 0) {
    lines.push('  ✅ ARCHITECTURE VERIFIED: Zero layer violations, retain cycles, or bottlenecks.');
    lines.push(`     Nodes Analyzed: ${result.summary.nodeCount} | Edges Checked: ${result.summary.edgeCount}`);
    lines.push('');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`  ❌ ERRORS (${result.errors.length}):`);
    result.errors.forEach((err, idx) => {
      lines.push(`     ${idx + 1}. [${err.type}] ${err.message}`);
    });
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push(`  ⚠️  WARNINGS (${result.warnings.length}):`);
    result.warnings.forEach((warn, idx) => {
      lines.push(`     ${idx + 1}. [${warn.type}] ${warn.message}`);
    });
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push(
    `  STATUS: ${result.passed ? 'PASSED WITH WARNINGS' : 'FAILED'} (Errors: ${result.summary.errorCount}, Warnings: ${result.summary.warningCount})`
  );
  lines.push('═══════════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Formats a GitHub Markdown comment for PR bot integration.
 */
export function formatMarkdownReport(result, projectName = 'Software System') {
  const lines = [];
  lines.push(`## 🏛️ SaaG Architectural Verification: ${projectName}`);
  lines.push('');

  if (result.passed && result.warnings.length === 0) {
    lines.push('> **Status: PASSED ✅** — Clean Architecture guardrails, memory cycles, and contracts verified with zero issues.');
    lines.push('');
    lines.push(`- **Nodes Checked**: ${result.summary.nodeCount}`);
    lines.push(`- **Edges Checked**: ${result.summary.edgeCount}`);
    return lines.join('\n');
  }

  lines.push(`> **Status: ${result.passed ? '⚠️ PASSED WITH WARNINGS' : '❌ REJECTED WITH ARCHITECTURAL VIOLATIONS'}**`);
  lines.push('');
  lines.push(`| Severity | Type | Description |`);
  lines.push(`| :--- | :--- | :--- |`);

  result.errors.forEach((e) => {
    lines.push(`| ❌ **Error** | \`${e.type}\` | ${e.message} |`);
  });

  result.warnings.forEach((w) => {
    lines.push(`| ⚠️ **Warning** | \`${w.type}\` | ${w.message} |`);
  });

  lines.push('');
  lines.push(`*Verified by [Software as a Graph (SaaG)](https://github.com/saag) at ${new Date().toISOString()}*`);

  return lines.join('\n');
}
