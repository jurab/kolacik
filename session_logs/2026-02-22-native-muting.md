# 2026-02-22 — Native Muting, Per-Track FX, Mixer UI Polish

## Problem
Mixer mute/unmute caused audible dropouts. The compiler was omitting muted tracks entirely, so every toggle triggered `hush()` → reparse → `setPattern()` — a full re-evaluation cycle with a gap where the kick (and everything else) went silent.

## Solution: Native `_$:` Muting
Strudel has built-in muting: `_$: s("bd")` transpiles to `.p('_$')`, which returns `silence` immediately (underscore prefix check in repl.mjs:155). The scheduler's `setPattern()` is an atomic reference swap — no gap.

**Change in `sync-server.mjs` `compile()`:** Instead of `continue` for muted tracks, always include all tracks. Muted ones get `$:` → `_$:` prefix swap. The compiled code always has the same structure, patterns are just silenced natively.

## Mixer UI: Track Status Colors + Group Numbers
- Track names now colored **green** (playing) or **red** (effectively muted)
- "Effectively muted" = explicitly muted OR solo-excluded (hasSolo && !isSoloed)
- Group number prepended to track name: `3: kick`
- Opacity dimming also uses effective mute state now

## Per-Track Particle Effects via `.tag()`

**Problem:** CurlParticles mapped effects by hardcoded sample names (`bd` → burst, `hh` → jitter). No way to control which visual effect a track triggers.

**Key discovery:** Strudel has `.tag(name)` built in — adds to `hap.context.tags`, survives all pattern combinators, checkable via `hap.hasTag()`.

**Solution:**
1. Compiler injects `.tag(trackId)` on every track — haps now carry origin identity
2. New "fx" dropdown per track in mixer UI (burst, jitter, orbitPulse, tangent, flash, swell, pad, none, auto)
3. CurlParticles refactored: effect routing extracted to `_fireEffect()` + `_autoDetect()`, routes by tag when assigned, falls back to sample-name detection for "auto"
4. `trackFx` stored in `mixState` → persisted in `mix.json`

**Gotcha:** `mixStateRef` had to be moved before the `useEffect` that wires `onDraw` — the closure captured an uninitialized ref. Manifested as `trackFx:undefined` in debug output.

## Architecture Refactor

Decoupled the codebase into clean modules. Goal: swap the particle renderer without touching effect logic.

### Compiler extraction
- `compiler.mjs` (new, 31 lines) — pure function `compile(tracks, mixState) → code string`
- `sync-server.mjs` imports it, calls `compileMix()` wrapper that passes module-scoped state

### Effect detector extraction
- `effects/effectDetector.mjs` (new, 176 lines) — all hap→effect routing:
  - `detectEffects(haps, time, trackFx, state, effects)` — main entry, mutates effect accumulators directly
  - `createDetectorState()` — returns persistent cross-frame state (seenHaps, activeChordBegin)
  - Contains: `autoDetect`, `fireEffect`, `getTrackTag`, `noteToMidi`, pad/chord detection, dissonance table
  - No DOM, no canvas, no Strudel imports

### Particle renderer isolation
- `effects/CurlParticles.mjs` (moved from repl root, 271 lines) — pure animation:
  - Simplex noise, particles, curl field, orbit mechanics, canvas rendering
  - `this.effects` accumulator written by detectEffects(), consumed by animate()
  - No hap knowledge, no sample names, no Strudel imports
  - Interface: constructor, `update()` (no-op now — effects written directly), `setForeground(bool)`, `destroy()`

### Mixer component split
- `components/TrackPanel.jsx` (new, 231 lines) — per-track StrudelMirror + editor + controls
  - Takes `modulesLoading` and `presets` as props (was closure over module-scoped vars)
- `components/MixerToolbar.jsx` (new, 57 lines) — top bar with transport, BPM, mute-all, add-track, viz toggle
- `Mixer.jsx` (709 → 361 lines) — orchestration only: state, refs, sync, keyboard, handlers, render

### GlobalFxEditor removed
- Deleted component + handler from Mixer.jsx
- `globalFx` still in mixState schema (compiled if present in mix.json), just no UI

### Wiring change in onDraw
```js
// Before: CurlParticles.update(haps, time, trackFx) — mixed detection + animation
// After: detectEffects() writes directly to curlRef.current.effects
master.onDraw = (haps, time, painters) => {
  origDraw(haps, time, painters);
  detectEffects(haps, time, trackFx, fxState, curlRef.current.effects);
};
```

### README rewrite
- Replaced original Strudel README with kolacik-specific docs
- Covers: mixer, sync system, particle effects (auto table + per-track override), artifacts, compiler, architecture diagram, keyboard shortcuts

## Commits
- `2b9b96e4` — Native `_$:` muting in compiler
- `a06420f7` — Track status colors + group numbers in Mixer.jsx
- `c610c563` — Per-track particle effects via `.tag()`
- `2f3b7795` — README rewrite
- (pending) — Architecture refactor

## File Structure After Refactor
```
compiler.mjs                              (pure track compilation)
sync-server.mjs                           (WebSocket + file watching)
website/src/repl/
  Mixer.jsx                               (361 lines — orchestration)
  mixer-sync.mjs                          (unchanged)
  components/
    TrackPanel.jsx                        (231 lines — per-track editor)
    MixerToolbar.jsx                      (57 lines — top bar)
  effects/
    effectDetector.mjs                    (176 lines — hap→effect routing)
    CurlParticles.mjs                     (271 lines — pure animation)
```
