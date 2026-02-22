# 2026-02-22 — SQLite Backend Migration

## What Happened

Replaced the entire file-based track/artifact system with SQLite. The sync server now serves HTTP + WebSocket on port 4322, backed by a single `kolacik.db` file.

### What was eliminated
- `tracks/*.strudel` as source of truth (50+ lines of fs.watch hack with ENOENT retries, debounce timers, `ignoreTrackChanges` set)
- `mix.json` as source of truth
- `scripts/save-piece.sh` and `scripts/load-piece.sh`
- Echo suppression on browser edits (browser → file → watcher → server loop)

### What was built

**`db.mjs`** — SQLite wrapper using `better-sqlite3` (synchronous, fast)
- Schema: single `pieces` table, JSON blobs for tracks + state
- Live session = reserved `_live` row. Save = copy to named piece. Load = copy back.
- Auto-migration on first run: imports existing `tracks/` + `mix.json` as `_live`, imports `artifacts/` as saved pieces

**`sync-server.mjs`** — Full rewrite
- HTTP API for Claude: `GET/PUT/DELETE /api/tracks/:id`, `/api/state`, `/api/pieces/*`, `/api/play`, `/api/stop`
- WebSocket for browser: same protocol as before, minus file writes
- Playground file sync kept as-is (one file, `watchFile` polling, no issues)

**Browser UI**
- `mixer-sync.mjs`: added `sendSavePiece`, `sendLoadPiece`, `sendDeletePiece`
- `Mixer.jsx`: `pieces` state, piece handlers
- `MixerToolbar.jsx`: piece selector dropdown + save button in toolbar

## Decisions

1. **Pure HTTP for Claude, no files** — Jura said he doesn't need to see diffs when Claude writes to the mixer. Claude writes tracks via `curl -X PUT`. No staging files.

2. **Playground stays file-based** — Separate, simpler workflow. One file, polling-based watcher, no issues. Not worth migrating.

3. **`better-sqlite3` over async alternatives** — Synchronous API is simpler, faster for single-process use. No concurrent access needed.

4. **JSON blobs over normalized tables** — Tracks and state are small, schema-free. No migrations needed. `json_extract()` available if we ever need queries.

5. **Old plan was too complex** — Previous session's plan kept files as a "compatibility layer" with bidirectional mirroring. That's worse than the original. Fresh eyes → just kill the files entirely.

## Technical Findings

- `better-sqlite3` needs native compilation. pnpm blocks builds by default — need `pnpm.onlyBuiltDependencies` in package.json or `pnpm approve-builds` (interactive, doesn't work in non-TTY).
- ESM + better-sqlite3: use `createRequire(import.meta.url)` to load the native module, since better-sqlite3 is CommonJS.
- Node's built-in `http` module + `ws` library share the same server via `new WebSocketServer({ server })` — one port for both HTTP and WS.

## Commits
- `903a29e3` — Replace file-based sync with SQLite backend

## Files Changed
```
db.mjs                                    (new — SQLite wrapper)
sync-server.mjs                           (rewritten — HTTP+WS+SQLite)
website/src/repl/mixer-sync.mjs           (added piece messages)
website/src/repl/Mixer.jsx                (added pieces state + handlers)
website/src/repl/components/MixerToolbar.jsx (added piece selector UI)
CLAUDE.md                                 (HTTP API workflow docs)
.gitignore                                (kolacik.db*)
package.json                              (better-sqlite3 + build config)
scripts/save-piece.sh                     (deleted)
scripts/load-piece.sh                     (deleted)
```

## Next Steps
- v2 Phase 2: Sample browser
- v2 Phase 3: Snippet library
- v2 Phase 4: Generative explorer (ribbon scrub)
