import { resolveProjectGraph } from '../projectResolver.js';
import { verifyGraph, formatMarkdownReport } from '../verifier.js';

export const validateArchitectureSchema = {
  name: 'validate_architecture',
  description: 'Audits an architectural graph or proposed code modifications against Clean Architecture rules (layer separation, cyclic dependencies, retain cycles, state blast radius, and ML hardware constraints).',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project ID or file path to graph.json. Defaults to "landmarks".'
      },
      modifiedFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of file paths modified by an agent or PR to check against active workspace scope boundaries.'
      },
      maxBlastRadius: {
        type: 'number',
        description: 'Maximum allowable view invalidation fanout before warning (default: 5).'
      },
      enforceLayerSeparation: {
        type: 'boolean',
        description: 'Whether to enforce strict Clean Architecture layer separation (default: true).'
      }
    }
  }
};

export async function executeValidateArchitecture(args = {}) {
  const { graph, projectId, projectName } = resolveProjectGraph(args.project || 'landmarks');

  const auditResult = verifyGraph(graph, {
    maxBlastRadius: args.maxBlastRadius ?? 5,
    enforceLayerSeparation: args.enforceLayerSeparation ?? true,
    modifiedFiles: args.modifiedFiles || [],
    checkCycles: true,
    checkMlHardware: true
  });

  const markdownSummary = formatMarkdownReport(auditResult, projectName);

  return {
    projectId,
    projectName,
    ...auditResult,
    markdownSummary
  };
}
