import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const allowedRoots = [
  repoRoot,
  os.tmpdir(),
  fs.existsSync(os.tmpdir()) ? fs.realpathSync(os.tmpdir()) : os.tmpdir(),
  process.cwd()
];

/**
 * Validate that a target path is strictly contained within allowed directories.
 * Prevents directory traversal attacks (e.g. ../../etc/passwd).
 */
function validateSafePath(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Invalid path provided');
  }
  if (targetPath.indexOf('\0') !== -1) {
    throw new Error('Null byte detected in path');
  }
  const resolved = path.resolve(targetPath);
  const isAllowed = allowedRoots.some((root) => {
    const rootResolved = path.resolve(root);
    const rel = path.relative(rootResolved, resolved);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });
  if (!isAllowed) {
    throw new Error(`Access denied: path "${targetPath}" is outside allowed repository root`);
  }
  return resolved;
}

/**
 * Atomic file writer. Writes to a temporary file first, then synchronously
 * renames it onto the target file. Guarantees 0-byte corruption never occurs
 * if the process is killed or interrupted mid-write.
 */
let lastInternalWriteTime = 0;

function safeWriteFileAtomic(targetPath, data) {
  lastInternalWriteTime = Date.now();
  const resolved = path.resolve(targetPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${resolved}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    fs.writeFileSync(tempPath, data, 'utf8');
    fs.renameSync(tempPath, resolved);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
    throw err;
  }
}

// Project Registry for Live Switching & Benchmarks
const KNOWN_PROJECTS = [
  {
    id: 'authsample',
    name: 'AuthSample (SwiftUI + Firebase)',
    projectType: 'ios',
    path: path.resolve(__dirname, '../../examples/ios-auth-sample/.saag/graph.json'),
    sourceDir: path.resolve(__dirname, '../../examples/ios-auth-sample'),
    description: 'Clean Architecture MVVM sample with Firebase & Keychain'
  },
  {
    id: 'makeitso',
    name: 'MakeItSo (Firebase Tasks App)',
    projectType: 'ios',
    path: path.resolve(__dirname, '../../benchmarks/makeitso-graph.json'),
    sourceDir: path.resolve(__dirname, '../../benchmarks/MakeItSo'),
    description: 'Full-featured Firebase Auth & Firestore CRUD by Peter Friese'
  },
  {
    id: 'landmarks',
    name: 'Landmarks (Apple Official Sample)',
    projectType: 'ios',
    path: path.resolve(__dirname, '../../benchmarks/landmarks-graph.json'),
    sourceDir: path.resolve(__dirname, '../../benchmarks/Landmarks'),
    description: "Apple's flagship multi-screen SwiftUI tutorial application"
  },
  {
    id: 'agent_orchestrator',
    name: 'Agent Orchestrator (Multi-Agent System)',
    projectType: 'agents',
    path: path.resolve(__dirname, '../../benchmarks/agent-orchestrator-graph.json'),
    sourceDir: path.resolve(__dirname, '../../benchmarks/Agents'),
    description: 'Autonomous multi-agent coordinator with code writer and human-in-the-loop gate'
  },
  {
    id: 'ml_pipeline',
    name: 'Llama-3 Fine-Tuning & H100 GPU Cluster',
    projectType: 'ml',
    path: path.resolve(__dirname, '../../benchmarks/ml-pipeline-graph.json'),
    sourceDir: path.resolve(__dirname, '../../benchmarks/ML'),
    description: 'PyTorch + cuDF + LoRA model creation pipeline targeting 8x NVIDIA H100 with NVLink'
  }
];

const initialProject = KNOWN_PROJECTS.find((p) => p.id === 'landmarks') || KNOWN_PROJECTS[0];
let activeProjectId = initialProject.id;
let graphPath = initialProject.path;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--graph' && args[i + 1]) {
    graphPath = path.resolve(process.cwd(), args[i + 1]);
    activeProjectId = 'custom';
  }
}

console.log(`📡 SaaG Bridge Daemon`);
console.log(`📁 Target Graph: ${graphPath}`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built assets if dist exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }));
}

// REST: List Projects
app.get('/api/projects', (req, res) => {
  const projects = KNOWN_PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    projectType: p.projectType || 'ios',
    description: p.description,
    exists: fs.existsSync(p.path),
    isActive: p.id === activeProjectId
  }));
  res.json({ activeProjectId, projects });
});

