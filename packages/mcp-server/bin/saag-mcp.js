#!/usr/bin/env node

/**
 * SaaG MCP & CI/CD CLI Entry Point
 * 
 * Usage:
 *   saag-mcp                         Start stdio Model Context Protocol server (default)
 *   saag-mcp verify [options]        Run headless architectural CI/CD verification
 *   saag-mcp list-tools              Print registered MCP tools
 *   saag-mcp --help                  Show help instructions
 */

import { McpServer, TOOLS, SERVER_METADATA } from '../src/server.js';
import { resolveProjectGraph } from '../src/projectResolver.js';
import { verifyGraph, formatTerminalReport, formatMarkdownReport } from '../src/verifier.js';

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
SaaG Model Context Protocol (MCP) Server & CI/CD Linter
Version: ${SERVER_METADATA.version} | Protocol: ${SERVER_METADATA.protocolVersion}

USAGE:
  saag-mcp                           Start the MCP server over stdio (for Cursor, Claude, etc.)
  saag-mcp verify [options]          Run headless CI/CD architectural verification
  saag-mcp list-tools                List all available MCP tools
  saag-mcp --help, -h                Show this help message

OPTIONS FOR "verify":
  --project <id|path>                Target project ID or path to graph.json (default: landmarks)
  --max-blast-radius <n>             Max allowable state blast radius fanout (default: 5)
  --json                             Output results in machine-readable JSON format
  --markdown                         Output results formatted as a GitHub PR comment
  --ignore-warnings                  Exit 0 even if warnings are present (fails only on errors)

EXAMPLES:
  # Start MCP server in Cursor / Claude config
  npx saag-mcp

  # Verify architecture in GitHub Actions CI
  npx saag-mcp verify --project benchmarks/landmarks-graph.json

  # Verify with Markdown comment for GitHub PR bot
  npx saag-mcp verify --project makeitso --markdown
`);
}

async function runVerify() {
  let projectRef = 'landmarks';
  let maxBlastRadius = 5;
  let isJson = false;
  let isMarkdown = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project' && args[i + 1]) {
      projectRef = args[++i];
    } else if (arg === '--max-blast-radius' && args[i + 1]) {
      maxBlastRadius = parseInt(args[++i], 10) || 5;
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--markdown') {
      isMarkdown = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  try {
    const { graph, projectId, projectName } = resolveProjectGraph(projectRef);
    const result = verifyGraph(graph, {
      maxBlastRadius,
      enforceLayerSeparation: true,
      checkCycles: true,
      checkMlHardware: true
    });

    if (isJson) {
      console.log(JSON.stringify({ projectId, projectName, ...result }, null, 2));
    } else if (isMarkdown) {
      console.log(formatMarkdownReport(result, projectName));
    } else {
      console.log(formatTerminalReport(result, projectName));
    }

    if (!result.passed) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`Error during architectural verification: ${err.message}`);
    process.exit(1);
  }
}

function runListTools() {
  console.log(`\nRegistered SaaG MCP Tools (${TOOLS.length}):\n`);
  TOOLS.forEach((tool, idx) => {
    console.log(`${idx + 1}. \x1b[1m${tool.name}\x1b[0m`);
    console.log(`   ${tool.description}`);
    const props = Object.keys(tool.inputSchema?.properties || {});
    console.log(`   Parameters: ${props.length > 0 ? props.join(', ') : 'none'}\n`);
  });
}

function runStdioServer() {
  process.stderr.write(`[saag-mcp] Starting SaaG Model Context Protocol server v${SERVER_METADATA.version} over stdio...\n`);
  const server = new McpServer();
  server.start(process.stdin, process.stdout);
}

// Route command
if (command === 'verify') {
  runVerify();
} else if (command === 'list-tools') {
  runListTools();
} else if (command === '--help' || command === '-h') {
  printHelp();
} else {
  runStdioServer();
}
