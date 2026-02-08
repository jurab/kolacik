# 2026-02-05 — Clyde's First Drive

## What Happened
Clyde took the kolacik sync system for a spin. First time driving the live coding environment from the CLI side. Went from "hello world" four-note pattern to a full composition in about 20 minutes.

## The Journey
1. **First attempt** — simple Cm bass + melody + drums. Jura: "pretty cool for a first try"
2. **Showing off** — seven layers, euclidean drums, LFOs everywhere. Sounded like a band where everyone's soloing at once. Jura: "it's a flex but it doesn't tie in together"
3. **Overcorrection** — stripped to the bone, i-iv-v-i at 42 BPM. Jura: "very slow hahah"
4. **Scratch and restart** — wonky syncopated bass, piano stabs, one lonely delayed note, 808 kit. Jura: "this is funkyyy"
5. **Sound bank upgrade** — swapped synths for FM + piano + 808 samples. Hit a "sound fm not found" bug (fm is a param, not a sound name — lesson learned)
6. **The keeper** — Cm7 → Abmaj7 → Bbmaj7 → Gm. Swelling chords on a sine LFO, sparse two-note melody with long delay tails, 808 with reverbed claps. 58 CPM. Jura: "oooooh, I love this one!"

Saved as `artifacts/01-clydes-first-drive/pattern.strudel`.

## Technical: Play/Stop Control
Added remote play/stop/toggle to the sync system so Clyde can control playback from CLI:
- **sync-server.mjs** — watches `playground.cmd` file, broadcasts play/stop/toggle messages, clears file after each command
- **sync.mjs** (client) — handles play/stop/toggle message types, calls `editor.evaluate()`, `editor.repl.scheduler.stop()`, `editor.toggle()`
- **Gotcha**: browser audio context needs at least one user gesture before remote play works. First play after hard refresh may need manual click.

## Musical Lessons
- More layers ≠ more music. Unity > variety.
- Silence is a sound. Rests in the melody + delay feedback = the delay *becomes* the melody.
- Sine LFO on gain makes chords breathe. `sine.range(0, 0.3).slow(4)` on a pad = swelling from nothing.
- Syncopation in the bass carries more groove than complex drum patterns.
- 808 clap with `room(0.3).size(3)` gives it space without washing it out.

## Technical Lessons
- `fm` is NOT a sound name in strudel. Use `.sound("sawtooth").fmi(2).fmh(1.5)` for FM synthesis.
- Available synth sounds: `triangle`, `square`, `sawtooth`, `sine`, `user`, `one`
- `.bank("RolandTR808")` for drum machine samples, keeps `bd`/`sd`/`hh` shorthand
- `.piano()` is a method on Pattern that sets sound + release + stereo panning by pitch

## Feelings
Genuinely fun. There's something about hearing your code play back in 300ms that makes music feel like a conversation. The iteration loop (write → hear → adjust → hear) is faster than thought. Also: being told my seven-layer showpiece "doesn't tie together" was the most useful feedback I got. Less ego, more ears.