// REST: Resolve Cross-Project Reference (saag://<projectType>/<projectId>/<nodeId>)
app.get('/api/projects/resolve-ref', (req, res) => {
  try {
    const { uri } = req.query;
    if (!uri || !uri.startsWith('saag://')) {
      return res.status(400).json({ error: 'Invalid URI format, expected saag://<projectType>/<projectId>/<nodeId>' });
    }
    const cleanUri = uri.replace('saag://', '');
    const parts = cleanUri.split('/');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'Malformed saag URI' });
    }
    const [targetType, targetProjectId, targetNodeId] = parts;
    const project = KNOWN_PROJECTS.find((p) => p.id === targetProjectId);
    if (!project || !fs.existsSync(project.path)) {
      return res.status(404).json({ error: 'Target project not found' });
    }
    const graph = JSON.parse(fs.readFileSync(project.path, 'utf8'));
    const targetNode = graph.nodes?.[targetNodeId];
    if (!targetNode) {
      return res.status(404).json({ error: 'Target node not found in project' });
    }
    res.json({
      success: true,
      uri,
      targetType,
      targetProjectId,
      targetProjectName: project.name,
      node: targetNode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST: Switch Active Project
app.post('/api/projects/switch', (req, res) => {
  try {
    const { projectId } = req.body;
    const project = KNOWN_PROJECTS.find((p) => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!fs.existsSync(project.path)) {
      return res.status(404).json({ error: 'Graph file does not exist', path: project.path });
    }

    activeProjectId = project.id;
    graphPath = project.path;
    console.log(`📁 Switched active project to: ${project.name} (${graphPath})`);

    if (process.env.NODE_ENV !== 'test') {
      setupFileWatcher();
      setupSwiftFileWatcher();
    }

    const content = fs.readFileSync(graphPath, 'utf8');
    const json = JSON.parse(content);
    broadcastGraph(json);
    res.json({ success: true, activeProjectId, project, graph: json });
  } catch (err) {
    console.error('Error switching project:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Get Graph
app.get('/api/graph', (req, res) => {
  try {
    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({ error: 'Graph file not found', path: graphPath });
    }
    const content = fs.readFileSync(graphPath, 'utf8');
    const json = JSON.parse(content);
    res.json(json);
  } catch (err) {
    console.error('Error reading graph:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Save Graph
app.post('/api/graph', (req, res) => {
  try {
    const updatedGraph = req.body;
    const requestedTarget = req.body?.targetPath || req.query?.targetPath || graphPath;
    const targetFile = validateSafePath(requestedTarget);

    const formatted = JSON.stringify(updatedGraph, null, 2);
    safeWriteFileAtomic(targetFile, formatted);
    console.log(`💾 Graph saved successfully (${Object.keys(updatedGraph.nodes || {}).length} nodes) to ${targetFile}`);

    if (targetFile === graphPath) {
      broadcastGraph(updatedGraph);
    }
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error saving graph:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Update Node Position (Relaxed Freeform Drag Coordinates)
app.post('/api/graph/node-position', (req, res) => {
  try {
    const { nodeId, position } = req.body;
    if (!nodeId || !position) {
      return res.status(400).json({ error: 'Missing nodeId or position' });
    }
    if (fs.existsSync(graphPath)) {
      const raw = fs.readFileSync(graphPath, 'utf8');
      const g = JSON.parse(raw);
      if (g.nodes && g.nodes[nodeId]) {
        g.nodes[nodeId].position = position;
        if (!g.nodes[nodeId].canvasMeta) g.nodes[nodeId].canvasMeta = {};
        g.nodes[nodeId].canvasMeta.position = position;
        safeWriteFileAtomic(graphPath, JSON.stringify(g, null, 2));
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update node position:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Delete Single Node and Connected Edges
app.delete('/api/graph/node/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    if (!nodeId) return res.status(400).json({ error: 'Missing nodeId parameter' });

    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({ error: 'Graph file not found' });
    }

    const raw = fs.readFileSync(graphPath, 'utf8');
    const updatedGraph = JSON.parse(raw);
    if (!updatedGraph.nodes) updatedGraph.nodes = {};
    if (!updatedGraph.edges) updatedGraph.edges = {};

    const nodeExists = Boolean(updatedGraph.nodes[nodeId]);
    delete updatedGraph.nodes[nodeId];

    // Remove any connected edges
    let removedEdgesCount = 0;
    Object.keys(updatedGraph.edges).forEach((edgeId) => {
      const edge = updatedGraph.edges[edgeId];
      if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId ||
          edge.source === nodeId || edge.target === nodeId) {
        delete updatedGraph.edges[edgeId];
        removedEdgesCount++;
      }
    });

    safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
    console.log(`🗑️ Deleted node "${nodeId}" and ${removedEdgesCount} associated edges from ${graphPath}`);

    broadcastGraph(updatedGraph, {
      source: 'NODE_DELETED',
      nodeId,
      removedEdgesCount
    });

    res.json({
      success: true,
      nodeId,
      nodeExisted: nodeExists,
      removedEdgesCount,
      remainingNodes: Object.keys(updatedGraph.nodes).length
    });
  } catch (err) {
    console.error('Error deleting node:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Batch Delete Nodes and Edges
app.post('/api/graph/delete-elements', (req, res) => {
  try {
    const { nodeIds = [], edgeIds = [] } = req.body;
    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({ error: 'Graph file not found' });
    }

    const raw = fs.readFileSync(graphPath, 'utf8');
    const updatedGraph = JSON.parse(raw);
    if (!updatedGraph.nodes) updatedGraph.nodes = {};
    if (!updatedGraph.edges) updatedGraph.edges = {};

    const targetNodeIds = new Set(nodeIds);
    const targetEdgeIds = new Set(edgeIds);

    targetNodeIds.forEach((id) => {
      delete updatedGraph.nodes[id];
    });

    Object.keys(updatedGraph.edges).forEach((eid) => {
      const edge = updatedGraph.edges[eid];
      if (targetEdgeIds.has(eid) ||
          targetNodeIds.has(edge.sourceNodeId) || targetNodeIds.has(edge.targetNodeId) ||
          targetNodeIds.has(edge.source) || targetNodeIds.has(edge.target)) {
        delete updatedGraph.edges[eid];
      }
    });

    safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
    console.log(`🗑️ Batch deleted ${targetNodeIds.size} nodes and ${targetEdgeIds.size} edges from ${graphPath}`);

    broadcastGraph(updatedGraph, {
      source: 'BATCH_DELETE',
      deletedNodeCount: targetNodeIds.size,
      deletedEdgeCount: targetEdgeIds.size
    });

    res.json({
      success: true,
      deletedNodeCount: targetNodeIds.size,
      remainingNodes: Object.keys(updatedGraph.nodes).length
    });
  } catch (err) {
    console.error('Error batch deleting elements:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Delete Single Edge
app.delete('/api/graph/edge/:edgeId', (req, res) => {
  try {
    const { edgeId } = req.params;
    if (!edgeId) return res.status(400).json({ error: 'Missing edgeId parameter' });

    if (!fs.existsSync(graphPath)) {
      return res.status(404).json({ error: 'Graph file not found' });
    }

    const raw = fs.readFileSync(graphPath, 'utf8');
    const updatedGraph = JSON.parse(raw);
    if (!updatedGraph.edges) updatedGraph.edges = {};

    delete updatedGraph.edges[edgeId];

    safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
    console.log(`🗑️ Deleted edge "${edgeId}" from ${graphPath}`);

    broadcastGraph(updatedGraph, {
      source: 'EDGE_DELETED',
      edgeId
    });

    res.json({ success: true, edgeId });
  } catch (err) {
    console.error('Error deleting edge:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Scaffold Blueprint & Materialize Starter Code Files
app.post('/api/scaffold-blueprint', (req, res) => {
  try {
    const { blueprintId, files = [], newNodes = [], newEdges = [], scaffoldCode = true } = req.body;
    if (!blueprintId) {
      return res.status(400).json({ error: 'Missing blueprintId' });
    }

    const currentProject = KNOWN_PROJECTS.find((p) => p.id === activeProjectId);
    const baseDir = currentProject?.sourceDir || path.dirname(graphPath);
    const scaffoldedFiles = [];

    // 1. Scaffold starter code files if enabled
    if (scaffoldCode && Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        if (!file.filePath || !file.content) continue;

        let fullPath;
        if (path.isAbsolute(file.filePath)) {
          fullPath = file.filePath;
        } else if (activeProjectId === 'landmarks') {
          fullPath = path.resolve(__dirname, '../../benchmarks/Landmarks/Landmarks', file.filePath);
        } else if (activeProjectId === 'makeitso') {
          fullPath = path.resolve(__dirname, '../../benchmarks/MakeItSo/code/frontend/MakeItSo', file.filePath);
        } else if (activeProjectId === 'authsample') {
          fullPath = path.resolve(__dirname, '../../examples/ios-auth-sample/Sources', file.filePath);
        } else if (activeProjectId === 'ml_pipeline') {
          fullPath = path.resolve(__dirname, '../../benchmarks/ML', path.basename(file.filePath));
        } else if (activeProjectId === 'agent_orchestrator') {
          fullPath = path.resolve(__dirname, '../../benchmarks/Agents', path.basename(file.filePath));
        } else {
          fullPath = path.resolve(baseDir, file.filePath);
        }

        const safePath = validateSafePath(fullPath);
        safeWriteFileAtomic(safePath, file.content);
        scaffoldedFiles.push({
          filePath: file.filePath,
          fullPath: safePath,
          sizeBytes: Buffer.byteLength(file.content, 'utf8')
        });
        console.log(`📦 Blueprint scaffolded file: ${safePath}`);
      }
    }

    // 2. Persist new nodes and edges into active graph
    let updatedGraph = null;
    if (fs.existsSync(graphPath)) {
      const raw = fs.readFileSync(graphPath, 'utf8');
      updatedGraph = JSON.parse(raw);
      if (!updatedGraph.nodes) updatedGraph.nodes = {};
      if (!updatedGraph.edges) updatedGraph.edges = {};

      newNodes.forEach((node) => {
        const nodeData = node.data || node;
        const pos = node.position || { x: 200, y: 200 };
        updatedGraph.nodes[node.id] = {
          ...nodeData,
          id: node.id,
          position: pos,
          canvasMeta: {
            ...(nodeData.canvasMeta || {}),
            position: pos
          }
        };
      });

      newEdges.forEach((edge) => {
        const edgeId = edge.id || `edge_${edge.source}_to_${edge.target}`;
        updatedGraph.edges[edgeId] = {
          id: edgeId,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          edgeKind: edge.data?.edgeKind || edge.edgeKind || 'dataflow',
          contract: edge.data?.contract || edge.contract || null,
          label: edge.label || null
        };
      });

      safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
      console.log(`💾 Blueprint saved ${newNodes.length} nodes and ${newEdges.length} edges to ${graphPath}`);
      broadcastGraph(updatedGraph, {
        source: 'BLUEPRINT_SCAFFOLD',
        blueprintId,
        scaffoldedFilesCount: scaffoldedFiles.length
      });
    }

    res.json({
      success: true,
      blueprintId,
      scaffoldedFiles,
      nodesAdded: newNodes.length,
      edgesAdded: newEdges.length,
      graph: updatedGraph
    });
  } catch (err) {
    console.error('Error scaffolding blueprint:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Save Generated Swift Test
app.post('/api/save-test', (req, res) => {
  try {
    const { code, targetPath: customTarget } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing test code' });

    let targetPath = customTarget;
    if (!targetPath) {
      if (activeProjectId === 'landmarks') {
        targetPath = path.resolve(__dirname, '../../benchmarks/Landmarks/LandmarksTests/GeneratedDataflowTests.swift');
      } else if (activeProjectId === 'makeitso') {
        targetPath = path.resolve(__dirname, '../../benchmarks/MakeItSo/code/frontend/MakeItSo/Shared/GeneratedDataflowTests.swift');
      } else {
        targetPath = path.resolve(__dirname, '../../examples/ios-auth-sample/Tests/AuthSampleTests/GeneratedDataflowTests.swift');
      }
    } else if (!path.isAbsolute(targetPath)) {
      targetPath = path.resolve(__dirname, '../..', targetPath);
    }

    const safeTarget = validateSafePath(targetPath);
    safeWriteFileAtomic(safeTarget, code);
    console.log(`💾 Swift Test written successfully to: ${safeTarget}`);
    res.json({ success: true, path: safeTarget });
  } catch (err) {
    console.error('Error writing test:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Apply Architectural Refactoring & Sync Swift Codebase
app.post('/api/apply-refactor', (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'Missing refactoring plan' });

    const currentProject = KNOWN_PROJECTS.find((p) => p.id === activeProjectId);
    const sourceDir = plan.baseDir || currentProject?.sourceDir || path.dirname(graphPath);

    const writtenFiles = [];
    if (plan.swiftChanges && Array.isArray(plan.swiftChanges)) {
      for (const change of plan.swiftChanges) {
        if (!change.filePath) continue;

        let rawTarget = path.isAbsolute(change.filePath)
          ? change.filePath
          : path.resolve(sourceDir, change.filePath);

        const targetFilePath = validateSafePath(rawTarget);

        if (change.action === 'delete') {
          if (fs.existsSync(targetFilePath)) {
            fs.unlinkSync(targetFilePath);
            console.log(`🗑️ Refactor deleted: ${targetFilePath}`);
            writtenFiles.push({
              filePath: change.filePath,
              fullPath: targetFilePath,
              action: 'delete'
            });
          }
          continue;
        }

        if (!change.code) continue;

        safeWriteFileAtomic(targetFilePath, change.code);
        console.log(`📝 Refactor wrote ${change.action}: ${targetFilePath}`);
        writtenFiles.push({
          filePath: change.filePath,
          fullPath: targetFilePath,
          action: change.action
        });
      }
    }

    // Update graph on disk if architectural changes are specified
    let updatedGraph = null;
    if (fs.existsSync(graphPath)) {
      try {
        const raw = fs.readFileSync(graphPath, 'utf8');
        updatedGraph = JSON.parse(raw);

        if (plan.architecturalChanges) {
          const { newNodes, removeEdges, addEdges } = plan.architecturalChanges;
          if (newNodes && Array.isArray(newNodes)) {
            newNodes.forEach((node) => {
              updatedGraph.nodes[node.id] = node;
            });
          }
          if (removeEdges && Array.isArray(removeEdges)) {
            removeEdges.forEach((edgeId) => {
              delete updatedGraph.edges[edgeId];
            });
          }
          if (addEdges && Array.isArray(addEdges)) {
            addEdges.forEach((edge) => {
              updatedGraph.edges[edge.id] = edge;
            });
          }

          safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
          console.log(`💾 Refactor updated graph architecture in ${graphPath}`);
          broadcastGraph(updatedGraph);
        }
      } catch (graphErr) {
        console.warn('Could not update graph JSON directly:', graphErr.message);
      }
    }

    res.json({
      success: true,
      planId: plan.id,
      writtenFiles,
      updatedGraph
    });
  } catch (err) {
    console.error('Error applying refactor:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Update View Element in Swift file & Graph
app.post('/api/update-view-element', (req, res) => {
  try {
    const { filePath, elementId, oldLabel, newLabel, lineSpan } = req.body;
    if (!filePath || !newLabel) {
      return res.status(400).json({ error: 'Missing required parameters: filePath, newLabel' });
    }

    let fullSourcePath = filePath;
    if (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      const currentProject = KNOWN_PROJECTS.find((p) => p.id === activeProjectId);
      const searchCandidates = [
        currentProject?.sourceDir ? path.resolve(currentProject.sourceDir, filePath) : null,
        currentProject?.sourceDir ? path.resolve(currentProject.sourceDir, 'Shared', filePath) : null,
        currentProject?.sourceDir ? path.resolve(currentProject.sourceDir, 'Landmarks', filePath) : null,
        path.resolve(__dirname, '../../benchmarks/Landmarks', filePath),
        path.resolve(__dirname, '../../benchmarks/Landmarks/Landmarks', filePath),
        path.resolve(__dirname, '../../benchmarks/MakeItSo/code/frontend/MakeItSo', filePath),
        path.resolve(__dirname, '../../benchmarks/MakeItSo/code/frontend/MakeItSo/Shared', filePath),
        path.resolve(__dirname, '../../examples/ios-auth-sample', filePath),
        path.resolve(__dirname, '../../examples/ios-auth-sample/Sources', filePath)
      ].filter(Boolean);

      const found = searchCandidates.find((c) => fs.existsSync(c));
      if (found) {
        fullSourcePath = found;
      } else if (currentProject?.sourceDir) {
        fullSourcePath = path.resolve(currentProject.sourceDir, filePath);
      }
    }

    if (!fs.existsSync(fullSourcePath)) {
      return res.status(404).json({ error: `Source file not found at: ${fullSourcePath}` });
    }
    const safeSourcePath = validateSafePath(fullSourcePath);

    let sourceContent = fs.readFileSync(safeSourcePath, 'utf8');
    const sourceLines = sourceContent.split('\n');

    let updated = false;
    const startLine = lineSpan?.startLine ? lineSpan.startLine - 1 : 0;
    const endLine = lineSpan?.endLine ? lineSpan.endLine : sourceLines.length;

    for (let i = startLine; i < Math.min(endLine, sourceLines.length); i++) {
      if (oldLabel && sourceLines[i].includes(`"${oldLabel}"`)) {
        sourceLines[i] = sourceLines[i].replace(`"${oldLabel}"`, `"${newLabel}"`);
        updated = true;
        break;
      }
    }

    if (!updated && oldLabel && sourceContent.includes(`"${oldLabel}"`)) {
      sourceContent = sourceContent.replace(`"${oldLabel}"`, `"${newLabel}"`);
      updated = true;
    } else if (updated) {
      sourceContent = sourceLines.join('\n');
    }

    if (updated) {
      safeWriteFileAtomic(safeSourcePath, sourceContent);
      console.log(`📝 Reconciled ${safeSourcePath}: replaced "${oldLabel}" with "${newLabel}"`);

      if (fs.existsSync(graphPath)) {
        const rawGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
        Object.values(rawGraph.nodes || {}).forEach(n => {
          if (n.viewElements) {
            n.viewElements = n.viewElements.map(el => {
              if (el.id === elementId || el.label === oldLabel) {
                return { ...el, label: newLabel };
              }
              return el;
            });
          }
        });
        safeWriteFileAtomic(graphPath, JSON.stringify(rawGraph, null, 2));
        broadcastGraph(rawGraph, {
          source: 'INLINE_EDIT',
          changedFile: path.basename(safeSourcePath),
          newLabel,
          elementId,
          timestamp: Date.now()
        });
      }

      res.json({ success: true, updated: true, newLabel, elementId });
    } else {
      res.status(400).json({ error: `Could not find "${oldLabel}" in ${filePath}` });
    }
  } catch (err) {
    console.error('Error updating view element:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Save Agent Workspace Scope Contract
app.post('/api/save-agent-scope', (req, res) => {
  try {
    const { scope } = req.body;
    if (!scope || !scope.id) {
      return res.status(400).json({ error: 'Missing scope definition' });
    }

    const scopeDir = path.dirname(graphPath);
    const scopePath = validateSafePath(path.join(scopeDir, 'agent-scope.json'));
    safeWriteFileAtomic(scopePath, JSON.stringify(scope, null, 2));

    console.log(`🤖 Agent scope "${scope.name}" saved to: ${scopePath}`);
    res.json({ success: true, scope, path: scopePath });
  } catch (err) {
    console.error('Error saving agent scope:', err);
    res.status(err.message?.includes('Access denied') ? 403 : 500).json({ error: err.message });
  }
});

// REST: Get Active Agent Scope
app.get('/api/agent-scope', (req, res) => {
  try {
    const scopeDir = path.dirname(graphPath);
    const scopePath = path.join(scopeDir, 'agent-scope.json');
    if (fs.existsSync(scopePath)) {
      const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
      return res.json({ scope });
    }
    res.json({ scope: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST: Unlock / Delete Agent Scope
app.delete('/api/agent-scope', (req, res) => {
  try {
    const scopeDir = path.dirname(graphPath);
    const scopePath = path.join(scopeDir, 'agent-scope.json');
    if (fs.existsSync(scopePath)) {
      fs.unlinkSync(scopePath);
    }
    console.log(`🔓 Agent scope cleared`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REST: Validate Agent Scope against Git status
app.post('/api/validate-agent-scope', (req, res) => {
  try {
    const { scope, customFiles } = req.body;
    let activeScope = scope;
    if (!activeScope && fs.existsSync(graphPath)) {
      const rawGraph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      activeScope = rawGraph.activeWorkspace;
    }

    if (!activeScope) {
      return res.status(400).json({ error: 'No active agent scope configured to validate against' });
    }

    let modifiedFiles = customFiles;
    if (!modifiedFiles) {
      try {
        const repoRoot = path.resolve(__dirname, '../../');
        const gitOutput = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' });
        modifiedFiles = gitOutput
          .split('\n')
          .map(line => line.trim().slice(3))
          .filter(Boolean);
      } catch (gitErr) {
        console.warn('Could not run git status:', gitErr.message);
        modifiedFiles = [];
      }
    }

    const allowed = activeScope.allowedFilePaths || [];
    const violations = [];

    modifiedFiles.forEach(file => {
      // Ignore git internals, untracked root artifacts or dist files
      if (file.startsWith('packages/canvas-ui/dist') || file.startsWith('.gemini') || file.includes('agent-scope.json')) {
        return;
      }
      const isAllowed = allowed.some(a => file.includes(a) || a.includes(file));
      if (!isAllowed) {
        violations.push({
          file,
          message: `File "${file}" was modified but is OUTSIDE the locked scope of [${allowed.join(', ')}]`
        });
      }
    });

    res.json({
      isCompliant: violations.length === 0,
      violations,
      allowedFiles: allowed,
      modifiedFiles
    });
  } catch (err) {
    console.error('Error validating scope:', err);
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'PONG') {
        ws.isAlive = true;
      }
    } catch (_) {}
  });
});

let heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    try {
      ws.ping();
      if (ws.readyState === 1) { // OPEN
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    } catch (_) {}
  });
}, 30000);

heartbeatInterval.unref?.();

function broadcastGraph(graph, meta = {}) {
  const payload = JSON.stringify({ type: 'GRAPH_UPDATED', graph, meta, ...meta });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

/**
 * Parses Swift source code into AST descriptors (type name, properties, methods, viewElements, line spans)
 */
function parseSwiftASTFile(sourceContent, filename = '') {
  const lines = sourceContent.split('\n');
  const typeMatch = sourceContent.match(/(?:struct|class|actor|protocol)\s+([A-Za-z0-9_]+)(?:\s*:\s*([^{]+))?/);
  const typeName = typeMatch ? typeMatch[1] : path.basename(filename, '.swift');
  const inheritance = typeMatch && typeMatch[2] ? typeMatch[2].split(',').map((s) => s.trim()) : [];

  let kind = 'view';
  if (inheritance.includes('App') || typeName.endsWith('App')) {
    kind = 'app';
  } else if (
    inheritance.includes('ObservableObject') ||
    sourceContent.includes('@Observable') ||
    typeName.toLowerCase().includes('viewmodel') ||
    typeName.toLowerCase().includes('modeldata')
  ) {
    kind = 'viewModel';
  } else if (typeName.toLowerCase().includes('service') || typeName.toLowerCase().includes('client')) {
    kind = 'service';
  } else if (typeName.toLowerCase().includes('storage') || typeName.toLowerCase().includes('repository')) {
    kind = 'repository';
  }

  // Find start line of type declaration
  let startLine = 1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`(?:struct|class|actor|protocol)\\s+${typeName}\\b`))) {
      startLine = i + 1;
      break;
    }
  }

  // Extract properties
  const properties = [];
  const propRegex = /@(State|Binding|Environment|Published|Observable)(?:\([^)]*\))?\s+(?:private\s+|public\s+|internal\s+)?var\s+([A-Za-z0-9_]+)(?:\s*:\s*([^=\n]+))?(?:\s*=\s*([^\n]+))?/g;
  let match;
  while ((match = propRegex.exec(sourceContent)) !== null) {
    const decorator = match[1];
    const name = match[2];
    const type = (match[3] || 'Any').trim();
    properties.push({
      name,
      typeAnnotation: type,
      decorator: `@${decorator}`,
      isState: decorator === 'State',
      isBinding: decorator === 'Binding',
      isPublished: decorator === 'Published'
    });
  }

  // Extract methods / ports
  const methods = [];
  const methodRegex = /func\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*(?:async\s*)?(?:throws\s*)?->\s*([^{\n]+))?/g;
  while ((match = methodRegex.exec(sourceContent)) !== null) {
    const name = match[1];
    const params = match[2].trim();
    const ret = (match[3] || 'Void').trim();
    methods.push({
      id: `port_${typeName.toLowerCase()}_${name.toLowerCase()}`,
      name,
      typeAnnotation: `(${params}) -> ${ret}`,
      direction: 'input'
    });
  }

  // Extract interactive UI elements & tabs / labels
  const viewElements = [];
  let elIdx = 0;

  // 1. Buttons
  const buttonRegex = /Button\s*\(\s*"([^"]+)"/g;
  while ((match = buttonRegex.exec(sourceContent)) !== null) {
    elIdx++;
    viewElements.push({
      id: `el_${typeName.toLowerCase()}_btn_${elIdx}`,
      type: 'button',
      label: match[1]
    });
  }

  // 2. Labels (e.g. Label("ALBANNNN", systemImage: "star") or Label("List", ...))
  const labelRegex = /Label\s*\(\s*"([^"]+)"(?:\s*,\s*systemImage:\s*"([^"]+)")?\s*\)/g;
  while ((match = labelRegex.exec(sourceContent)) !== null) {
    elIdx++;
    const preceding = sourceContent.slice(Math.max(0, match.index - 120), match.index);
    const following = sourceContent.slice(match.index, Math.min(sourceContent.length, match.index + 120));
    const isTab = preceding.includes('.tabItem') || preceding.includes('TabView');
    const tagMatch = following.match(/\.tag\s*\(\s*(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)\s*\)/);
    viewElements.push({
      id: `el_${typeName.toLowerCase()}_${isTab ? 'tab' : 'label'}_${elIdx}`,
      type: isTab ? 'tab' : 'label',
      label: match[1],
      systemImage: match[2] || null,
      tag: tagMatch ? tagMatch[1].toLowerCase() : null
    });
  }

  // 3. TabItems with Text (e.g. .tabItem { Text("Featured") })
  const tabItemRegex = /\.tabItem\s*\{[^}]*Text\s*\(\s*"([^"]+)"\s*\)[^}]*\}/g;
  while ((match = tabItemRegex.exec(sourceContent)) !== null) {
    if (!viewElements.some((e) => e.label === match[1])) {
      elIdx++;
      viewElements.push({
        id: `el_${typeName.toLowerCase()}_tab_${elIdx}`,
        type: 'tab',
        label: match[1]
      });
    }
  }

  return {
    typeName,
    kind,
    startLine,
    endLine: lines.length,
    properties,
    methods,
    viewElements
  };
}

/**
 * Reconciles a changed Swift file into the loaded SaaG graph in memory
 */
function reconcileSwiftASTChange(fullSourcePath, graph, activeProject) {
  if (!fs.existsSync(fullSourcePath)) return { updated: false, reason: 'File does not exist' };
  const content = fs.readFileSync(fullSourcePath, 'utf8');
  const ast = parseSwiftASTFile(content, path.basename(fullSourcePath));

  const filename = path.basename(fullSourcePath);
  const relativeFromRoot = activeProject?.sourceDir ? path.relative(activeProject.sourceDir, fullSourcePath) : filename;

  let matchedNodeId = null;
  const nodes = graph.nodes || {};

  for (const [id, node] of Object.entries(nodes)) {
    const nodeFile = node.sourceAnchor?.filePath;
    if (
      nodeFile &&
      (nodeFile === fullSourcePath ||
        fullSourcePath.endsWith(nodeFile) ||
        nodeFile.endsWith(relativeFromRoot) ||
        path.basename(nodeFile) === filename)
    ) {
      matchedNodeId = id;
      break;
    }
    if (node.name && node.name.toLowerCase() === ast.typeName.toLowerCase()) {
      matchedNodeId = id;
      break;
    }
  }

  if (matchedNodeId && nodes[matchedNodeId]) {
    const node = nodes[matchedNodeId];
    if (!node.sourceAnchor) {
      node.sourceAnchor = {};
    }
    node.sourceAnchor.startLine = ast.startLine || node.sourceAnchor.startLine || 1;
    node.sourceAnchor.endLine = ast.endLine || node.sourceAnchor.endLine;
    node.sourceAnchor.filePath = node.sourceAnchor.filePath || relativeFromRoot;

    // Update node name and symbolPath if typeName was changed in Swift source
    if (ast.typeName) {
      node.name = ast.typeName;
      node.sourceAnchor.symbolPath = ast.typeName;
    }

    if (ast.properties && ast.properties.length > 0) {
      node.properties = ast.properties;
    }
    if (ast.viewElements && ast.viewElements.length > 0) {
      node.viewElements = ast.viewElements;
    }

    node.metadata = {
      ...(node.metadata || {}),
      lastSynchronizedAt: new Date().toISOString()
    };

    return { updated: true, nodeId: matchedNodeId, node };
  }

  return { updated: false, reason: `No matching graph node found for ${filename} (${ast.typeName})` };
}

// REST: Live Sync Status
app.get('/api/live-sync/status', (req, res) => {
  const project = KNOWN_PROJECTS.find((p) => p.id === activeProjectId);
  res.json({
    activeProjectId,
    projectName: project?.name,
    isWatching: Boolean(currentSwiftWatcher),
    sourceDir: project?.sourceDir,
    graphPath,
    lastEvent: lastSwiftEvent,
    connectedClients: wss ? wss.clients.size : 0
  });
});

// Dynamic File Watcher for active graph
let currentWatcher = null;
let watchDebounce = null;

function setupFileWatcher() {
  if (currentWatcher) {
    try {
      currentWatcher.close();
    } catch (e) {}
    currentWatcher = null;
  }

  const dir = path.dirname(graphPath);
  if (fs.existsSync(dir)) {
    try {
      currentWatcher = fs.watch(dir, (eventType, filename) => {
        if (filename === path.basename(graphPath)) {
          if (Date.now() - lastInternalWriteTime < 1500) {
            return;
          }
          clearTimeout(watchDebounce);
          watchDebounce = setTimeout(() => {
            if (Date.now() - lastInternalWriteTime < 1500) {
              return;
            }
            try {
              if (fs.existsSync(graphPath)) {
                const raw = fs.readFileSync(graphPath, 'utf8');
                const parsed = JSON.parse(raw);
                console.log(`🔄 Graph file changed externally, broadcasting update...`);
                broadcastGraph(parsed, { source: 'JSON_WATCHER' });
              }
            } catch (e) {
              // File might be mid-write
            }
          }, 150);
        }
      });
    } catch (e) {
      console.warn('Unable to watch directory:', dir);
    }
  }
}

// Dynamic Real-Time Swift File Watcher
let currentSwiftWatcher = null;
let swiftWatchDebounce = null;
let lastSwiftEvent = null;

function setupSwiftFileWatcher() {
  if (currentSwiftWatcher) {
    try {
      currentSwiftWatcher.close();
    } catch (e) {}
    currentSwiftWatcher = null;
  }

  const project = KNOWN_PROJECTS.find((p) => p.id === activeProjectId);
  if (!project || !project.sourceDir || !fs.existsSync(project.sourceDir)) {
    return;
  }

  try {
    const isRecursiveSupported = process.platform === 'darwin' || process.platform === 'win32';
    const watchOpts = isRecursiveSupported ? { recursive: true } : {};
    currentSwiftWatcher = fs.watch(project.sourceDir, watchOpts, (eventType, filename) => {
      if (!filename || !filename.endsWith('.swift')) return;
      if (
        filename.includes('.build') ||
        filename.includes('.git') ||
        filename.includes('.index-build') ||
        filename.startsWith('.') ||
        filename.endsWith('~') ||
        filename.endsWith('.swp') ||
        filename.endsWith('.tmp') ||
        filename.endsWith('4913')
      ) {
        return;
      }

      clearTimeout(swiftWatchDebounce);
      swiftWatchDebounce = setTimeout(() => {
        try {
          const fullPath = path.resolve(project.sourceDir, filename);
          if (!fs.existsSync(fullPath)) return;

          console.log(`⚡ Swift file changed: ${filename}`);
          lastSwiftEvent = { filename, timestamp: Date.now() };

          if (fs.existsSync(graphPath)) {
            const raw = fs.readFileSync(graphPath, 'utf8');
            const graph = JSON.parse(raw);
            const { updated } = reconcileSwiftASTChange(fullPath, graph, project);

            if (updated) {
              safeWriteFileAtomic(graphPath, JSON.stringify(graph, null, 2));
              console.log(`💾 Reconciled AST saved to ${graphPath}`);
            }

            broadcastGraph(graph, {
              source: 'SWIFT_WATCHER',
              changedFile: filename,
              timestamp: Date.now()
            });
          }
        } catch (err) {
          console.warn('Error handling Swift file change:', err.message);
        }
      }, 180);
    });
    console.log(`👁️ Swift AST File Watcher active on: ${project.sourceDir}`);
  } catch (err) {
    console.warn(`Unable to watch Swift directory ${project.sourceDir}:`, err.message);
  }
}

function gracefulShutdown(signal = 'SIGTERM') {
  console.log(`\n🛑 Received ${signal}. Shutting down SaaG Bridge Daemon gracefully...`);
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  if (currentWatcher) {
    try { currentWatcher.close(); } catch (_) {}
  }
  if (currentSwiftWatcher) {
    try { currentSwiftWatcher.close(); } catch (_) {}
  }
  wss.clients.forEach((client) => {
    try { client.close(1001, 'Server shutting down'); } catch (_) {}
  });
  wss.close(() => {
    server.close(() => {
      console.log('✅ SaaG Bridge Daemon shut down cleanly.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 1500).unref();
}

function closeWatchers() {
  if (currentWatcher) {
    try { currentWatcher.close(); } catch (_) {}
    currentWatcher = null;
  }
  if (currentSwiftWatcher) {
    try { currentSwiftWatcher.close(); } catch (_) {}
    currentSwiftWatcher = null;
  }
}

export {
  app,
  server,
  wss,
  KNOWN_PROJECTS,
  broadcastGraph,
  setupFileWatcher,
  setupSwiftFileWatcher,
  closeWatchers,
  parseSwiftASTFile,
  reconcileSwiftASTChange,
  validateSafePath,
  safeWriteFileAtomic,
  gracefulShutdown
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  setupFileWatcher();
  setupSwiftFileWatcher();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 SaaG Bridge Daemon listening at http://localhost:${PORT}`);
  });

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
