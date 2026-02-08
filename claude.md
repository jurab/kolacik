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

# 2. Start the sync server (enables Claude to push code to browser)
node sync-server.mjs &

# 3. Open http://localhost:4321 in browser
```

## Documentation

All learning materials are in the codebase:
- `/website/src/pages/learn/*.mdx` - tutorial pages
- Key ones: `getting-started.mdx`, `mini-notation.mdx`, `effects.mdx`, `samples.mdx`

Online (original Strudel): https://strudel.cc/learn

## Live Sync System

I can push code directly to Jura's browser by writing to:
```
/Users/jura/Git/kolacik/playground.strudel
```

The sync server (running on `ws://localhost:4322`) watches this file and pushes changes to the browser in ~300ms.

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

Multi-track mixer at `http://localhost:4321/mixer`. Each track is a `.strudel` file in `/tracks/`.

### How It Works
- `sync-server.mjs` watches `/tracks/*.strudel` + `mix.json`, compiles them into `mix.strudel`
- Browser connects via WebSocket, receives tracks + compiled code
- Hidden master `StrudelMirror` handles all audio; per-track editors show code + visualization
- Mute/solo per track, number keys toggle groups, BPM control, global FX editor

### Writing Tracks from CLI
- Each track file needs a `$:` prefix: `$: stack(s("bd"), s("sd"))` — bare `stack()` won't play
- **Do NOT use `sed` in bash** — it's aliased to `sd` (a different tool) on this system. Use the Write/Edit tools or python for file modifications.
- After writing tracks, verify with `cat mix.strudel` that all tracks compiled
- If tracks disappear: restart sync server (`kill` + `node sync-server.mjs &`), then refresh browser
- macOS `fs.watch` can get confused by rapid file writes. The watcher has a 300ms debounce + ENOENT retry, but if many files are written simultaneously it can still lose tracks. Write files via the Write tool (which is sequential) rather than parallel bash commands.

### Artifacts (save/load pieces)
- `./save-piece.sh <name>` — saves current tracks + mix.json to `artifacts/<name>/`
- `./load-piece.sh <name>` — loads saved piece into `/tracks/`

### Troubleshooting
- **Tracks disappear from mixer**: The macOS fs.watch watcher got confused. Restart sync server, refresh browser.
- **Editors show but are empty**: Likely stale WebSocket state. Restart sync server, refresh browser.
- **"webpage reloaded because a problem occurred"**: Safari tab crashed, probably a StrudelMirror init error. Restart astro dev server (`pnpm dev`), then reload.
- **Astro dev server dies silently**: Check with `pgrep -f astro`. If dead, restart with `pnpm dev`.
- **Browser console empty on mixer page**: Component isn't mounting. Restart astro dev server.

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

### Already Knows
See `what_jura_knows.md` for detailed state. Highlights:
- All pattern basics (sequencing, subdivision, alternation, rests)
- Euclidean rhythms, polymetric, struct, mask, iter, every
- Effects: off, jux, delay, echo, filters
- Notes: letter notation, scale indices, add (with note wrapper), arp
- Layering: stack, multiple $: lines

### To Learn
- [ ] Chords - what they are, how to construct them
- [ ] More effects beyond filter/delay
- [ ] Control patterns in depth

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
