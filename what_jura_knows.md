# Jura's Strudel Knowledge State

## Actually Knows (used it, gets it)

### Pattern Basics
- `s("bd hh sd hh")` - sequencing samples
- `*4` - repeat
- `[a b]` - subdivision
- `[...]/4` - spread over N cycles
- `<a b c>` - alternate per cycle
- Nested alternation `<a <b c>>` - alternation within alternation
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
- `.lpf("<900 1600>")` - filter modulation via pattern
- `.room()` - reverb
- `.sustain()` - note duration
- wet/dry concept
- velocity = loudness

### Notes & Pitch
- `note("c3 e3 g3")` - letter notation
- `n("0 2 4")` - numeric scale indices
- `.scale("C:minor")` - scale mapping (0-indexed)
- `.add(note(12))` / `.sub(note(12))` - pitch arithmetic (MUST wrap in note()!)
- `s("sawtooth")` / `s("triangle")` - synth sounds
- GM samples: `gm_synth_bass_1`, `gm_synth_strings_1`, `gm_electric_guitar_muted`
- `.superimpose(fn)` - layer original + transformed (simultaneous)
- `.off(time, fn)` - layer with time offset (sequential)
- `.arp("0 1 2 1")` - pick notes from chord by index

### Chords & Harmony
- `[0,2,4]` - chord as simultaneous notes
- Chord construction: stack every other scale note (0,2,4 then 1,3,5 etc.)
- 7th chords: add another note `[0,2,4,6]`
- Guitar chords use 6 strings but only 3 unique notes (doubling across octaves)
- Chord progressions: sequence of chords `<[0,2,4] [3,5,7] [4,6,8]>`
- Bass follows chord roots: chord `[0,2,4]` → bass plays `0`

### Layering
- `$: pattern1` + `$: pattern2` - multiple independent patterns
- `stack(pat1, pat2)` - combine different sound sources
- Can't mix samples and notes in same `note()` - use stack or separate lines
- Typical layers: drums, bass, chords, melody

### Probability
- `.sometimes(fn)` - ~50% chance

### Controls & Visualization
- `slider(default, min, max, step)` - returns a Pattern (not a number!)
- `slider().add(200)` - pattern math for offsets (can't use `+`)
- Per-layer volume sliders for live mixing/arrangement
- `._pianoroll({labels: true})` - visualize pitched patterns
- `._punchcard()` - visualize rhythm patterns
- `setcpm(n)` - set cycles per minute

## Music Theory (learned this session)

### Core Concepts
- **Key** = home note + mood (major/minor)
- **Home** = the note that feels like resolution/ending
- **Scale** = 7 notes that belong to a key (0-6, then 7 = home again octave up)
- **Major** = bright/happy, **Minor** = dark/sad

### Harmony
- **Chord** = 3+ notes stacked (triad = 0,2,4)
- **Progression** = sequence of chords, creates tension → release
- Movement analogy: home = ground, other chords = in the air, gravity pulls back
- Common minor roots: 0, 3, 4, 5
- **Roman numerals**: i, ii, iii, iv, v, vi = chords on scale degrees 0-5
- **Strong chords**: i (home), iv, v - clear function, bold moves
- **Weak chords**: ii, iii - share notes with i, subtle moves
- **ii° (diminished)** = unstable, cliffhanger ending
- **vi** = soft landing (related to home but not resolved)

### Melody
- **Contour** = shape (up, down, peaks, valleys)
- **Rhythm** = when notes happen, pauses, syncopation
- **Repetition** = motifs that come back (makes it memorable)
- **Surprise** = establish pattern 2-3 times, break it on 4th

## Example Track (current level)

```javascript
// Full song in D minor with mixer controls
setcpm(220/4)
const lpf_base = slider(600, 600, 2000, 1)

const melody = slider(0.6,0,1,0.1)
const bass = slider(0.5,0,1,0.1)
const chords = slider(0.5,0,1,0.1)
const drums = slider(0.9,0,1,0.1)
const boom = slider(1,0,1,0.1)

// CHORDS: i → iv → v → ii°/i(high) - alternating cliffhanger/resolution
$: note("[[0, 2, 4] [3, 5, 7] [4, 6, 8] <[1, 3, 5] [7, 9, 11]>]/2")
  .scale("d:minor").lpf(lpf_base.add(200)).room(0.4)
  .sound("sawtooth").gain(chords)._pianoroll({labels: true})

// BASS - follows chord roots
$: note("[0 3 4 <1 7>]/2").scale("d:minor")
  .sound("triangle").lpf(lpf_base.add(600)).gain(bass)._pianoroll({labels: true})

// DRUMS - split kick for layered sound
$: s("~ ~ bd <sd [sd, [sd sd]]> ~ sd").bank("bossdr110").gain(drums)._punchcard()
$: s("bd ~ ~ ~ ~").bank("bossdr110").room(0.5).gain(boom).delay(0.2)._punchcard()

// MELODY - arpeggio with .every() variation
$: note("[0, 2, 4] [3, 5, 7] [4, 6, 8] <[1, 3, 5] [7, 9, 11]>")
  .every(4, x => x.add(note(7))).every(3, x => x.add(note(-7)))
  .scale("d:minor").arp("0 1 2 <0 1>").add(note(12)).slow(2)
  .sound("gm_music_box").gain(melody)._pianoroll({labels: true})
```

## Understands Conceptually (hasn't heavily used)
- `sine.range().slow()` - LFO modulation
- `.rarely()` / `.often()` - other probability levels
- `a|b` - random choice
- `a?` - probability
- `.pan()` - stereo positioning
- `.chop(n)` - slice samples into n pieces

## To Learn Next
- B sections / contrasting parts
- More effects (distortion, etc.)
- Sample manipulation (`.striate()`, `.slice()`)
- Notes outside the scale (chromatic, for intentional surprise)
- Recording/exporting tracks

## Learning Style
- Signal processing background helps with effects
- Needs visualizations (always add `._punchcard()` or `._pianoroll()`)
- Learns by poking at live code
- Direct, no hand-holding
- Wants to understand WHY things work, not just THAT they work
- **ONE CONCEPT AT A TIME** - don't overload with multiple new ideas
- Demonstrate with sound first, then explain
