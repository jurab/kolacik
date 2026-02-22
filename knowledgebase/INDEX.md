# Knowledgebase Index

Reference library for building Kolacik — a music learning workbench.

## Resources

### 1. Dance Music Manual — Rick Snoman, 4th Ed (2019)
**File:** `dance-music-manual-snoman.pdf` (38 MB)
**Type:** Production bible — the single most useful reference for everything we build.
**PDF offset:** PDF page = book page + 15 (e.g., book p.413 → PDF p.428)

| Chapters | Topic | Kolacik Relevance |
|---|---|---|
| 5 | Science of frequency & amplitude | Foundation for understanding synth params |
| 6-8 | Synthesizers (subtractive, FM, wavetable, modular) | Sound design features, synth parameter UI |
| 9 | Theory of sound design | How to think about creating sounds from scratch |
| 10 | Samplers | Understanding sample manipulation (chop, slice, etc.) |
| 11 | Compressors | Dynamics processing — maps to Strudel `.compress()` |
| 12-13 | Further processors & Effects | Delay, reverb, chorus, flanger, phaser — all available in Strudel |
| 16 | **Fundamentals of rhythm** | Core teaching material — time signatures, subdivisions, swing |
| 17 | **Kicks and percussion** | Sound design recipes for drum sounds |
| 18 | **Creating drum loops** | Patterns per genre — directly translatable to mini-notation |
| 19 | **Fundamentals of music theory** | Scales, intervals, keys — what Jura needs next |
| 20 | **Chords and harmony** | Chord construction, progressions — on the learning roadmap |
| 21-23 | Composing strings, leads, bass | Genre-specific composition techniques |
| 24 | Sound effects | Risers, sweeps, impacts — useful for transitions |
| 26 | **Formal structure in dance music** | Intro/breakdown/drop/outro — song arrangement |
| 27 | **House** | Genre recipe: tempo, drum patterns, bass, chords, structure |
| 28 | **Techno** | Genre recipe: tempo, drum patterns, textures, structure |
| 29 | **Trance** | Genre recipe: arpeggios, pads, buildups |
| 30 | **Dubstep** | Genre recipe: half-time, wobble bass, sub bass |
| 31 | **Ambient/Chill** | Genre recipe: textures, pads, space |
| 32 | **Drum & Bass** | Genre recipe: breakbeats, reese bass, fast tempos |
| 33 | **Dub** | Genre recipe: delay, reverb, space, bass |
| 34-36 | Mixing & mastering | Mix balance, EQ, compression chains |

### 2. Welsh's Synthesizer Cookbook — Fred Welsh, 3rd Ed (2006)
**File:** `synthesizer-cookbook-welsh.pdf` (1.5 MB, 27 pages)
**Type:** Patch recipe book — specific parameter values for recreating sounds on subtractive synths.

**Structure:**
- Pages 1-27: Theory (oscillators, harmonics, filters, envelopes, LFOs)
- Pages 29-44: Reverse engineering & harmonic analysis
- Pages 47-56: How to program patches (parameter reference)
- Pages 57+: **The recipes** — each patch specifies:
  - Oscillator waveforms, tuning, mix levels
  - Filter cutoff (24dB and 12dB values), resonance, envelope amount
  - Filter & amp ADSR values (in seconds/percentages)
  - LFO routing, waveform, frequency, depth
  - Glide, unison, voice count

**Patch Categories:**
| Category | Patches | Notes |
|---|---|---|
| Strings | Banjo, Cello, Double Bass, Dulcimer, Guitar (acoustic/electric), Harp, Hurdy Gurdy, Kora, Lute, Mandocello, Mandolin, Riti, Sitar, Standup Bass, Viola, Violin | |
| Woodwinds | Bagpipes, Bass Clarinet, Bassoon, Clarinet, Conch Shell, Contrabassoon, Didgeridoo, English Horn, Flute, Oboe, Piccolo | |
| Brass | French Horn, Harmonica, Penny Whistle, Saxophone, Trombone, Trumpet, Tuba | |
| Keyboards | Accordion, Celeste, Clavichord, Electric Piano, Harpsichord, Organ, Piano | |
| Vocals | Angels, Choir, Female Vocal, Male Vocal, Whistling | |
| Tuned Perc | Bell, Bongos, Conga, Glockenspiel, Marimba, Timpani, Xylophone | |
| Untuned Perc | Bass Drum, Castanets, Clap, Claves, Cowbell (real + analog), Cymbal, Side Stick, Snare, Tambourine, Wheels of Steel | |
| **Leads** | Brass Section, Mellow 70s Lead, Mono Solo, New Age Lead, R&B Slide, Screaming Sync, Strings PWM, Trance 5th | Directly useful for live coding |
| **Bass** | Acid Bass, Bass of the Time Lords, Detroit Bass, Deutsche Bass, Digital Bass, Funk Bass, Growling Bass, Rez Bass | Directly useful for live coding |
| **Pads** | Android Dreams, Aurora, Celestial Wash, Dark City, Galactic Cathedral, Galactic Chapel, Portus, Post-Apocalyptic, Sync Sweep, Terra Enceladus | Directly useful for live coding |
| Sound FX | Cat, Digital Alarm Clock, Journey to the Core, Kazoo, Laser, Motor, Nerd-O-Tron 2000, Ocean Waves, Positronic Rhythm, Space Attack!, Toad, Wind | Fun extras |

