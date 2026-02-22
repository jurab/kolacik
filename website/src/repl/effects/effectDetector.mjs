// effectDetector.mjs — Hap → effect routing
// Reads Strudel haps, resolves track tags, maps to effect accumulators.
// Pure logic — no animation, no canvas, no DOM.

// Dissonance lookup — interval (semitones mod 12) → score 0-1
const DISSONANCE = [0, 1, 0.8, 0.3, 0.2, 0.1, 0.9, 0.05, 0.4, 0.3, 0.7, 0.85];
const SYNTH_SET = ['sawtooth', 'sine', 'triangle', 'square'];

function noteToMidi(note) {
  if (typeof note === 'number') return note;
  if (typeof note !== 'string') return null;
  const match = note.match(/^([a-gA-G])(#|b)?(\d+)$/);
  if (!match) return null;
  const semis = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let midi = semis[match[1].toLowerCase()];
  if (midi == null) return null;
  if (match[2] === '#') midi++;
  if (match[2] === 'b') midi--;
  midi += (parseInt(match[3]) + 1) * 12;
  return midi;
}

function getTrackTag(hap) {
  const tags = hap.context?.tags;
  if (!tags || tags.length === 0) return null;
  return tags[tags.length - 1];
}

function fireEffect(effects, effect, hap, intensity) {
  const note = hap.value?.note;
  switch (effect) {
    case 'burst':
      effects.burst = Math.max(effects.burst, 8 * intensity);
      break;
    case 'orbitPulse':
      effects.orbitPulse = Math.max(effects.orbitPulse, 3 * intensity);
      break;
    case 'tangent':
      effects.tangent = Math.max(effects.tangent, 24 * intensity);
      break;
    case 'jitter':
      effects.jitter = Math.max(effects.jitter, 20 * intensity);
      break;
    case 'flash':
      effects.flash = Math.max(effects.flash, 1.5 * intensity);
      break;
    case 'swell':
      if (note != null) {
        const midi = noteToMidi(note);
        if (midi != null && midi < 52) {
          const swellAmount = 1.3 + (1 - (midi - 24) / 28) * 0.5;
          effects.swell = Math.max(effects.swell, swellAmount);
        }
      }
      break;
  }
}

function autoDetect(effects, hap, intensity) {
  const s = hap.value?.s;
  const note = hap.value?.note;

  if (s === 'bd' || s === 'kick') fireEffect(effects, 'burst', hap, intensity);
  if (s === 'cp' || s === 'clap' || s === 'sd' || s === 'sn') fireEffect(effects, 'orbitPulse', hap, intensity);
  if (s === 'rim' || s === 'clave' || s === 'cowbell') fireEffect(effects, 'tangent', hap, intensity);
  if (s === 'hh' || s === 'oh' || s === 'ch') fireEffect(effects, 'jitter', hap, intensity);

  // Stab → brightness flash (short percussive synth, high note)
  if (SYNTH_SET.includes(s) && note != null) {
    const midi = noteToMidi(note);
    const dur = hap.duration ? Number(hap.duration) : (hap.whole ? Number(hap.whole.end) - Number(hap.whole.begin) : 1);
    if (midi != null && midi >= 48 && dur < 0.5) {
      fireEffect(effects, 'flash', hap, intensity);
    }
  }

  // Bass → orbit swell
  if (note != null) fireEffect(effects, 'swell', hap, intensity);
}

// Persistent state for cross-frame tracking (seenHaps, chord onset)
export function createDetectorState() {
  return {
    seenHaps: new Set(),
    activeChordBegin: null,
  };
}

// Main entry: process haps → mutate effects accumulator
export function detectEffects(haps, time, trackFx, state, effects) {
  // Clean old entries
  if (state.seenHaps.size > 200) {
    const entries = [...state.seenHaps];
    state.seenHaps = new Set(entries.slice(-100));
  }

  // Onset-triggered effects
  for (const hap of haps) {
    if (!hap.hasOnset()) continue;

    const hapId = `${hap.value?.s || 'synth'}_${hap.whole?.begin}`;
    if (state.seenHaps.has(hapId)) continue;
    state.seenHaps.add(hapId);

    const gain = hap.value?.gain ?? 1;
    const velocity = hap.value?.velocity ?? 1;
    const intensity = gain * velocity;

    const tag = getTrackTag(hap);
    const assignedFx = tag && trackFx?.[tag];

    if (assignedFx === 'none') {
      continue;
    } else if (assignedFx && assignedFx !== 'pad') {
      fireEffect(effects, assignedFx, hap, intensity);
    } else if (!assignedFx) {
      autoDetect(effects, hap, intensity);
    }
  }

  // Pad detection
  const chordMidis = [];

  const isPadHap = (hap) => {
    const tag = getTrackTag(hap);
    const assignedFx = tag && trackFx?.[tag];
    if (assignedFx === 'pad') return true;
    if (assignedFx === 'none') return false;
    if (assignedFx) return false;
    return SYNTH_SET.includes(hap.value?.s) && hap.value?.note != null;
  };

  for (const hap of haps) {
    if (!hap.hasOnset()) continue;
    if (!isPadHap(hap)) continue;
    const begin = Number(hap.whole?.begin);
    const hapId = `pad_${begin}`;
    if (!state.seenHaps.has(hapId)) {
      state.seenHaps.add(hapId);
      state.activeChordBegin = begin;
    }
  }

  for (const hap of haps) {
    if (!isPadHap(hap)) continue;
    const note = hap.value?.note;
    if (note == null) continue;
    const begin = Number(hap.whole?.begin);
    const end = Number(hap.whole?.end);
    if (begin > time || end <= time) continue;
    if (begin !== state.activeChordBegin) continue;
    const midi = noteToMidi(note);
    if (midi != null) chordMidis.push(midi);
  }

  if (chordMidis.length >= 3) {
    chordMidis.sort((a, b) => a - b);

    let totalDissonance = 0;
    let pairs = 0;
    for (let i = 0; i < chordMidis.length; i++) {
      for (let j = i + 1; j < chordMidis.length; j++) {
        const interval = (chordMidis[j] - chordMidis[i]) % 12;
        totalDissonance += DISSONANCE[interval];
        pairs++;
      }
    }
    const tension = pairs > 0 ? totalDissonance / pairs : 0;

    const root = chordMidis[0];
    effects.noiseScale = 0.4 + (root - 24) / 48 * 1.0;
    effects.noiseEvolution = 1 + tension * 4;
    effects.noiseStrength = 1 + tension * 2;
    effects.orbitEase = 1 - tension * 0.8;
  }
}
