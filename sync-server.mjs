import { WebSocketServer } from 'ws';
import { watchFile, watch, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join, basename } from 'path';

const PLAYGROUND_FILE = './playground.strudel';
const ERRORS_FILE = './playground.errors';
const COMMAND_FILE = './playground.cmd';
const DEBUG_FILE = './playground.debug';
const TRACKS_DIR = './tracks';
const MIX_FILE = './mix.strudel';
const MIX_STATE_FILE = './mix.json';
const PORT = 4322;

// Ensure tracks dir exists
if (!existsSync(TRACKS_DIR)) mkdirSync(TRACKS_DIR);

const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

// ============================================================
// PLAYGROUND SYNC (existing, unchanged)
// ============================================================

let lastContent = '';
let ignoreNextFileChange = false;

async function loadFile() {
  try {
    return await readFile(PLAYGROUND_FILE, 'utf-8');
  } catch {
    return '';
  }
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

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

// ============================================================
// MIXER: Track state + compiler
// ============================================================

const tracks = {};           // { id: code }
let mixState = { muted: [], solo: [], bpm: null, globalFx: '' };
let lastCompiledCode = '';
const ignoreTrackChanges = new Set(); // track ids to ignore next file change for

async function loadMixState() {
  try {
    const raw = await readFile(MIX_STATE_FILE, 'utf-8');
    mixState = JSON.parse(raw);
  } catch {
    mixState = { muted: [], solo: [], bpm: null, globalFx: '' };
  }
}

async function saveMixState() {
  await writeFile(MIX_STATE_FILE, JSON.stringify(mixState, null, 2) + '\n');
}

async function loadAllTracks() {
  try {
    const files = await readdir(TRACKS_DIR);
    for (const f of files) {
      if (f.endsWith('.strudel')) {
        const id = f.replace('.strudel', '');
        tracks[id] = await readFile(join(TRACKS_DIR, f), 'utf-8');
      }
    }
  } catch {}
}

function compile() {
  let code = '';
  const { muted = [], solo = [], bpm, globalFx } = mixState;
  const hasSolo = solo.length > 0;

  if (bpm) code += `setcpm(${bpm}/4)\n\n`;

  // Sort track ids for deterministic order
  const sortedIds = Object.keys(tracks).sort();

  for (const id of sortedIds) {
    const isMuted = muted.includes(id);
    const isSoloed = solo.includes(id);
    const shouldMute = isMuted || (hasSolo && !isSoloed);

    code += `// == ${id} ==\n`;
    let trackCode = tracks[id].trim();
    if (shouldMute) {
      trackCode = trackCode.replace(/^\$:/, '_$:');
    }
    code += trackCode + '\n\n';
  }

  if (globalFx?.trim()) {
    code += `// == global fx ==\n${globalFx.trim()}\n`;
  }

  return code;
}

function compileAndBroadcast() {
  const code = compile();
  if (code === lastCompiledCode) return;
  lastCompiledCode = code;

  // Write to mix.strudel for reference
  writeFile(MIX_FILE, code).catch(() => {});

  const trackList = Object.keys(tracks).sort().map(id => ({
    id,
    muted: mixState.muted?.includes(id) || false,
    solo: mixState.solo?.includes(id) || false,
  }));

  broadcast({
    type: 'mixer:compiled',
    code,
    tracks: trackList,
    state: mixState,
  });

  console.log(`🎛️  Compiled ${trackList.length} tracks → ${code.length} chars`);
}

// Watch tracks directory for file changes
// Debounce per-file to avoid macOS fs.watch double-firing
// macOS fires rename events during rapid writes — retry before assuming deletion
const trackWatchTimers = {};
watch(TRACKS_DIR, (eventType, filename) => {
  if (!filename?.endsWith('.strudel')) return;
  const id = filename.replace('.strudel', '');

  if (ignoreTrackChanges.has(id)) {
    ignoreTrackChanges.delete(id);
    return;
  }

  // Debounce: wait 300ms for file to settle (macOS needs more time during write storms)
  if (trackWatchTimers[id]) clearTimeout(trackWatchTimers[id]);
  trackWatchTimers[id] = setTimeout(async () => {
    const filepath = join(TRACKS_DIR, filename);
    try {
      await stat(filepath);
      const code = await readFile(filepath, 'utf-8');
      if (tracks[id] !== code) {
        tracks[id] = code;
        console.log(`📁 Track "${id}" changed`);
        broadcast({ type: 'mixer:track', id, code });
        compileAndBroadcast();
      }
    } catch (err) {
      if (err.code === 'ENOENT' && tracks[id] !== undefined) {
        // Retry after 500ms — macOS fires transient ENOENT during write storms
        setTimeout(async () => {
          try {
            await stat(filepath);
            // File is back — was a transient failure, ignore
            const code = await readFile(filepath, 'utf-8');
            if (tracks[id] !== code) {
              tracks[id] = code;
              broadcast({ type: 'mixer:track', id, code });
              compileAndBroadcast();
            }
          } catch (err2) {
            if (err2.code === 'ENOENT') {
              delete tracks[id];
              console.log(`🗑️  Track "${id}" removed`);
              broadcast({ type: 'mixer:track:removed', id });
              compileAndBroadcast();
            }
          }
        }, 500);
      }
    }
  }, 300);
});

// Watch mix state file
watchFile(MIX_STATE_FILE, { interval: 300 }, async () => {
  const oldState = JSON.stringify(mixState);
  await loadMixState();
  if (JSON.stringify(mixState) !== oldState) {
    console.log('🎛️  Mix state changed');
    broadcast({ type: 'mixer:state', state: mixState });
    compileAndBroadcast();
  }
});

// ============================================================
// CONNECTION HANDLER
// ============================================================

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log('🔌 Browser connected');

  // Send current playground content
  const content = await loadFile();
  lastContent = content;
  ws.send(JSON.stringify({ type: 'code', content }));

  // Send current mixer state
  const trackList = Object.keys(tracks).sort().map(id => ({
    id,
    muted: mixState.muted?.includes(id) || false,
    solo: mixState.solo?.includes(id) || false,
  }));
  ws.send(JSON.stringify({
    type: 'mixer:init',
    tracks: Object.fromEntries(Object.keys(tracks).sort().map(id => [id, tracks[id]])),
    state: mixState,
    compiled: lastCompiledCode,
  }));

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      // Existing playground sync
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
      } else if (msg.type === 'debug') {
        await writeFile(DEBUG_FILE, msg.msg + '\n', { flag: 'a' });
      }

      // Mixer: track code from browser
      else if (msg.type === 'mixer:track' && msg.id && msg.code !== undefined) {
        tracks[msg.id] = msg.code;
        ignoreTrackChanges.add(msg.id);
        await writeFile(join(TRACKS_DIR, `${msg.id}.strudel`), msg.code);
        console.log(`💾 Track "${msg.id}" saved from browser`);
        compileAndBroadcast();
      }

      // Mixer: add new track
      else if (msg.type === 'mixer:track:add' && msg.id) {
        const code = msg.code || `$: s("bd")\n`;
        tracks[msg.id] = code;
        ignoreTrackChanges.add(msg.id);
        await writeFile(join(TRACKS_DIR, `${msg.id}.strudel`), code);
        console.log(`➕ Track "${msg.id}" created`);
        broadcast({ type: 'mixer:track', id: msg.id, code });
        compileAndBroadcast();
      }

      // Mixer: remove track
      else if (msg.type === 'mixer:track:remove' && msg.id) {
        delete tracks[msg.id];
        const filepath = join(TRACKS_DIR, `${msg.id}.strudel`);
        ignoreTrackChanges.add(msg.id);
        try { await unlink(filepath); } catch {}
        console.log(`🗑️  Track "${msg.id}" removed`);
        // Remove from muted/solo
        mixState.muted = mixState.muted.filter(x => x !== msg.id);
        mixState.solo = mixState.solo.filter(x => x !== msg.id);
        await saveMixState();
        broadcast({ type: 'mixer:track:removed', id: msg.id });
        compileAndBroadcast();
      }

      // Mixer: state update (mute/solo/bpm/globalFx)
      else if (msg.type === 'mixer:state' && msg.state) {
        Object.assign(mixState, msg.state);
        await saveMixState();
        console.log('🎛️  Mix state updated from browser');
        compileAndBroadcast();
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

// ============================================================
// COMMAND FILE (play/stop/toggle/play-once)
// ============================================================

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

// ============================================================
// STARTUP
// ============================================================

await loadMixState();
await loadAllTracks();
lastContent = await loadFile();
lastCompiledCode = compile();
await writeFile(MIX_FILE, lastCompiledCode).catch(() => {});

console.log(`🍪 Kolacik sync server running on ws://localhost:${PORT}`);
console.log(`🎮 Write play/stop/toggle/play-once to ${COMMAND_FILE}`);
console.log(`🎛️  Mixer: ${Object.keys(tracks).length} tracks loaded`);
