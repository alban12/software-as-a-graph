import { resolveProjectGraph } from '../projectResolver.js';
import {
  PRESET_SCENARIOS,
  executeCustomSimulation
} from '../../../canvas-ui/src/simulation/engine.js';

export const simulateDataflowSchema = {
  name: 'simulate_dataflow',
  description: 'Simulates symbolic runtime dataflow through an architecture graph, tracking socket activations, state mutations, and error halts step-by-step according to RFC-003.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project ID or file path to graph.json. Defaults to "auth-sample".'
      },
      scenarioId: {
        type: 'string',
        enum: ['happy_path', 'validation_error', 'auth_error'],
        description: 'Preset simulation scenario. Defaults to "happy_path".'
      },
      customPayload: {
        type: 'object',
        description: 'Custom JSON payload to inject into the start port.'
      },
      startNodeId: {
        type: 'string',
        description: 'Target starting node ID for custom simulation.'
      }
    }
  }
};

export async function executeSimulateDataflow(args = {}) {
  const projectRef = args.project || 'auth-sample';
  const { graph, projectId, projectName } = resolveProjectGraph(projectRef);

  let trace = [];
  let scenarioId = args.scenarioId || 'happy_path';

  if (args.customPayload && args.startNodeId) {
    trace = executeCustomSimulation(args.startNodeId, null, args.customPayload, graph);
    scenarioId = 'custom';
  } else {
    const scenario = PRESET_SCENARIOS.find((s) => s.id === scenarioId) || PRESET_SCENARIOS[0];
    trace = scenario.traceGenerator(graph);
  }

  const finalStatus = trace[trace.length - 1]?.status ?? 'success';

  const stepSummary = trace.map((s) => ({
    step: s.stepIndex,
    title: s.title,
    node: s.activeNodeId,
    status: s.status,
    edge: s.activeEdgeId,
    mutations: s.mutations || {}
  }));

  return {
    projectId,
    projectName,
    scenarioId,
    totalSteps: trace.length,
    finalStatus,
    steps: stepSummary,
    detailedTrace: trace
  };
}
