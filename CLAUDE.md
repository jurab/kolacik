# Kolacik Teaching Instructions

## The Goal

Jura is learning Strudel/TidalCycles live coding from scratch. The goal is for him to independently create complex musical patterns like the ones in his screenshots - layered drums, basslines, melodic sequences with effects and modulation.

We built a sync system so Claude can push code examples directly to Jura's browser, making the feedback loop instant: Claude writes example → Jura hears it → Jura experiments → repeat.

## What Is Strudel/Kolacik

Kolacik is a fork of [Strudel](https://strudel.cc/) - a browser-based live coding environment for making music with patterns. It's a JavaScript port of TidalCycles.

**The idea:** Write code → hear music instantly. Patterns describe rhythm and melody, method chains add effects and transformations.

## Running Everything

**At session start, Claude should start both servers:**

```bash
# 1. Start the dev server (from kolacik root)
pnpm dev

# 2. Start the sync server (HTTP API + WebSocket, backed by SQLite)
node sync-server.mjs &

# 3. Open http://localhost:4321 in browser
```

## Knowledgebase

`knowledgebase/` contains music production reference books (PDFs) with an annotated `INDEX.md` mapping chapters to Kolacik features. **Consult these when building tracks** — they have genre recipes, drum patterns, chord progressions, synth patches, and music theory explanations. Read `knowledgebase/INDEX.md` first to find the right resource.

## Documentation

All learning materials are in the codebase:
- `/website/src/pages/learn/*.mdx` - tutorial pages
- Key ones: `getting-started.mdx`, `mini-notation.mdx`, `effects.mdx`, `samples.mdx`

Online (original Strudel): https://strudel.cc/learn

## Live Sync System

The sync server runs on `http://localhost:4322` (HTTP + WebSocket), backed by SQLite (`kolacik.db`).

For the **single REPL** (playground), push code by writing to:
```
/Users/jura/Git/kolacik/playground.strudel
```

**To start sync server** (if not running):
```bash
node /Users/jura/Git/kolacik/sync-server.mjs &
```

## Play/Pause Control

Claude can trigger play/stop/toggle by writing to:
```
/Users/jura/Git/kolacik/playground.cmd
```

Format is `command:timestamp` — the timestamp ensures the same command can be sent twice (file watcher ignores unchanged content). Valid commands: `play`, `stop`, `toggle`.

```bash
# Example: trigger play
echo "play:1" > playground.cmd
```

The sync server clears the file after processing. Increment the timestamp for repeated commands (e.g. `play:1`, `play:2`, etc.).

## Error Feedback

Warnings and errors sync back to me via:
```
/Users/jura/Git/kolacik/playground.errors
```

**Check this file after pushing code** to see if something silently failed. Jura also sees a toast notification in the UI.

## Mixer Interface

Multi-track mixer at `http://localhost:4321/mixer`. All track data lives in SQLite (`kolacik.db`).

### How It Works
- `sync-server.mjs` serves HTTP API + WebSocket, backed by SQLite
- All track code and mixer state stored in SQLite `pieces` table (live session = `_live` row)
- Browser connects via WebSocket, receives tracks + compiled code
- Hidden master `StrudelMirror` handles all audio; per-track editors show code + visualization
- Mute/solo per track, number keys toggle groups, BPM control
- Piece selector in toolbar to save/load sessions

### Writing Tracks via HTTP API

Claude writes tracks using the HTTP API — no files involved:

```bash
# Write a track (server compiles + pushes to browser automatically)
curl -s -X PUT http://localhost:4322/api/tracks/kick --data-binary '$: s("bd*4").lpf(800)'

# Read a track
curl -s http://localhost:4322/api/tracks/kick

# List all tracks
curl -s http://localhost:4322/api/tracks

# Delete a track
curl -s -X DELETE http://localhost:4322/api/tracks/kick
```

For multi-line track code, use heredoc:
```bash
curl -s -X PUT http://localhost:4322/api/tracks/kick --data-binary @- << 'STRUDEL'
$: s("bd ~ ~ bd ~ ~ bd ~ bd ~ ~ ~ bd ~ ~ ~")
  .gain(1.3).lpf(180)
STRUDEL
```

- Each track needs a `$:` prefix: `$: stack(s("bd"), s("sd"))` — bare `stack()` won't play
- **Do NOT use `sed` in bash** — it's aliased to `sd` (a different tool) on this system.
- **The compiler auto-injects** `.tag(trackId)` and `.orbit(n)` on every track — each track gets its own effect bus automatically.

### Managing State via HTTP API

```bash
# Read mixer state
curl -s http://localhost:4322/api/state

# Update state (partial merge)
curl -s -X PUT http://localhost:4322/api/state -H 'Content-Type: application/json' \
  -d '{"bpm":120,"muted":[],"groups":{"kick":1,"snare":2},"trackFx":{"kick":"burst","snare":"flash"}}'

# Play/stop
curl -s -X POST http://localhost:4322/api/play
curl -s -X POST http://localhost:4322/api/stop
```

### Setting Up a New Piece

1. **Write tracks** via HTTP API (one PUT per track)
2. **Set state** via HTTP API with bpm, groups, trackFx
3. **Save as piece** for later: `curl -s -X POST http://localhost:4322/api/pieces/save -d '{"name":"my-piece"}'`

**Available visual FX** (for `trackFx`): `burst` (radial push), `orbitPulse` (angular kick), `tangent` (perpendicular push), `jitter` (sparkle), `flash` (brightness), `swell` (orbit expansion), `pad` (tension noise), `none`, `auto`

Choose FX that match the instrument's character — `burst` for kicks, `jitter` for hats, `swell` for bass, etc.

### Pieces (save/load sessions)

```bash
# List saved pieces
curl -s http://localhost:4322/api/pieces

# Save current session
curl -s -X POST http://localhost:4322/api/pieces/save -d '{"name":"dub-session"}'

# Load a piece (replaces current session)
curl -s -X POST http://localhost:4322/api/pieces/load -d '{"name":"dub-session"}'

# Delete a piece
curl -s -X DELETE http://localhost:4322/api/pieces/dub-session
```

Pieces are also accessible from the browser via the toolbar dropdown.

### Troubleshooting
- **"webpage reloaded because a problem occurred"**: Safari tab crashed, probably a StrudelMirror init error. Restart astro dev server (`pnpm dev`), then reload.
- **Astro dev server dies silently**: Check with `pgrep -f astro`. If dead, restart with `pnpm dev`.
- **Browser not updating**: Restart sync server, refresh browser.

## Common Gotchas

Things that fail silently in Strudel - watch out for these:

- **`.add(12)` doesn't work** - must wrap in `note()`: `.add(note(12))`
- **Can't mix samples and notes** - `note("c3, hh")` breaks because `hh` isn't a pitch. Use `stack()` or separate `$:` lines
- **Out-of-range notes** - `note("c90")` produces silence (TODO: add warning)
- **Core package changes need hard refresh** - HMR doesn't always pick them up

### Mini-Notation Traps
- **`.` is NOT a rest** — it means "elongate previous event." Use `~` for rests.
  - WRONG: `struct("x.x.x.x.")` — the `.` extends each `x`, everything is true
  - RIGHT: `struct("x ~ x ~ x ~ x ~")` or just spell out the pattern directly
- **For 16-step drum grids**, use explicit mini-notation with `~` for rests:
  ```
  s("bd ~ ~ bd ~ ~ bd ~ bd ~ ~ ~ bd ~ ~ ~")
  ```
  Each position = one 16th note. This maps 1:1 to drum machine grid notation.
- **Don't bake `._punchcard()` into track code** for the mixer — 8 tracks each running their own punchcard visualization crashes Safari. Use the per-track viz dropdown instead.
- **Visualizations in mixer tracks**: The per-track StrudelMirror in the mixer evaluates code for highlighting. Heavy visualization methods in the code itself (punchcard, pianoroll) multiply across all tracks and crash the browser.

## Student Profile: Jura

### Background
- Roboticist with signal processing knowledge
- 0 music theory
- 12 years software engineering

### Learning State
See `session_logs/what_jura_knows.md` for detailed state.

### Understood Conceptually, Not Used Yet
- Random choice `a|b`, probability `a?`

### Seen Claude Use, Not Practiced Yet
- LFO modulation `sine.range().slow()`, `saw.range()`
- `.chop()` for granular sample slicing
- `slider(value, min, max)` for interactive UI controls
- `mix.range(from, to)` for mapping slider to parameter ranges
- Song structure with `<>.slow(N)` for sequential sections
- `.shape()` for distortion/saturation
- `.orbit()` for separate effect buses
- Artifacts saved in `artifacts/02-techno-drop/` and `artifacts/03-stutter-crossfade/` to study

## Teaching Approach
- Teach music theory as needed - Jura wants to learn it, just starts from zero. Use signal processing analogies where helpful.
- Be direct, no hand-holding
- Push examples directly to REPL via playground.strudel
- Let him experiment and build intuition
- **Check playground.strudel regularly** to see what Jura is experimenting with - this is a dialogue over live code, not one-way teaching
- Always add visualizations - pick what fits the concept:
  - `._punchcard()` - rhythm grids, euclidean patterns
  - `._pianoroll()` - melodies, notes
  - `._scope()` - waveforms, signal stuff
  - `._spiral()` - cyclical patterns

### Critical: One Concept at a Time
When teaching music theory (or any new domain), go **ONE CONCEPT AT A TIME**:
1. Introduce ONE idea
2. Push a sound example that demonstrates it
3. Let Jura experiment
4. Only then move to the next concept

If you dump multiple concepts at once (e.g., "key = home + scale + major/minor + sharps/flats"), Jura will say "one thing at a time man" and you'll have to backtrack. Demonstrate with SOUND before explaining with words - his ear learns faster than reading explanations.

Use analogies to his domain when possible:
- Harmony/tension → dynamical systems, equilibrium states
- Home note → attractor
- Progression → trajectory through state space
