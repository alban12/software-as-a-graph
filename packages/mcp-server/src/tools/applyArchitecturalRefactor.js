import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectGraph } from '../projectResolver.js';
import { verifyGraph } from '../verifier.js';
import { validateSafePath, safeWriteFileAtomic } from '../fsUtils.js';

export const applyArchitecturalRefactorSchema = {
  name: 'apply_architectural_refactor',
  description: 'Applies atomic source code changes (creating, modifying, or deleting files) and synchronizes the .saag/graph.json architecture. Validates architectural guardrails before and after applying.',
  inputSchema: {
    type: 'object',
    required: ['changes'],
    properties: {
      project: {
        type: 'string',
        description: 'Project ID or file path to graph.json. Defaults to "landmarks".'
      },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['action', 'filePath'],
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'modify', 'delete'],
              description: 'Action to perform on the target file.'
            },
            filePath: {
              type: 'string',
              description: 'Relative path from project root or absolute path.'
            },
            content: {
              type: 'string',
              description: 'New file content (required for create and modify).'
            }
          }
        },
        description: 'List of file operations to execute.'
      },
      graphPatch: {
        type: 'object',
        description: 'Optional partial or full updated SaaG graph schema to persist atomically.'
      },
      validateAfter: {
        type: 'boolean',
        description: 'Whether to run architectural verification after applying changes. Defaults to true.'
      }
    }
  }
};

export async function executeApplyArchitecturalRefactor(args = {}) {
  if (!args.changes || !Array.isArray(args.changes) || args.changes.length === 0) {
    throw new Error('Missing or empty required parameter: "changes" (must be a non-empty array).');
  }

  const { graph, graphPath, baseDir, projectId, projectName } = resolveProjectGraph(args.project || 'landmarks');

  const modifiedPaths = [];
  const backups = new Map(); // path -> originalContent

  try {
    // 1. Pre-validate all file paths against traversal before mutating any files
    for (const change of args.changes) {
      if (!change.filePath) {
        throw new Error('Each change must specify a "filePath".');
      }
      const rawTarget = path.isAbsolute(change.filePath)
        ? change.filePath
        : path.resolve(baseDir, change.filePath);
      validateSafePath(rawTarget, baseDir);
    }

    // 2. Perform file operations with atomic writes and backup tracking
    for (const change of args.changes) {
      const rawTarget = path.isAbsolute(change.filePath)
        ? change.filePath
        : path.resolve(baseDir, change.filePath);
      const fullPath = validateSafePath(rawTarget, baseDir);

      // Record backup if file currently exists
      if (fs.existsSync(fullPath)) {
        backups.set(fullPath, fs.readFileSync(fullPath, 'utf8'));
      } else {
        backups.set(fullPath, null); // file did not exist
      }

      if (change.action === 'create' || change.action === 'modify') {
        if (typeof change.content !== 'string') {
          throw new Error(`Change for "${change.filePath}" with action "${change.action}" requires a "content" string.`);
        }
        safeWriteFileAtomic(fullPath, change.content);
        modifiedPaths.push({ action: change.action, path: fullPath });
      } else if (change.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        modifiedPaths.push({ action: 'delete', path: fullPath });
      } else {
        throw new Error(`Unsupported action "${change.action}" for file "${change.filePath}".`);
      }
    }

    // Apply graph patch if provided
    let updatedGraph = graph;
    if (args.graphPatch) {
      updatedGraph = {
        ...graph,
        ...args.graphPatch,
        nodes: { ...graph.nodes, ...(args.graphPatch.nodes || {}) },
        edges: { ...graph.edges, ...(args.graphPatch.edges || {}) }
      };
      safeWriteFileAtomic(graphPath, JSON.stringify(updatedGraph, null, 2));
    }

    // Run verification if requested
    let verificationResult = null;
    if (args.validateAfter !== false) {
      verificationResult = verifyGraph(updatedGraph, {
        modifiedFiles: args.changes.map((c) => c.filePath)
      });
    }

    return {
      success: true,
      projectId,
      projectName,
      filesAffected: modifiedPaths.length,
      operations: modifiedPaths,
      graphUpdated: Boolean(args.graphPatch),
      verification: verificationResult
    };
  } catch (err) {
    // Rollback changes on failure
    for (const [filePath, originalContent] of backups.entries()) {
      try {
        if (originalContent === null) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } else {
          safeWriteFileAtomic(filePath, originalContent);
        }
      } catch {
        // best effort rollback
      }
    }
    throw new Error(`Refactor failed and was rolled back: ${err.message}`);
  }
}