**Kolacik use:** These recipes can be translated into Strudel synth parameters. Could power a "preset browser" or "sound design assistant" feature. The ADSR/filter/LFO values map directly to Strudel's `.attack()`, `.decay()`, `.sustain()`, `.release()`, `.cutoff()`, `.resonance()`, etc.

### 3. 260 Drum Machine Patterns — Rene-Pierre Bardet / Hal Leonard (1987)
**File:** `260-drum-patterns-scan.pdf` (2 MB, scan with OCR)
**Type:** Grid-notated drum patterns across 20+ genres.
**OCR quality:** Poor — instrument labels readable but grid fills (black/white boxes) don't survive text extraction. Needs visual reading or manual transcription.

**Genres covered (pattern count + breaks):**
| Genre | Patterns | Breaks |
|---|---|---|
| Afro-Cuban | 9 | 6 |
| Blues | 6 | 3 |
| Boogie | 3 | 3 |
| Bossa Nova | 6 | 3 |
| Cha Cha | 3 | 3 |
| Disco | 12 | 9 |
| Funk | 15 | 15 |
| Jazz | 6 | 3 |
| March/Tango | 3 | 3 |
| Paso Doble/Charleston | 3 | 3 |
| Pop | 12 | 6 |
| Reggae | 12 | 9 |
| Rock | 15 | 12 |
| Rhythm & Blues | 12 | 6 |
| Samba | 6 | 3 |
| Shuffle | 6 | 3 |
| Slow | 12 | 6 |
| Swing | ? | 3 |
| Twist | ? | 3 |
| Waltz | ? | 3 |

**Grid format:** 16-step (4/4 time, sixteenth note resolution) or 12-step (12/8 / triplet feel).
**Instruments:** AC (accent), CH (closed hi-hat), OH (open hi-hat), BD (bass drum), SD (snare), CY (cymbal), LT/MT/HT (toms), RS (rim shot), CPS (claps), CB (cowbell), TAM (tambourine).
**Flams:** Marked with "F" before the note — a grace note just before the beat.

**Kolacik use:** Each grid pattern maps 1:1 to Strudel mini-notation. A 16-step BD pattern like `x...x..xx.......` becomes `s("bd*16").struct("x...x..xx.......")`. This is the most directly actionable resource for a pattern library feature. Needs manual transcription from the scan though.

### 4. Energy Flash — Simon Reynolds (2012)
**File:** `energy-flash-reynolds.pdf` (3.1 MB)
**Type:** Cultural history of rave and dance music. Not technical.

**Covers:** Detroit techno origins → Chicago house → acid house UK rave → madchester → hardcore → jungle → DnB → trip hop → trance → UK garage → 2step → grime → dubstep. 24 chapters spanning 1980s-2010s.

**Kolacik use:** Context and inspiration. When building genre presets or teaching "what is techno?", this provides the cultural DNA — what scenes were reacting to, why genres evolved the way they did. The chapter structure maps to a genre timeline.

### 5. Techno Rebels — Dan Sicko, 2nd Ed (2010)
**File:** `techno-rebels-sicko.pdf` (2.3 MB)
**Type:** Deep Detroit techno history. The origin story.

**Covers:** Pre-history (1978-83) → first artists emerge (1981-89, Juan Atkins/Derrick May/Kevin Saunderson) → UK rave crossover → Detroit underground 90s → myth vs reality → future of techno.

**Kolacik use:** Backstory for the "Detroit Bass" and "Deutsche Bass" patches from the Welsh Cookbook. Cultural context for techno production techniques.

### 6. Sound On Sound — Synth Secrets (online, 63 parts)
**Link:** https://www.soundonsound.com/series/synth-secrets-sound-sound
**Type:** Deep synthesis tutorial series by Gordon Reid (1999-2003).

**Key sections:**
| Parts | Topic |
|---|---|
| 1-9 | Fundamentals: waveforms, filters, envelopes, VCAs |
| 10-13 | Modulation: AM, FM |
| 14-15 | Additive synthesis, vocoders |
| 16-21 | Digital: S&H, polyphony, digital synths |
| 22-23 | Physical modeling, formant synthesis |
| 24-30 | Synthesizing wind/brass/strings/guitar |
| 31-39 | Synthesizing percussion (timpani, bass drum, snare, cymbals) |
| 40-45 | Bells, cowbells, claves, pianos |
| 46-48 | String machines, PWM, bowed strings |
| 49-63 | (Additional topics) |

**Kolacik use:** The deepest reference for understanding *why* synth parameters sound the way they do. When the Welsh Cookbook says "set resonance to 40%", Synth Secrets explains what that actually means physically. Essential for a sound design teaching feature.

---

## Cross-Reference: Feature Ideas × Resources

| Kolacik Feature | Primary Source | Supporting Sources |
|---|---|---|
| **Pattern library / drum presets** | 260 Drum Patterns | Dance Music Manual ch 16-18 |
| **Genre templates** (techno, house, dnb...) | Dance Music Manual ch 27-33 | Energy Flash (context), 260 Drum Patterns |
| **Synth preset browser** | Welsh Cookbook patches | Synth Secrets (theory), DMM ch 6-9 |
| **Sound design assistant** | Welsh Cookbook + Synth Secrets | DMM ch 9 (theory of sound design) |
| **Music theory teaching** | DMM ch 19-20 | — |
| **Song structure guide** | DMM ch 26 | Genre chapters for specific structures |
| **Bass design recipes** | Welsh Cookbook (Bass section) | DMM ch 23 (composing bass) |
| **Lead design recipes** | Welsh Cookbook (Leads section) | DMM ch 22 (composing leads) |
