import { WebSocketServer } from 'ws';
import { watchFile } from 'fs';
import { readFile, writeFile } from 'fs/promises';

const PLAYGROUND_FILE = './playground.strudel';
const ERRORS_FILE = './playground.errors';
const PORT = 4322;

const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

let lastContent = '';
let ignoreNextFileChange = false;

// Read initial content
async function loadFile() {
  try {
    return await readFile(PLAYGROUND_FILE, 'utf-8');
  } catch {
    return '';
  }
}

// Broadcast to all clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

// Watch file for changes (polling-based, more reliable on macOS)
watchFile(PLAYGROUND_FILE, { interval: 300 }, async () => {
  if (ignoreNextFileChange) {
    ignoreNextFileChange = false;
    return;
  }

  const content = await loadFile();
  if (content !== lastContent) {
    lastContent = content;
    console.log('📁 File changed, pushing to browser');
    broadcast({ type: 'code', content });
  }
});

// Handle connections
wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log('🔌 Browser connected');

  // Send current content
  const content = await loadFile();
  lastContent = content;
  ws.send(JSON.stringify({ type: 'code', content }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'code' && msg.content !== lastContent) {
        lastContent = msg.content;
        ignoreNextFileChange = true;
        await writeFile(PLAYGROUND_FILE, msg.content);
        console.log('💾 Saved from browser');
      } else if (msg.type === 'error' || msg.type === 'warn') {
        const timestamp = new Date().toISOString().slice(11, 19);
        const line = `[${timestamp}] ${msg.type.toUpperCase()}: ${msg.message}\n`;
        await writeFile(ERRORS_FILE, line);
        console.log(`⚠️  ${msg.type}: ${msg.message}`);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔌 Browser disconnected');
  });
});

console.log(`🍪 Kolacik sync server running on ws://localhost:${PORT}`);
lastContent = await loadFile();
