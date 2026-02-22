# 2026-02-22 — Curl Noise Particle Visualization

## What Happened

### Bulk Commit
Committed everything accumulated since last session (artifacts, knowledgebase PDFs, samples, mixer cleanup, session logs). 52 files.

### Particle Visualization — Phase 1
Ported curl noise particle system from `poems/artifacts/13-cloud` into the mixer as a background layer.

**Architecture:**
- `CurlParticles.mjs` — standalone JS class (not React), same pattern as StrudelMirror
- Inlined 2D simplex noise (~80 lines) to avoid npm dependency
- 1200 particles flowing via curl noise derivatives
- Own `<canvas>` at `position:fixed`, separate from Strudel's `#test-canvas`
- Fade trail rendering (`rgba(0,0,0,fade)` fill each frame) creates motion blur

**Mixer integration:**
- Instantiated in `Mixer.jsx` useEffect, destroyed on unmount
- Semi-transparent track panel backgrounds (`rgba(26,26,26,0.85)`) so particles show through
- Mixer outer div background set to transparent, body stays opaque dark

### Viz Mode Toggle
Two-mode system for the mixer:

1. **Edit mode** (default) — particles behind at z-index 1, full mixer UI, fade trails on black
2. **Viz mode** — particles foreground at z-index 5 (below toolbar z-10), transparent canvas (clearRect each frame, no trails), track controls fade out, editors dim to 0.5, track names stay visible

Toggle via toolbar button or `V` key (skips when focused in editor/input).

### Z-Index Bug
Initial attempt with `z-index: 0` on particle canvas caused track controls to disappear (visible only during resize). Fixed by giving particle canvas `z-index: 1` and mixer content wrapper `position: relative; z-index: 2`.

### Key Decisions
- **Separate canvas** — don't reuse Strudel's `#test-canvas` (shared with painters, uses `willReadFrequently`)
- **Inline simplex noise** — avoid dependency for ~100 lines of stable math
- **Foreground mode uses clearRect** — loses motion blur trails but gains transparency. Tradeoff accepted for now.
- **Phase 2 stub ready** — `update(haps, time)` method exists, effect accumulators defined, just needs wiring to master StrudelMirror's Drawer

### Files Changed
- `website/src/repl/CurlParticles.mjs` — NEW, particle engine
- `website/src/repl/Mixer.jsx` — integration, viz mode toggle, semi-transparent backgrounds

### Particle Tuning
Iterated on the base cloud behavior:
- **Orbit model** — replaced pure curl noise flow with orbital motion around screen center + noise perturbation. Each particle has its own radius and angle, all rotating clockwise with slight speed variation.
- **Slower, calmer** — halved noise speed/evolution so effects (phase 2) will be salient against the base state
- **Bigger/brighter** — 2x2px dots, alpha 0.9, much more visible
- **No fade trails** — switched to `clearRect` in both modes (discrete dots look better than ghosting)
- **DPR fix** — dropped devicePixelRatio scaling, was causing canvas offset on retina

### Phase 2: Kick Burst (first music reactivity!)
Wired the master StrudelMirror's Drawer → `CurlParticles.update(haps, time)`.

**Critical bug found & fixed:** The Drawer's `visibleHaps` includes events across a lookbehind window. The same hap with `hasOnset()=true` gets delivered on every frame while it's in the window — NOT just once. Deduplication needed: track seen haps by `${sample}_${whole.begin}` identity in a Set.

**Architecture:**
- `update()` iterates haps, filters to new onsets via dedup Set
- Kick (`bd`/`kick`) sets `effects.burst` — consumed once in `animate()`, then zeroed
- Per-particle `fx/fy` displacement: burst pushes radially from center, decays at 0.88/frame
- Base position (`p.x/p.y`) never disturbed by effects — always returns to orbit

**Debug channel added:**
- `sendDebug(msg)` in `mixer-sync.mjs` → WebSocket → sync server → appends to `playground.debug`
- Invaluable for debugging: can read from CLI without touching browser console

### Bass Swell
- Bass notes expand orbit radii — lower pitch = bigger swell (E1→1.8x, A1→1.5x)
- Swell is NOT multiplied by gain/velocity — it's a radius multiplier where 1.0=neutral, so scaling by gain<1 killed it
- Uses `Math.max` not additive — chords take the lowest note's swell, no stacking
- Decay: `swell += (1 - swell) * 0.03` — slow ease back to normal
- Note detection: `hap.value.note` can be string ("a1") or MIDI number. Added `_noteToMidi()` parser.
- Bumped particles to 3000 for denser cloud

### Clap → Orbit Speed Pulse (session 2)
- On `cp`/`clap`/`sd`/`sn` onset, adds angular velocity to all particles — cloud "twitches" forward in its orbit
- **Key lesson:** multiplying the base `orbitSpeed` was invisible — it's too slow (~0.0009 rad/frame). Switching to additive `orbitPulse * 0.02` rad/frame made it salient (~35° total rotation per hit)
- Decay 0.92, so the twitch lingers slightly (matches reverb tail on clap)

### Hats → Noise Jitter (session 2)
- On `hh`/`oh`/`ch` onset, adds random per-particle displacement — sparkle/static effect
- Fresh random each frame (not accumulated into `p.fx/p.fy`) — disappears cleanly when decay hits zero
- Started at 8px, bumped to 20px for visibility. Decay 0.8 = fast, gone in ~15 frames.
- Scaled by `gain * velocity` so varying hat velocities show different sparkle intensity

### Perc → Tangential Push (session 2)
- On `rim`/`clave`/`cowbell` onset, pushes particles perpendicular to radial (sideways shove)
- 24px peak (bumped from 8 after testing), decays via existing `p.fx/p.fy *= 0.88`
- Same one-shot consume pattern as kick burst

### Pad → Tension-Driven Noise Modulation (session 2)
- Detects chords: 3+ simultaneous synth notes = chord (vs single note = bass)
- Computes **harmonic tension** from pairwise interval dissonance (lookup table, no music theory infrastructure needed)
- Maps tension to three axes: evolution speed, noise strength, orbit ease
- Root pitch still maps to noise scale separately
- Clean triads (Am, F) → tension ~0.2 → calm cloud. Diminished/cluster → tension ~0.8 → turbulent
- **Key architectural insight:** auto-detecting instrument type from sample names is fragile. Next step: explicit per-track effect assignment via UI dropdown, injected into haps at compile time via `.set({_fx: 'kick'})`

### Next Steps
- [ ] Hats → noise jitter (sparkle/static on hit)
- [ ] Perc → tangential push (perpendicular to radial)
- [ ] Pad → noise scale modulation (sustained, not one-shot)
- [ ] Stab → brightness flash (short synth hits)
- [ ] Text crystallization — port `extractTextPixels()` from 13-cloud
- [ ] Consider motion blur in foreground mode (lower per-particle alpha instead of clearRect?)
- [ ] Per-instrument color coding for particles
