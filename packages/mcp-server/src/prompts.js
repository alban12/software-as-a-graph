import { resolveProjectGraph } from './projectResolver.js';

export function listPrompts() {
  return {
    prompts: [
      {
        name: 'implement_scoped_feature',
        description: 'Generates an architectural guidance prompt locking an agent to a specific node/cluster with immutable socket contracts.',
        arguments: [
          {
            name: 'project',
            description: 'Project ID (e.g., "landmarks", "auth-sample").',
            required: false
          },
          {
            name: 'nodeId',
            description: 'Target component to implement or refactor.',
            required: true
          },
          {
            name: 'featureDescription',
            description: 'Description of the feature to add or refactor.',
            required: true
          }
        ]
      },
      {
        name: 'architectural_audit',
        description: 'Generates a prompt for reviewing and resolving Clean Architecture violations, retain cycles, and performance bottlenecks.',
        arguments: [
          {
            name: 'project',
            description: 'Project ID (e.g., "landmarks", "makeitso").',
            required: false
          }
        ]
      }
    ]
  };
}

export function getPrompt(name, args = {}) {
  const projectRef = args.project || 'landmarks';
  const { graph, projectId, projectName } = resolveProjectGraph(projectRef);

  if (name === 'implement_scoped_feature') {
    const nodeId = args.nodeId;
    if (!nodeId) {
      throw new Error('Prompt "implement_scoped_feature" requires "nodeId" argument.');
    }
    const targetNode = graph.nodes?.[nodeId];
    const nodeName = targetNode?.name || nodeId;
    const filePath = targetNode?.filePath || 'unknown';

    const promptText = `
You are an AI Coding Agent assigned to implement a scoped architectural feature in project "${projectName}".

### BOUNDARY SPECIFICATION & FOCUS LOCK:
- Target Component: ${nodeName} (${nodeId})
- Authorized Source File: ${filePath}
- Feature Goal: ${args.featureDescription || 'Implement requested functionality'}

### ARCHITECTURAL GUARDRAILS:
1. ONLY modify files explicitly mapped to ${nodeName} (${filePath}). Touching out-of-scope files is strictly prohibited.
2. PRESERVE IMMUTABLE SOCKET INTERFACES:
   - Inbound Sockets: ${JSON.stringify(targetNode?.sockets?.inputs || [])}
   - Outbound Sockets: ${JSON.stringify(targetNode?.sockets?.outputs || [])}
3. CLEAN ARCHITECTURE RULES:
   - UI Views MUST NOT communicate directly with Repositories or Network Services.
   - Services MUST NOT directly drive Views.
   - Escaping closures MUST capture [weak self] to prevent retain cycles.
4. Verify changes by running unit tests before finalizing.
`.trim();

    return {
      description: `Scoped implementation task for ${nodeName}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText
          }
        }
      ]
    };
  }

  if (name === 'architectural_audit') {
    const promptText = `
Perform a thorough architectural audit of project "${projectName}" (${projectId}).
Inspect the graph representation for:
1. State Blast Radius: Identify shared stores or ViewModels bound to too many downstream Views.
2. Layer Violations: Check for direct View -> Repository shortcuts.
3. Retain Cycle Risks: Identify closures in classes capturing strong self references.
4. Latency Bottlenecks: Propose splitting long synchronous calls into asynchronous streaming pipelines.
`.trim();

    return {
      description: `Architectural audit prompt for ${projectName}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText
          }
        }
      ]
    };
  }

  throw new Error(`Unknown prompt name: "${name}"`);
}
