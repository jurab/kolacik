# kolacik

A live coding music workbench built on [Strudel](https://strudel.cc). Multi-track mixer, real-time sync, and audio-reactive particle visualization.

Fork of Strudel with a focus on multi-track composition and visual feedback. Write code, hear music, see it move.

## Quick Start

```bash
pnpm i
pnpm dev                    # Astro dev server on http://localhost:4321
node sync-server.mjs &      # WebSocket sync on ws://localhost:4322
```

Open `http://localhost:4321/mixer` for the mixer, or `/` for the single-track REPL.

## Features

### Mixer (`/mixer`)

Multi-track live coding interface. Each track is a `.strudel` file in `/tracks/`, compiled together and played through a single master audio engine.

- **Per-track code editors** with syntax highlighting and independent visualization
- **Mute/Solo** per track — uses Strudel's native `_$:` muting for gapless toggling
- **Track groups** (0-9) — number keys toggle mute for entire groups
- **BPM control** with tap-tempo style adjustment
- **Track status** — green/red names show playing/muted state, group number prefix
- **Add/remove tracks** from the UI — files created/deleted on disk automatically

### Sync System

WebSocket bridge (`sync-server.mjs` on port 4322) between filesystem and browser. Enables CLI-driven workflows — write to files, hear changes instantly.

| File | Direction | Purpose |
|---|---|---|
| `playground.strudel` | CLI ↔ browser | Single REPL code sync |
| `tracks/*.strudel` | CLI ↔ browser | Mixer track code |
| `mix.json` | CLI ↔ browser | Mixer state (mute/solo/bpm/groups/fx) |
| `playground.cmd` | CLI → browser | Transport control (`play`, `stop`, `toggle`) |
| `playground.errors` | browser → CLI | Error/warning feedback |
| `playground.debug` | browser → CLI | Debug messages |
| `mix.strudel` | generated | Compiled mixer output (all tracks merged) |

### Particle Visualization

Audio-reactive curl noise particle system (3000 particles). Musical events drive visual effects in real time.

**Effect types:**

| Effect | Trigger (auto) | Visual |
|---|---|---|
| burst | kick/bd | Radial push from center |
| orbitPulse | clap/snare | Angular velocity kick |
| tangent | rim/clave/cowbell | Perpendicular push |
| jitter | hh/oh/ch | Per-particle sparkle |
| flash | short high synth notes | Brightness boost |
| swell | low notes (< E3) | Orbit expansion |
| pad | sustained chords (3+ notes) | Tension-driven noise modulation |

Each track has an **fx dropdown** to override auto-detection — assign any effect to any track, or `none` to disable.

**Viz mode** (V key) brings particles to foreground with dimmed mixer UI.

Per-track visualization dropdown: punchcard, pianoroll, wordfall, smear, active.

### Artifacts

Save and load complete mixer states:

```bash
./save-piece.sh my-jam      # → artifacts/my-jam/ (tracks + mix.json)
./load-piece.sh my-jam      # ← restores tracks + state
```

### Compiler

The sync server compiles all track files into `mix.strudel`:

- Sorted alphabetically for deterministic order
- Muted tracks get `_$:` prefix (native Strudel silence — atomic, no dropout)
- Each track tagged with `.tag('trackId')` for per-track effect routing
- Global FX appended at end
- BPM set via `setcpm(bpm/4)` when configured

## Architecture

```
browser (localhost:4321)          sync-server (ws://4322)          filesystem
         │                                │                            │
         │◄──── mixer:compiled ───────────┤◄──── fs.watch ────────────┤ tracks/*.strudel
         │                                │                            │ mix.json
         │──── mixer:track ──────────────►│──── writeFile ────────────►│
         │──── mixer:state ──────────────►│──── writeFile ────────────►│
         │                                │                            │
  Mixer.jsx (orchestration)       compiler.mjs (pure compile)     CLI / editor
  ├─ MixerToolbar.jsx             sync-server.mjs (ws + watch)    writes files
  ├─ TrackPanel.jsx
  └─ effects/
     ├─ effectDetector.mjs        hap → effect routing (no DOM)
     └─ CurlParticles.mjs        curl noise particles (no Strudel)
```

### Key modules

| File | Lines | Role |
|---|---|---|
| `compiler.mjs` | 31 | Pure function: tracks + mixState → compiled code string |
| `sync-server.mjs` | ~300 | WebSocket server, file watching, imports compiler |
| `website/src/repl/Mixer.jsx` | 361 | Orchestration: state, refs, sync, keyboard, render |
| `website/src/repl/components/TrackPanel.jsx` | 231 | Per-track StrudelMirror + editor + controls |
| `website/src/repl/components/MixerToolbar.jsx` | 57 | Transport, BPM, mute-all, add-track, viz toggle |
| `website/src/repl/effects/effectDetector.mjs` | 176 | Hap → effect routing, pad/chord detection, no DOM |
| `website/src/repl/effects/CurlParticles.mjs` | 271 | Curl noise particle renderer, no Strudel imports |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| V | Toggle viz mode (particles foreground) |
| 0-9 | Toggle mute for track group |
| Ctrl+Enter | Evaluate code (in editor) |

## Based On

[Strudel](https://strudel.cc) — live coding music patterns on the web, a JavaScript port of TidalCycles. Licensed under [GNU AGPL v3](LICENSE).

- Strudel source: https://codeberg.org/uzu/strudel/
- Strudel docs: https://strudel.cc/learn
- TidalCycles community: https://discord.com/invite/HGEdXmRkzT
