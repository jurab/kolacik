# 2026-02-22 — Architecture Refactor, Root Cleanup, Dub Session

## What Happened

### 1. Architecture Refactor (committed)
Completed the module split from previous session:
- `Mixer.jsx` 709→361 lines (orchestration only)
- `components/TrackPanel.jsx` (231 lines) — per-track editor + controls
- `components/MixerToolbar.jsx` (57 lines) — top bar
- `effects/effectDetector.mjs` (176 lines) — hap→effect routing, pure logic
- `effects/CurlParticles.mjs` (271 lines) — particle renderer, no Strudel imports
- `compiler.mjs` (31 lines) — extracted from sync-server, pure function
- GlobalFxEditor UI removed (globalFx still works via mix.json, just no UI)

### 2. Root Directory Cleanup (committed)
Stripped ~12K lines of unused Strudel upstream:
- Deleted: `examples/`, `docs/`, `src-tauri/`, `tools/`, `Dockerfile`, `index.mjs`, `warm.js`, `lerna.json`, `undocumented.json`, `CHANGELOG.md`, `CONTRIBUTING.md`, `my-patterns/`
- Removed `lerna` + `@tauri-apps/cli` from devDependencies
- Moved `save-piece.sh` + `load-piece.sh` → `scripts/`
- Moved `what_jura_knows.md` → `session_logs/`
- Created proper `CLAUDE.md` at project root (the old `claude.md` was deleted as "duplicate" then recreated)
- Fixed `.gitignore` — all `playground.*` files now covered
- `playground.debug` auto-truncation added to sync-server startup (was 48MB)
- Removed stale files: `test-scroll.mjs`, `mixer-debug*.png`, `session.log`, `plan.md`

### 3. Compiler Enhancements (committed)
- Auto-inject `.orbit(n)` per track — each track now gets isolated effects (delay/reverb don't bleed)
- Documented full "Setting Up a New Piece" workflow in CLAUDE.md (groups, trackFx, orbit)
- Added PDF page offset note to knowledgebase INDEX.md (DMM: PDF page = book page + 15)
- Added knowledgebase reference section to CLAUDE.md

### 4. Artifact Updates (committed)
- Updated mix.json in all multi-track artifacts (05-08, berlin-deep-bass) with `trackFx` assignments

### 5. Dub Track (in progress, not committed)
Built a 6-track dub piece based on Dance Music Manual Ch. 33:
- `01-kick` — one-drop on beat 3, dry, LPF'd
- `02-snare` — beats 2+4, heavy delay (1/8th), reverb
- `03-hats` — syncopated offbeat, velocity variation, slow LPF sweep
- `04-bass` — E minor sub bass, sawtooth, slow filter LFO
- `05-skank` — Em chord on 2+4, short attack, delay + reverb
- `06-piano` — syncopated E/B, HPF'd, room reverb + delay
- 110 BPM, each track assigned group number + visual FX

### 6. SQLite Plan (designed, not implemented)
Plan at `/Users/jura/.claude/plans/happy-scribbling-pebble.md`

**Goal:** Replace filesystem-based track/artifact storage with SQLite.

**Schema:** Single `pieces` table, JSON blob per piece. Live session = reserved `_live` piece. Save/load = copy between pieces.

**Key decisions still open:**
- How should Claude interact with SQLite? (CLI helper vs file mirror vs raw sqlite3)
- Whether to keep tracks/ dir as compatibility layer or go pure SQLite

**What it enables:** Artifact selector dropdown in mixer toolbar, atomic state, no fs.watch flakiness.

## Commits This Session
1. `e128d763` — Refactor mixer into modules
2. `98b3f655` — Clean up root — remove stale debug files
3. `59a8b7d6` — Strip unused Strudel upstream (12K lines)
4. `2c2657e9` — Auto-assign orbit per track, document piece setup
5. `2a37ba6e` — Add trackFx to all multi-track artifacts

## Files Changed (tracked)
```
compiler.mjs                              (new, orbit injection)
CLAUDE.md                                 (new, project instructions)
README.md                                 (updated architecture section)
sync-server.mjs                           (imports compiler, debug truncation)
website/src/repl/Mixer.jsx                (361 lines, refactored)
website/src/repl/CurlParticles.mjs        (deleted, moved to effects/)
website/src/repl/components/TrackPanel.jsx (new)
website/src/repl/components/MixerToolbar.jsx (new)
website/src/repl/effects/effectDetector.mjs (new)
website/src/repl/effects/CurlParticles.mjs (new)
knowledgebase/INDEX.md                    (PDF offset note)
artifacts/*/mix.json                      (trackFx added)
.gitignore                                (playground.* coverage)
package.json                              (removed lerna, tauri-cli, iclc script)
scripts/save-piece.sh                     (moved from root)
scripts/load-piece.sh                     (moved from root)
session_logs/what_jura_knows.md           (moved from root)
```
