# Jura's Strudel Knowledge State

## Actually Knows (used it, gets it)

### Pattern Basics
- `s("bd hh sd hh")` - sequencing samples
- `*4` - repeat
- `[a b]` - subdivision
- `<a b c>` - alternate per cycle
- `~` - rest
- `:2` - sample variation (second sample)
- `.fast()` / `.slow()` - speed modifiers
- `.gain()` - volume

### Timing & Structure
- `a(3,8)` - euclidean rhythm
- `{a b c}%2` - polymetric
- `.struct("x ~ x")` - rhythmic gate
- `.mask("1 0 1 1")` - binary gate (like struct but 1/0)
- `.iter(n)` - rotate pattern each cycle
- `.every(n, fn)` - apply function every nth cycle
- `rev` - reverse pattern
- `,` - parallel/stacking within pattern

### Effects & Modulation
- `.off(time, fn)` - pattern copy with offset + transform
- `.jux(fn)` - stereo split
- `.delay()` / `.delaytime()` / `.delayfeedback()` - echo
- `.echo(count, time, decay)` - stutter/echo
- `.lpf()` / `.hpf()` - filters
- wet/dry concept
- velocity = loudness

### Notes & Pitch
- `note("c3 e3 g3")` - letter notation
- `n("0 2 4")` - numeric indices
- `.scale("C:major")` - scale mapping (0-indexed)
- `.add(note(12))` - pitch arithmetic (MUST wrap in note()!)
- `s("sawtooth")` - synth sounds
- `.superimpose(fn)` - layer original + transformed (simultaneous)
- `.off(time, fn)` - layer with time offset (sequential)
- `.arp("0 1 2 1")` - pick notes from chord by index

### Layering
- `$: pattern1` + `$: pattern2` - multiple independent patterns
- `stack(pat1, pat2)` - combine different sound sources
- Can't mix samples and notes in same `note()` - use stack or separate lines

### Probability
- `.sometimes(fn)` - ~50% chance

## Understands Conceptually (hasn't heavily used)
- `sine.range().slow()` - LFO modulation
- `.rarely()` / `.often()` - other probability levels
- `a|b` - random choice
- `a?` - probability
- `.pan()` - stereo positioning
- `.chop(n)` - slice samples into n pieces

## Doesn't Know Yet
- Chords (what they are, how to build them)
- Most effects beyond filter/delay/echo
- `.striate()`, `.slice()` - other sample manipulation
- Control patterns in depth

## Music Theory
- **Basically none** - but grasps scales as "indexed note sets"
- Plays guitar as a beginner

## Learning Style
- Signal processing background helps with effects
- Needs visualizations (always add `._punchcard()` or `._pianoroll()`)
- Learns by poking at live code
- Direct, no hand-holding
- Wants to understand WHY things fail, not just THAT they fail
