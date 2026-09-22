import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

let activeProjectId = 'landmarks';
let graphPath = KNOWN_PROJECTS[2].path;
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

    setupFileWatcher();

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
    const targetFile = req.body?.targetPath || req.query?.targetPath || graphPath;
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const formatted = JSON.stringify(updatedGraph, null, 2);
    fs.writeFileSync(targetFile, formatted, 'utf8');
    console.log(`💾 Graph saved successfully (${Object.keys(updatedGraph.nodes || {}).length} nodes) to ${targetFile}`);

    if (targetFile === graphPath) {
      broadcastGraph(updatedGraph);
    }
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error saving graph:', err);
    res.status(500).json({ error: err.message });
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

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, code, 'utf8');
    console.log(`💾 Swift Test written successfully to: ${targetPath}`);
    res.json({ success: true, path: targetPath });
  } catch (err) {
    console.error('Error writing test:', err);
    res.status(500).json({ error: err.message });
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

        let targetFilePath = path.isAbsolute(change.filePath)
          ? change.filePath
          : path.resolve(sourceDir, change.filePath);

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

        fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
        fs.writeFileSync(targetFilePath, change.code, 'utf8');
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

          fs.writeFileSync(graphPath, JSON.stringify(updatedGraph, null, 2), 'utf8');
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
    res.status(500).json({ error: err.message });
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

    let sourceContent = fs.readFileSync(fullSourcePath, 'utf8');
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
      fs.writeFileSync(fullSourcePath, sourceContent, 'utf8');
      console.log(`📝 Reconciled ${fullSourcePath}: replaced "${oldLabel}" with "${newLabel}"`);

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
        fs.writeFileSync(graphPath, JSON.stringify(rawGraph, null, 2), 'utf8');
        broadcastGraph(rawGraph);
      }

      res.json({ success: true, updated: true, newLabel });
    } else {
      res.status(400).json({ error: `Could not find "${oldLabel}" in ${filePath}` });
    }
  } catch (err) {
    console.error('Error updating view element:', err);
    res.status(500).json({ error: err.message });
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
    const scopePath = path.join(scopeDir, 'agent-scope.json');
    fs.writeFileSync(scopePath, JSON.stringify(scope, null, 2), 'utf8');

    console.log(`🤖 Agent scope "${scope.name}" saved to: ${scopePath}`);
    res.json({ success: true, scope, path: scopePath });
  } catch (err) {
    console.error('Error saving agent scope:', err);
    res.status(500).json({ error: err.message });
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

function broadcastGraph(graph) {
  const payload = JSON.stringify({ type: 'GRAPH_UPDATED', graph });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

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
          clearTimeout(watchDebounce);
          watchDebounce = setTimeout(() => {
            try {
              if (fs.existsSync(graphPath)) {
                const raw = fs.readFileSync(graphPath, 'utf8');
                const parsed = JSON.parse(raw);
                console.log(`🔄 Graph file changed externally, broadcasting update...`);
                broadcastGraph(parsed);
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

export { app, server, KNOWN_PROJECTS };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  setupFileWatcher();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 SaaG Bridge Daemon listening at http://localhost:${PORT}`);
  });
}
