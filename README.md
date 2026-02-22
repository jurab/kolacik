# kolacik

A live coding music workbench built on [Strudel](https://strudel.cc). Multi-track mixer, real-time sync, and audio-reactive particle visualization.

Fork of Strudel with a focus on multi-track composition and visual feedback. Write code, hear music, see it move.

## Quick Start

```bash
pnpm i
pnpm dev                    # Astro dev server on http://localhost:4321
node sync-server.mjs &      # HTTP + WebSocket on http://localhost:4322
```

Open `http://localhost:4321/mixer` for the mixer, or `/` for the single-track REPL.

## Features

### Mixer (`/mixer`)

Multi-track live coding interface. All track data lives in SQLite — no files on disk. Tracks are compiled together and played through a single master audio engine.

- **Per-track code editors** with syntax highlighting and independent visualization
- **Mute/Solo** per track — uses Strudel's native `_$:` muting for gapless toggling
- **Track groups** (0-9) — number keys toggle mute for entire groups
- **BPM control** — bare input in toolbar
- **Piece management** — save/load named sessions, piece selector shows current name
- **Hover-to-reveal controls** — track headers show just the name at rest, controls fade in on hover
- **Knob controls** — play/stop, viz toggle, mute-all as round protruding buttons in center toolbar
- **Trash button** — 2-click confirm to clear all tracks (replaces add-track)

### Sync System

SQLite-backed sync server (`sync-server.mjs` on port 4322) with HTTP API + WebSocket. Claude writes tracks via HTTP, browser receives updates via WebSocket.

**HTTP API:**

```bash
# Track CRUD
curl -s -X PUT http://localhost:4322/api/tracks/kick --data-binary '$: s("bd*4")'
curl -s http://localhost:4322/api/tracks/kick
curl -s http://localhost:4322/api/tracks          # list all
curl -s -X DELETE http://localhost:4322/api/tracks/kick

# Mixer state
curl -s http://localhost:4322/api/state
curl -s -X PUT http://localhost:4322/api/state -H 'Content-Type: application/json' \
  -d '{"bpm":120,"muted":[]}'

# Pieces (save/load sessions)
curl -s http://localhost:4322/api/pieces
curl -s -X POST http://localhost:4322/api/pieces/save -d '{"name":"my-piece"}'
curl -s -X POST http://localhost:4322/api/pieces/load -d '{"name":"my-piece"}'

# Transport
curl -s -X POST http://localhost:4322/api/play
curl -s -X POST http://localhost:4322/api/stop
```

**Playground (single REPL)** still uses file-based sync: `playground.strudel`, `playground.cmd`, `playground.errors`.

### Particle Visualization

Audio-reactive curl noise particle system (3000 particles). Musical events drive visual effects in real time.

| Effect | Trigger (auto) | Visual |
|---|---|---|
| burst | kick/bd | Radial push from center |
| orbitPulse | clap/snare | Angular velocity kick |
| tangent | rim/clave/cowbell | Perpendicular push |
| jitter | hh/oh/ch | Per-particle sparkle |
| flash | short high synth notes | Brightness boost |
| swell | low notes (< E3) | Orbit expansion |
| pad | sustained chords (3+ notes) | Tension-driven noise modulation |

Each track has an **fx dropdown** to override auto-detection. **Viz mode** (V key) brings particles to foreground with dimmed mixer UI. Per-track visualization: punchcard, pianoroll, wordfall, smear, active.

### Compiler

`compiler.mjs` compiles all tracks into a single Strudel program:

- Sorted alphabetically for deterministic order
- Muted tracks get `_$:` prefix (native Strudel silence — atomic, no dropout)
- Each track tagged with `.tag('trackId')` for per-track effect routing
- Each track assigned `.orbit(n)` for isolated effects (delay/reverb don't bleed)
- BPM set via `setcpm(bpm/4)` when configured

## Architecture

```
browser (localhost:4321)          sync-server (localhost:4322)         SQLite (kolacik.db)
         │                                │                                │
         │◄──── mixer:compiled ───────────┤◄──── compile() ───────────────┤ pieces table
         │◄──── mixer:state ──────────────┤                                │ (JSON blobs)
         │                                │                                │
         │──── mixer:track ──────────────►│──── db.putTracks() ──────────►│
         │──── mixer:state ──────────────►│──── db.putState() ───────────►│
         │                                │                                │
  Mixer.jsx (orchestration)       HTTP API (for Claude)            _live = current session
  ├─ MixerToolbar.jsx             WebSocket (for browser)          named pieces = saved
  ├─ TrackPanel.jsx               compiler.mjs (pure function)
  └─ effects/
     ├─ effectDetector.mjs
     └─ CurlParticles.mjs
```

### Key modules

| File | Role |
|---|---|
| `compiler.mjs` | Pure function: tracks + mixState → compiled code string |
| `sync-server.mjs` | HTTP + WebSocket server, backed by SQLite |
| `db.mjs` | SQLite wrapper (better-sqlite3), schema, migrations |
| `website/src/repl/Mixer.jsx` | Orchestration: state, refs, sync, keyboard, render |
| `website/src/repl/components/TrackPanel.jsx` | Per-track StrudelMirror + editor + controls |
| `website/src/repl/components/MixerToolbar.jsx` | Knob controls, trash, BPM, pieces |
| `website/src/repl/effects/effectDetector.mjs` | Hap → effect routing, pad/chord detection |
| `website/src/repl/effects/CurlParticles.mjs` | Curl noise particle renderer |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| P | Toggle play/pause |
| MediaPlayPause | Toggle play/pause |
| M | Toggle mute all |
| V | Toggle viz mode (particles foreground) |
| 0-9 | Toggle mute for track group |
| Ctrl+Enter | Evaluate code (in editor) |

## Based On

[Strudel](https://strudel.cc) — live coding music patterns on the web, a JavaScript port of TidalCycles. Licensed under [GNU AGPL v3](LICENSE).

- Strudel source: https://codeberg.org/uzu/strudel/
- Strudel docs: https://strudel.cc/learn
- TidalCycles community: https://discord.com/invite/HGEdXmRkzT
