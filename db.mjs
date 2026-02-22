// db.mjs — SQLite storage layer for kolacik
// Single table: pieces (name, tracks JSON, state JSON)
// Live session = reserved piece '_live'

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
import { existsSync } from 'fs';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

let db;

export function initDb(dbPath = './kolacik.db') {
  const isNew = !existsSync(dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pieces (
      name TEXT PRIMARY KEY,
      tracks TEXT NOT NULL DEFAULT '{}',
      state TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return { db, isNew };
}

// ── Live session CRUD ──

export function getLive() {
  const row = db.prepare('SELECT tracks, state FROM pieces WHERE name = ?').get('_live');
  if (!row) return { tracks: {}, state: {} };
  return { tracks: JSON.parse(row.tracks), state: JSON.parse(row.state) };
}

export function setLive(tracks, state) {
  db.prepare(`
    INSERT INTO pieces (name, tracks, state, updated_at) VALUES ('_live', ?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET tracks = excluded.tracks, state = excluded.state, updated_at = excluded.updated_at
  `).run(JSON.stringify(tracks), JSON.stringify(state));
}

export function getTrack(id) {
  const { tracks } = getLive();
  return tracks[id] ?? null;
}

export function putTrack(id, code) {
  const { tracks, state } = getLive();
  tracks[id] = code;
  setLive(tracks, state);
}

export function removeTrack(id) {
  const { tracks, state } = getLive();
  delete tracks[id];
  // Clean up references in state
  if (state.muted) state.muted = state.muted.filter(x => x !== id);
  if (state.solo) state.solo = state.solo.filter(x => x !== id);
  if (state.groups) delete state.groups[id];
  if (state.trackFx) delete state.trackFx[id];
  setLive(tracks, state);
}

export function getState() {
  const { state } = getLive();
  return state;
}

export function putState(partial) {
  const { tracks, state } = getLive();
  Object.assign(state, partial);
  setLive(tracks, state);
  return state;
}

// ── Piece management ──

export function listPieces() {
  return db.prepare(
    "SELECT name, created_at, updated_at FROM pieces WHERE name != '_live' ORDER BY updated_at DESC"
  ).all();
}

export function savePiece(name) {
  const live = db.prepare('SELECT tracks, state FROM pieces WHERE name = ?').get('_live');
  if (!live) return false;
  db.prepare(`
    INSERT INTO pieces (name, tracks, state, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET tracks = excluded.tracks, state = excluded.state, updated_at = excluded.updated_at
  `).run(name, live.tracks, live.state);
  return true;
}

export function loadPiece(name) {
  const piece = db.prepare('SELECT tracks, state FROM pieces WHERE name = ?').get(name);
  if (!piece) return null;
  db.prepare(`
    INSERT INTO pieces (name, tracks, state, updated_at) VALUES ('_live', ?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET tracks = excluded.tracks, state = excluded.state, updated_at = excluded.updated_at
  `).run(piece.tracks, piece.state);
  return { tracks: JSON.parse(piece.tracks), state: JSON.parse(piece.state) };
}

export function deletePiece(name) {
  if (name === '_live') return false;
  db.prepare('DELETE FROM pieces WHERE name = ?').run(name);
  return true;
}

// ── Migration ──

export async function migrateFromFilesystem() {
  let imported = 0;

  // 1. Import current tracks/ + mix.json as _live
  try {
    const tracksDir = './tracks';
    const files = await readdir(tracksDir);
    const tracks = {};
    for (const f of files) {
      if (f.endsWith('.strudel')) {
        const id = f.replace('.strudel', '');
        tracks[id] = await readFile(join(tracksDir, f), 'utf-8');
      }
    }

    let state = {};
    try {
      state = JSON.parse(await readFile('./mix.json', 'utf-8'));
    } catch {}

    if (Object.keys(tracks).length > 0) {
      setLive(tracks, state);
      console.log(`  _live: ${Object.keys(tracks).length} tracks imported`);
      imported++;
    }
  } catch {}

  // 2. Import artifacts
  try {
    const artifactsDir = './artifacts';
    const entries = await readdir(artifactsDir);
    for (const name of entries) {
      const artDir = join(artifactsDir, name);
      try {
        const s = await stat(artDir);
        if (!s.isDirectory()) continue;
      } catch { continue; }

      const tracksDir = join(artDir, 'tracks');
      try {
        const files = await readdir(tracksDir);
        const tracks = {};
        for (const f of files) {
          if (f.endsWith('.strudel')) {
            const id = f.replace('.strudel', '');
            tracks[id] = await readFile(join(tracksDir, f), 'utf-8');
          }
        }

        let state = {};
        try {
          state = JSON.parse(await readFile(join(artDir, 'mix.json'), 'utf-8'));
        } catch {}

        if (Object.keys(tracks).length > 0) {
          savePieceData(name, tracks, state);
          console.log(`  ${name}: ${Object.keys(tracks).length} tracks imported`);
          imported++;
        }
      } catch {}
    }
  } catch {}

  return imported;
}

// Helper for migration — save a piece directly (not from _live)
function savePieceData(name, tracks, state) {
  db.prepare(`
    INSERT INTO pieces (name, tracks, state, updated_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET tracks = excluded.tracks, state = excluded.state, updated_at = excluded.updated_at
  `).run(name, JSON.stringify(tracks), JSON.stringify(state));
}
