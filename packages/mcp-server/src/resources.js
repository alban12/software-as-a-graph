import { getKnownProjects, resolveProjectGraph } from './projectResolver.js';

export function listResources() {
  const known = getKnownProjects();
  const resources = [
    {
      uri: 'saag://projects',
      name: 'Registered Projects Directory',
      mimeType: 'application/json',
      description: 'Index of all registered architectural projects across iOS, Agents, and ML domains.'
    }
  ];

  Object.entries(known).forEach(([id, proj]) => {
    resources.push({
      uri: `saag://${proj.domain}/${id}/graph`,
      name: `${proj.name} Architecture Graph`,
      mimeType: 'application/json',
      description: `Complete architectural graph IR for ${proj.name} (${proj.domain} domain).`
    });
  });

  return { resources };
}

export function readResource(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Missing or invalid "uri" parameter');
  }

  const known = getKnownProjects();

  // 1. saag://projects
  if (uri === 'saag://projects') {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(known, null, 2)
        }
      ]
    };
  }

  // 2. saag://<domain>/<id>/graph
  const match = uri.match(/^saag:\/\/([^/]+)\/([^/]+)\/graph$/);
  if (match) {
    const [, , projectId] = match;
    const { graph } = resolveProjectGraph(projectId);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(graph, null, 2)
        }
      ]
    };
  }

  // 3. saag://<domain>/<id>/nodes/<nodeId>
  const nodeMatch = uri.match(/^saag:\/\/([^/]+)\/([^/]+)\/nodes\/([^/]+)$/);
  if (nodeMatch) {
    const [, , projectId, nodeId] = nodeMatch;
    const { graph } = resolveProjectGraph(projectId);
    const targetNode = graph.nodes?.[nodeId];
    if (!targetNode) {
      throw new Error(`Node "${nodeId}" not found in project "${projectId}".`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(targetNode, null, 2)
        }
      ]
    };
  }

  throw new Error(`Resource not found for URI: "${uri}"`);
}
