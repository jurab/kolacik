// sync-server.mjs — HTTP + WebSocket server backed by SQLite
// HTTP API for Claude, WebSocket for browser real-time sync

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { watchFile } from 'fs';
import { readFile, writeFile, stat } from 'fs/promises';
import { compile } from './compiler.mjs';
import {
  initDb, getLive, setLive, putTrack, getTrack, removeTrack,
  putState, getState, listPieces, savePiece, loadPiece, deletePiece,
  migrateFromFilesystem,
} from './db.mjs';

const PLAYGROUND_FILE = './playground.strudel';
const ERRORS_FILE = './playground.errors';
const COMMAND_FILE = './playground.cmd';
const DEBUG_FILE = './playground.debug';
const MIX_FILE = './mix.strudel';
const PORT = 4322;

// ============================================================
// INIT
// ============================================================

// Truncate debug log if over 1MB
try {
  const { size } = await stat(DEBUG_FILE);
  if (size > 1024 * 1024) {
    const content = await readFile(DEBUG_FILE, 'utf-8');
    await writeFile(DEBUG_FILE, content.split('\n').slice(-1000).join('\n'));
    console.log(`Truncated ${DEBUG_FILE}`);
  }
} catch {}

// Init SQLite — migrate from filesystem on first run
const { isNew } = initDb();
if (isNew) {
  console.log('First run — migrating from filesystem...');
  const count = await migrateFromFilesystem();
  console.log(`Migrated ${count} pieces`);
}

// In-memory cache (loaded from SQLite, kept in sync)
let { tracks, state: mixState } = getLive();
let lastCompiledCode = compile(tracks, mixState);
await writeFile(MIX_FILE, lastCompiledCode).catch(() => {});

// ============================================================
// HELPERS
// ============================================================

const clients = new Set();

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function compileAndBroadcast() {
  const code = compile(tracks, mixState);
  if (code === lastCompiledCode) return;
  lastCompiledCode = code;
  writeFile(MIX_FILE, code).catch(() => {});

  broadcast({
    type: 'mixer:compiled',
    code,
    tracks: Object.keys(tracks).sort().map(id => ({
      id,
      muted: mixState.muted?.includes(id) || false,
      solo: mixState.solo?.includes(id) || false,
    })),
    state: mixState,
  });
  console.log(`🎛️  Compiled ${Object.keys(tracks).length} tracks → ${code.length} chars`);
}

function mixerInitPayload() {
  return {
    type: 'mixer:init',
    tracks: Object.fromEntries(Object.keys(tracks).sort().map(id => [id, tracks[id]])),
    state: mixState,
    compiled: lastCompiledCode,
    pieces: listPieces().map(p => p.name),
  };
}

