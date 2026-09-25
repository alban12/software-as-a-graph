import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findWorkspaceRoot } from './projectResolver.js';

/**
 * Validate that a target path is strictly contained within allowed base directories.
 * Prevents directory traversal attacks (e.g., ../../../etc/passwd).
 */
export function validateSafePath(targetPath, customBase = null) {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Invalid path provided');
  }

  if (targetPath.indexOf('\0') !== -1) {
    throw new Error('Null byte detected in path');
  }

  const workspaceRoot = findWorkspaceRoot();
  const allowedRoots = [
    workspaceRoot,
    os.tmpdir(),
    fs.existsSync(os.tmpdir()) ? fs.realpathSync(os.tmpdir()) : os.tmpdir(),
    process.cwd()
  ];

  if (customBase) {
    allowedRoots.push(path.resolve(customBase));
  }

  const resolved = path.resolve(targetPath);
  const isAllowed = allowedRoots.some((root) => {
    const rootResolved = path.resolve(root);
    const rel = path.relative(rootResolved, resolved);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  });

  if (!isAllowed) {
    throw new Error(`Access denied: path "${targetPath}" is outside allowed directory bounds`);
  }

  return resolved;
}

/**
 * Atomic file writer. Writes to a temporary file first, then atomically renames
 * it to the target path. Prevents zero-byte corruption if interrupted.
 */
export function safeWriteFileAtomic(targetPath, data) {
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
