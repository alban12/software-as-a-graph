import readline from 'node:readline';
import { getArchitectureGraphSchema, executeGetArchitectureGraph } from './tools/getArchitectureGraph.js';
import { getNodeContractSchema, executeGetNodeContract } from './tools/getNodeContract.js';
import { validateArchitectureSchema, executeValidateArchitecture } from './tools/validateArchitecture.js';
import { simulateDataflowSchema, executeSimulateDataflow } from './tools/simulateDataflow.js';
import { applyArchitecturalRefactorSchema, executeApplyArchitecturalRefactor } from './tools/applyArchitecturalRefactor.js';
import { listResources, readResource } from './resources.js';
import { listPrompts, getPrompt } from './prompts.js';

export const SERVER_METADATA = {
  name: 'saag-mcp',
  version: '1.0.0',
  protocolVersion: '2024-11-05'
};

export const TOOLS = [
  getArchitectureGraphSchema,
  getNodeContractSchema,
  validateArchitectureSchema,
  simulateDataflowSchema,
  applyArchitecturalRefactorSchema
];

export class McpServer {
  constructor(options = {}) {
    this.name = options.name || SERVER_METADATA.name;
    this.version = options.version || SERVER_METADATA.version;
    this.protocolVersion = options.protocolVersion || SERVER_METADATA.protocolVersion;
    this.isInitialized = false;
  }

  /**
   * Processes a single JSON-RPC 2.0 request object and returns the response object (or null for notifications).
   */
  async handleRequest(request) {
    if (!request || typeof request !== 'object') {
      return this.formatError(null, -32600, 'Invalid Request: payload must be a JSON object');
    }

    const { id, method, params } = request;

    // JSON-RPC 2.0 must have "jsonrpc": "2.0"
    if (request.jsonrpc !== '2.0' && typeof id !== 'undefined') {
      return this.formatError(id, -32600, 'Invalid Request: "jsonrpc" version must be "2.0"');
    }

    // Handle Notifications (requests without an ID)
    if (typeof id === 'undefined') {
      if (method === 'notifications/initialized') {
        this.isInitialized = true;
      }
      return null;
    }

    try {
      switch (method) {
        case 'initialize': {
          this.isInitialized = true;
          return this.formatResult(id, {
            protocolVersion: this.protocolVersion,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: this.name,
              version: this.version
            }
          });
        }

        case 'ping': {
          return this.formatResult(id, {});
        }

        // Tools
        case 'tools/list': {
          return this.formatResult(id, { tools: TOOLS });
        }

        case 'tools/call': {
          return await this.handleToolCall(id, params);
        }

        // Resources
        case 'resources/list': {
          const result = listResources();
          return this.formatResult(id, result);
        }

        case 'resources/read': {
          if (!params || !params.uri) {
            return this.formatError(id, -32602, 'Invalid params: "uri" is required');
          }
          const result = readResource(params.uri);
          return this.formatResult(id, result);
        }

        // Prompts
        case 'prompts/list': {
          const result = listPrompts();
          return this.formatResult(id, result);
        }

        case 'prompts/get': {
          if (!params || !params.name) {
            return this.formatError(id, -32602, 'Invalid params: "name" is required');
          }
          const result = getPrompt(params.name, params.arguments || {});
          return this.formatResult(id, result);
        }

        default: {
          return this.formatError(id, -32601, `Method not found: "${method}"`);
        }
      }
    } catch (err) {
      return this.formatError(id, -32603, `Internal error: ${err.message}`);
    }
  }

  async handleToolCall(id, params) {
    if (!params || !params.name) {
      return this.formatError(id, -32602, 'Invalid params: "name" is required for tools/call');
    }

    const toolName = params.name;
    const toolArgs = params.arguments || {};

    try {
      let result;
      switch (toolName) {
        case 'get_architecture_graph':
          result = await executeGetArchitectureGraph(toolArgs);
          break;
        case 'get_node_contract':
          result = await executeGetNodeContract(toolArgs);
          break;
        case 'validate_architecture':
          result = await executeValidateArchitecture(toolArgs);
          break;
        case 'simulate_dataflow':
          result = await executeSimulateDataflow(toolArgs);
          break;
        case 'apply_architectural_refactor':
          result = await executeApplyArchitecturalRefactor(toolArgs);
          break;
        default:
          return this.formatError(id, -32601, `Unknown tool: "${toolName}"`);
      }

      return this.formatResult(id, {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ]
      });
    } catch (toolError) {
      return this.formatResult(id, {
        content: [
          {
            type: 'text',
            text: `Tool Execution Error [${toolName}]: ${toolError.message}`
          }
        ],
        isError: true
      });
    }
  }

  formatResult(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  formatError(id, code, message, data = null) {
    const errorObj = { code, message };
    if (data !== null) errorObj.data = data;
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: errorObj
    };
  }

  /**
   * Binds the server to readable and writable streams (e.g. process.stdin / process.stdout)
   */
  start(inputStream = process.stdin, outputStream = process.stdout) {
    const rl = readline.createInterface({
      input: inputStream,
      terminal: false
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        const errorResponse = this.formatError(null, -32700, `Parse error: ${err.message}`);
        outputStream.write(JSON.stringify(errorResponse) + '\n');
        return;
      }

      const response = await this.handleRequest(parsed);
      if (response !== null) {
        outputStream.write(JSON.stringify(response) + '\n');
      }
    });

    return rl;
  }
}