// ============================================================
// HTTP API (for Claude and external tools)
// ============================================================

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function text(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS for browser fetch if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ── Tracks ──

    // GET /api/tracks — all tracks as JSON
    if (path === '/api/tracks' && method === 'GET') {
      return json(res, tracks);
    }

    // GET /api/tracks/:id — single track code
    const trackMatch = path.match(/^\/api\/tracks\/(.+)$/);
    if (trackMatch && method === 'GET') {
      const code = tracks[trackMatch[1]];
      if (code == null) return text(res, 'not found', 404);
      return text(res, code);
    }

    // PUT /api/tracks/:id — create/update track
    if (trackMatch && method === 'PUT') {
      const id = trackMatch[1];
      const code = await readBody(req);
      tracks[id] = code;
      putTrack(id, code);
      console.log(`📝 Track "${id}" updated via HTTP`);
      broadcast({ type: 'mixer:track', id, code });
      compileAndBroadcast();
      return json(res, { ok: true });
    }

    // DELETE /api/tracks/:id — remove track
    if (trackMatch && method === 'DELETE') {
      const id = trackMatch[1];
      delete tracks[id];
      removeTrack(id);
      // Refresh state (removeTrack cleans up muted/solo/groups/trackFx)
      mixState = getState();
      console.log(`🗑️  Track "${id}" removed via HTTP`);
      broadcast({ type: 'mixer:track:removed', id });
      compileAndBroadcast();
      return json(res, { ok: true });
    }

    // ── State ──

    if (path === '/api/state' && method === 'GET') {
      return json(res, mixState);
    }

    if (path === '/api/state' && method === 'PUT') {
      const partial = JSON.parse(await readBody(req));
      Object.assign(mixState, partial);
      putState(partial);
      console.log('🎛️  State updated via HTTP');
      broadcast({ type: 'mixer:state', state: mixState });
      compileAndBroadcast();
      return json(res, mixState);
    }

    // ── Pieces ──

    if (path === '/api/pieces' && method === 'GET') {
      return json(res, listPieces());
    }

    if (path === '/api/pieces/save' && method === 'POST') {
      const { name } = JSON.parse(await readBody(req));
      if (!name) return json(res, { error: 'name required' }, 400);
      savePiece(name);
      console.log(`💾 Piece "${name}" saved via HTTP`);
      return json(res, { ok: true, pieces: listPieces().map(p => p.name) });
    }

    if (path === '/api/pieces/load' && method === 'POST') {
      const { name } = JSON.parse(await readBody(req));
      const data = loadPiece(name);
      if (!data) return json(res, { error: 'not found' }, 404);
      tracks = data.tracks;
      mixState = data.state;
      mixState.muted = Object.keys(tracks);
      putState(mixState);
      lastCompiledCode = compile(tracks, mixState);
      await writeFile(MIX_FILE, lastCompiledCode).catch(() => {});
      console.log(`📂 Piece "${name}" loaded via HTTP (all muted)`);
      // Full reinit broadcast
      for (const ws of clients) {
        if (ws.readyState === 1) ws.send(JSON.stringify(mixerInitPayload()));
      }
      return json(res, { ok: true });
    }

    const pieceMatch = path.match(/^\/api\/pieces\/(.+)$/);
    if (pieceMatch && method === 'DELETE') {
      const name = decodeURIComponent(pieceMatch[1]);
      deletePiece(name);
      console.log(`🗑️  Piece "${name}" deleted via HTTP`);
      return json(res, { ok: true, pieces: listPieces().map(p => p.name) });
    }

    // ── Transport ──

    if (path === '/api/play' && method === 'POST') {
      broadcast({ type: 'play' });
      return json(res, { ok: true });
    }
    if (path === '/api/stop' && method === 'POST') {
      broadcast({ type: 'stop' });
      return json(res, { ok: true });
    }

    // ── 404 ──
    text(res, 'not found', 404);

  } catch (e) {
    console.error('HTTP error:', e);
    json(res, { error: e.message }, 500);
  }
});

// ============================================================
// WEBSOCKET (for browser real-time sync)
// ============================================================

const wss = new WebSocketServer({ server });

// Playground sync
let lastContent = '';
let ignoreNextFileChange = false;

async function loadPlayground() {
  try { return await readFile(PLAYGROUND_FILE, 'utf-8'); } catch { return ''; }
}

watchFile(PLAYGROUND_FILE, { interval: 300 }, async () => {
  if (ignoreNextFileChange) { ignoreNextFileChange = false; return; }
  const content = await loadPlayground();
  if (content !== lastContent) {
    lastContent = content;
    console.log('📁 Playground changed, pushing to browser');
    broadcast({ type: 'code', content });
  }
});

