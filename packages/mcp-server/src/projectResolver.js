import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find workspace root by traversing upwards until package.json with name "software-as-a-graph" is found
export function findWorkspaceRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'software-as-a-graph') {
          return current;
        }
      } catch {
        // ignore parse error and keep walking
      }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // Fallback to two levels above packages/mcp-server/src
  return path.resolve(__dirname, '../../..');
}

export function getKnownProjects(workspaceRoot = findWorkspaceRoot()) {
  return {
    'landmarks': {
      id: 'landmarks',
      name: 'Landmarks iOS',
      domain: 'ios',
      graphPath: path.join(workspaceRoot, 'benchmarks/landmarks-graph.json'),
      baseDir: path.join(workspaceRoot, 'benchmarks/Landmarks')
    },
    'makeitso': {
      id: 'makeitso',
      name: 'MakeItSo Todo App',
      domain: 'ios',
      graphPath: path.join(workspaceRoot, 'benchmarks/makeitso-graph.json'),
      baseDir: path.join(workspaceRoot, 'benchmarks/MakeItSo')
    },
    'auth-sample': {
      id: 'auth-sample',
      name: 'AuthSample iOS',
      domain: 'ios',
      graphPath: path.join(workspaceRoot, 'examples/ios-auth-sample/.saag/graph.json'),
      baseDir: path.join(workspaceRoot, 'examples/ios-auth-sample')
    },
    'agent-orchestrator': {
      id: 'agent-orchestrator',
      name: 'Autonomous Agent Swarm',
      domain: 'agent',
      graphPath: path.join(workspaceRoot, 'benchmarks/agent-orchestrator-graph.json'),
      baseDir: path.join(workspaceRoot, 'benchmarks')
    },
    'ml-pipeline': {
      id: 'ml-pipeline',
      name: 'Llama-3 ML Training & H100 Cluster',
      domain: 'ml',
      graphPath: path.join(workspaceRoot, 'benchmarks/ml-pipeline-graph.json'),
      baseDir: path.join(workspaceRoot, 'benchmarks')
    }
  };
}

/**
 * Resolves a project identifier or file path to { graph, graphPath, baseDir, projectId, domain }
 */
export function resolveProjectGraph(projectRef, workspaceRoot = findWorkspaceRoot()) {
  const known = getKnownProjects(workspaceRoot);
  const normalizedKey = String(projectRef || 'landmarks').toLowerCase().trim();

  // 1. Check known project key
  if (known[normalizedKey]) {
    const proj = known[normalizedKey];
    if (fs.existsSync(proj.graphPath)) {
      const graph = JSON.parse(fs.readFileSync(proj.graphPath, 'utf8'));
      return {
        graph,
        graphPath: proj.graphPath,
        baseDir: proj.baseDir,
        projectId: proj.id,
        projectName: proj.name,
        domain: proj.domain
      };
    }
  }

  // 2. Direct file path to graph.json
  const resolvedPath = path.isAbsolute(projectRef)
    ? projectRef
    : path.resolve(workspaceRoot, projectRef);

  if (fs.existsSync(resolvedPath)) {
    const stat = fs.statSync(resolvedPath);
    if (stat.isFile()) {
      const graph = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      const baseDir = path.dirname(resolvedPath);
      return {
        graph,
        graphPath: resolvedPath,
        baseDir,
        projectId: path.basename(resolvedPath, '.json'),
        projectName: graph.projectName || path.basename(resolvedPath),
        domain: graph.domain || 'ios'
      };
    } else if (stat.isDirectory()) {
      const candidateGraph = path.join(resolvedPath, '.saag/graph.json');
      if (fs.existsSync(candidateGraph)) {
        const graph = JSON.parse(fs.readFileSync(candidateGraph, 'utf8'));
        return {
          graph,
          graphPath: candidateGraph,
          baseDir: resolvedPath,
          projectId: path.basename(resolvedPath),
          projectName: graph.projectName || path.basename(resolvedPath),
          domain: graph.domain || 'ios'
        };
      }
    }
  }

  throw new Error(
    `Project not found for identifier: "${projectRef}". Available known projects: ${Object.keys(known).join(', ')}`
  );
}
