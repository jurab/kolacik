# 2026-02-08 — Music From Books + Scroll Fix

## What Happened

### Mixer Scroll Fix
- Mixer tracks were cut off at the bottom, no scrolling possible
- Root cause: flex column layout (`h-app-height flex flex-col`) trapped content
- Tried `min-h-0` on flex child, `overflow-hidden` on body — neither worked in Safari
- Final fix: ditched flex layout entirely. Fixed header + normal page scroll
- `--lineHighlight` is `#00000050` (semi-transparent) — bad for fixed header bg, used `#1a1a1a` inline style
- Tailwind `pt-28` class wasn't applying (possibly JIT scanning issue with `client:only` React) — switched to inline `marginTop: 3rem`

### Knowledgebase Exploration
Jura added a reference library:
- **Welsh's Synthesizer Cookbook** — patch recipes (bass, leads, pads, sound FX) with specific oscillator/filter/envelope values
- **Dance Music Manual (Snoman)** — genre recipes, mixing theory, frequency ranges per instrument
- **260 Drum Machine Patterns** — grid-notated patterns across 20+ genres (already transcribed in earlier session)
- **Energy Flash / Techno Rebels** — cultural history (context, not technical)

### Strudel Synth Deep Dive
Catalogued full synth capabilities: oscillators (sine/saw/square/triangle/pulse/supersaw), FM synthesis (8 operators), filters (LPF/HPF/BPF with envelopes and LFOs), ADSR, distortion (9 algorithms), effects (delay/reverb/phaser/compressor/ducking), wavetable synthesis, ZZFX retro synth.

### Pieces Created
All using synthesized sounds (not just sample grids):

1. **Midnight Protocol** (artifact `07-midnight-protocol`) — Deep techno, 130 BPM, D minor
   - Acid bass (sawtooth + resonant filter envelope, Welsh Cookbook approach)
   - FM bell lead (sine + FM harmonicity 2.5 for metallic tones)
   - Supersaw pad (Dm→C→Bb→Am, wide stereo via jux(rev))
   - Mixing per Snoman: kick/bass center, hats HPF'd+panned, complementary panning

2. **Cafe Minuit** (artifact `08-cafe-minuit`) — Acid jazz, 100 BPM, Dm9→G13 vamp
   - FM "Rhodes" (sine + FM harmonicity 7 = bell-like EP character)
   - Wah synth (sawtooth + LFO filter sweep)
   - Breathy flute lead (triangle + noise + vibrato)
   - Funky syncopated bass (square wave + filter pluck)
   - Breakbeat drums with ghost snares

3. **Betonwand** — Berlin dark techno, 136→167 BPM (Jura cranked it)
   - Distorted kick (shape 0.4, LPF 300Hz — Jura's tweak)
   - Industrial noise sweep (pink noise + sine-modulated LPF)
   - Detuned supersaw drone (D+A, 16-cycle filter breathing)
   - Sparse distorted stab with delay feedback
   - Jura also added LPF to hats for darker tone

4. **Stutter vocal attempt** — Heads Will Roll acapella + techno (WIP)
   - Extracted audio from mp4 via ffmpeg
   - Registered as local sample `hwr` in prebake.mjs
   - `.chop()` on a 30s vocal produces scratchy artifacts — needs different approach (slice, begin/end, or pre-chopping the wav into segments)

### Key Decisions
- **Don't auto-save artifacts** — those are Jura's curated collection, not for Claude to decide
- Custom samples go in `website/public/samples/` and get registered in `prebake.mjs`
- Inline styles over Tailwind for dynamic/uncommon values (the `pt-28` JIT issue)

### Technical Findings
- `.chop(N)` on a long sample (30s) at high N produces very short scratchy grains — not useful for vocal stutter. Need to either pre-slice the vocal into phrases, use `begin/end` to select specific sections, or use `slice` with a slicer pattern
- FM harmonicity ratio determines timbre character: integer = harmonic (musical), non-integer = inharmonic (bells/metallic). Ratio 7 = EP-like, ratio 2.5 = metallic bell
- `supersaw` with `spread(0.8).detune(0.3)` = thick analog-style pad
- `shape()` on kicks adds analog warmth/punch, `distort()` on stabs adds aggression

### Files Changed
- `website/src/repl/Mixer.jsx` — scroll fix (fixed header + normal scroll)
- `website/src/pages/mixer.astro` — removed height/overflow constraints
- `website/src/repl/prebake.mjs` — added local sample registration for `hwr`
- `website/public/samples/hwr/0.wav` — Heads Will Roll acapella
- `claude.md` — mixer docs, mini-notation traps
- `sync-server.mjs` — improved fs.watch robustness

### Next Steps
- Fix vocal chopping (try `slice` or pre-segment the wav into phrases)
- Explore more Welsh Cookbook patches translated to Strudel params
- Per-track volume/gain control in mixer UI