// Command file (play/stop/toggle)
watchFile(COMMAND_FILE, { interval: 200 }, async () => {
  try {
    const raw = (await readFile(COMMAND_FILE, 'utf-8')).trim();
    const cmd = raw.split(':')[0];
    if (cmd && ['play', 'stop', 'toggle', 'play-once'].includes(cmd)) {
      console.log(`🎮 Command: ${cmd}`);
      broadcast({ type: cmd });
      await writeFile(COMMAND_FILE, '');
    }
  } catch {}
});

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log('🔌 Browser connected');

  // Send playground content
  lastContent = await loadPlayground();
  ws.send(JSON.stringify({ type: 'code', content: lastContent }));

  // Send mixer init (tracks + state + compiled + pieces)
  ws.send(JSON.stringify(mixerInitPayload()));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      // Playground
      if (msg.type === 'code' && msg.content !== lastContent) {
        lastContent = msg.content;
        ignoreNextFileChange = true;
        await writeFile(PLAYGROUND_FILE, msg.content);
        console.log('💾 Playground saved from browser');
      }
      else if (msg.type === 'error' || msg.type === 'warn') {
        const ts = new Date().toISOString().slice(11, 19);
        await writeFile(ERRORS_FILE, `[${ts}] ${msg.type.toUpperCase()}: ${msg.message}\n`);
        console.log(`⚠️  ${msg.type}: ${msg.message}`);
      }
      else if (msg.type === 'debug') {
        await writeFile(DEBUG_FILE, msg.msg + '\n', { flag: 'a' });
      }

      // Mixer: track code
      else if (msg.type === 'mixer:track' && msg.id && msg.code !== undefined) {
        tracks[msg.id] = msg.code;
        putTrack(msg.id, msg.code);
        console.log(`💾 Track "${msg.id}" saved from browser`);
        compileAndBroadcast();
      }

      // Mixer: add track
      else if (msg.type === 'mixer:track:add' && msg.id) {
        const code = msg.code || '$: s("bd")\n';
        tracks[msg.id] = code;
        putTrack(msg.id, code);
        console.log(`➕ Track "${msg.id}" created`);
        broadcast({ type: 'mixer:track', id: msg.id, code });
        compileAndBroadcast();
      }

      // Mixer: remove track
      else if (msg.type === 'mixer:track:remove' && msg.id) {
        delete tracks[msg.id];
        removeTrack(msg.id);
        mixState = getState();
        console.log(`🗑️  Track "${msg.id}" removed`);
        broadcast({ type: 'mixer:track:removed', id: msg.id });
        compileAndBroadcast();
      }

      // Mixer: state update
      else if (msg.type === 'mixer:state' && msg.state) {
        Object.assign(mixState, msg.state);
        putState(msg.state);
        console.log('🎛️  Mix state updated from browser');
        compileAndBroadcast();
      }

      // Pieces: save
      else if (msg.type === 'pieces:save' && msg.name) {
        savePiece(msg.name);
        console.log(`💾 Piece "${msg.name}" saved from browser`);
        broadcast({ type: 'pieces:list', pieces: listPieces().map(p => p.name) });
      }

      // Pieces: load
      else if (msg.type === 'pieces:load' && msg.name) {
        const loaded = loadPiece(msg.name);
        if (loaded) {
          tracks = loaded.tracks;
          mixState = loaded.state;
          mixState.muted = Object.keys(tracks);
          putState(mixState);
          lastCompiledCode = compile(tracks, mixState);
          await writeFile(MIX_FILE, lastCompiledCode).catch(() => {});
          console.log(`📂 Piece "${msg.name}" loaded from browser (all muted)`);
          // Full reinit to all clients
          const payload = JSON.stringify(mixerInitPayload());
          for (const c of clients) {
            if (c.readyState === 1) c.send(payload);
          }
        }
      }

      // Pieces: delete
      else if (msg.type === 'pieces:delete' && msg.name) {
        deletePiece(msg.name);
        console.log(`🗑️  Piece "${msg.name}" deleted from browser`);
        broadcast({ type: 'pieces:list', pieces: listPieces().map(p => p.name) });
      }

    } catch (e) {
      console.error('WS parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('🔌 Browser disconnected');
  });
});

// ============================================================
// START
// ============================================================

server.listen(PORT, () => {
  console.log(`🍪 Kolacik server on http://localhost:${PORT}`);
  console.log(`   HTTP API: http://localhost:${PORT}/api/tracks`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Mixer: ${Object.keys(tracks).length} tracks loaded`);
  console.log(`   Pieces: ${listPieces().length} saved`);
});
