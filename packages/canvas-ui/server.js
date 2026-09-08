import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Command line arguments
let graphPath = path.resolve(__dirname, '../../examples/ios-auth-sample/.saag/graph.json');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--graph' && args[i + 1]) {
    graphPath = path.resolve(process.cwd(), args[i + 1]);
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
  app.use(express.static(distPath));
}

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
    const dir = path.dirname(graphPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const formatted = JSON.stringify(updatedGraph, null, 2);
    fs.writeFileSync(graphPath, formatted, 'utf8');
    console.log(`💾 Graph saved successfully (${Object.keys(updatedGraph.nodes || {}).length} nodes)`);

    broadcastGraph(updatedGraph);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error saving graph:', err);
    res.status(500).json({ error: err.message });
  }
});

// REST: Save Generated Swift Test
app.post('/api/save-test', (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing test code' });

    const targetPath = path.resolve(__dirname, '../../examples/ios-auth-sample/Tests/AuthSampleTests/GeneratedDataflowTests.swift');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, code, 'utf8');
    console.log(`💾 Swift Test written successfully to: ${targetPath}`);
    res.json({ success: true, path: targetPath });
  } catch (err) {
    console.error('Error writing test:', err);
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

// Watch file for external modifications
let watchDebounce = null;
if (fs.existsSync(path.dirname(graphPath))) {
  fs.watch(path.dirname(graphPath), (eventType, filename) => {
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
}

wss.on('connection', (ws) => {
  console.log('⚡ Client connected to SaaG WebSocket');
  ws.on('close', () => console.log('🔌 Client disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SaaG Bridge Daemon listening at http://localhost:${PORT}`);
});
