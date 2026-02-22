// CurlParticles.mjs — Curl noise particle system for mixer background
// Ported from poems/artifacts/13-cloud

import { sendDebug } from './mixer-sync.mjs';

// ============================================================
// Inline 2D Simplex Noise (based on simplex-noise.js by Jonas Wagner)
// ============================================================

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function buildPermutationTable() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
  return { perm, permMod12 };
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

function createNoise2D() {
  const { perm, permMod12 } = buildPermutationTable();

  return function noise2D(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
    }

    return 70 * (n0 + n1 + n2);
  };
}

// ============================================================
// CurlParticles
// ============================================================

export class CurlParticles {
  constructor(options = {}) {
    const {
      count = 3000,
      scale = 200,
      speed = 0.2,
      evolution = 0.001,
      fade = 0.06,
    } = options;

    this.params = { scale, speed, evolution, fade };
    this.noise2D = createNoise2D();
    this.time = 0;
    this.particles = [];
    this.raf = null;
    this.foreground = false;
    this.seenHaps = new Set(); // track processed onsets by identity

    // Effect accumulators
    this.effects = {
      burst: 0,
      swell: 1,        // 1 = no swell, >1 = expanded orbits
      orbitPulse: 0,    // clap: orbit speed multiplier, decay 0.92
      jitter: 0,        // hats: per-particle random offset, decay 0.8
      tangent: 0,       // perc: tangential push, consumed per-frame like burst
      noiseScale: 1,    // pad: noise scale multiplier (1 = default)
      noiseEvolution: 1,// pad: evolution speed multiplier (1 = default)
      noiseStrength: 1, // pad: flow strength multiplier (1 = default)
      orbitEase: 1,     // pad: orbit tightness multiplier (1 = default)
      flash: 0,         // stab: alpha/size boost, one-shot, decay 0.85
    };

    // Dissonance lookup — interval (semitones mod 12) → score 0-1
    this._dissonance = [0, 1, 0.8, 0.3, 0.2, 0.1, 0.9, 0.05, 0.4, 0.3, 0.7, 0.85];

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'curl-particles';
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;';
    document.body.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize);
    this.resize();
    this.initParticles(count);

    // Initial black fill
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.animate();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * Math.min(this.width, this.height) * 0.35;
      this.particles.push({
        x: this.centerX + Math.cos(angle) * radius,
        y: this.centerY + Math.sin(angle) * radius,
        fx: 0, // effect displacement x
        fy: 0, // effect displacement y
        alpha: 0.3 + Math.random() * 0.7,
        orbitRadius: radius,
        orbitAngle: angle,
        orbitSpeed: 0.0006 + Math.random() * 0.0006,
      });
    }
  }

  curl(x, y) {
    const eps = 0.0001;
    const n1 = this.noise2D(x + eps, y + this.time);
    const n2 = this.noise2D(x - eps, y + this.time);
    const n3 = this.noise2D(x, y + eps + this.time);
    const n4 = this.noise2D(x, y - eps + this.time);
    return [(n3 - n4) / (2 * eps), -(n1 - n2) / (2 * eps)];
  }

  animate() {
    this.time += this.params.evolution;

    const { width, height, ctx, particles, params } = this;

    ctx.clearRect(0, 0, width, height);

    // Consume burst — apply once, then zero it
    const fx = this.effects;
    const burstNow = fx.burst;
    fx.burst = 0;
    const tangentNow = fx.tangent;
    fx.tangent = 0;

    // Decay swell back to 1
    fx.swell += (1 - fx.swell) * 0.03;
    // Decay orbit pulse + jitter
    fx.orbitPulse *= 0.92;
    fx.jitter *= 0.8;
    // Decay flash
    fx.flash *= 0.9;
    // Ease pad axes back to 1 (overridden by update() while chord active)
    fx.noiseScale += (1 - fx.noiseScale) * 0.03;
    fx.noiseEvolution += (1 - fx.noiseEvolution) * 0.03;
    fx.noiseStrength += (1 - fx.noiseStrength) * 0.03;
    fx.orbitEase += (1 - fx.orbitEase) * 0.03;

    const cx = this.centerX;
    const cy = this.centerY;
    const effectiveScale = params.scale * fx.noiseScale;

    // Pad modulates evolution speed
    this.time += params.evolution * (fx.noiseEvolution - 1);

    for (const p of particles) {
      // Slow orbit around center + clap pulse adds angular kick
      p.orbitAngle += p.orbitSpeed + fx.orbitPulse * 0.02;

      // Gentle curl noise displacement on top of orbit
      const [nx, ny] = this.curl(p.x / effectiveScale, p.y / effectiveScale);
      const noiseStrength = params.speed * fx.noiseStrength;

      const swelledRadius = p.orbitRadius * fx.swell;
      const targetX = cx + Math.cos(p.orbitAngle) * swelledRadius;
      const targetY = cy + Math.sin(p.orbitAngle) * swelledRadius;

      // Update base position — ease toward orbit + noise
      // orbitEase: 1=default(0.02), <1=looser(noise dominates), >1=tighter
      const ease = 0.02 * fx.orbitEase;
      p.x += (targetX - p.x) * ease + nx * noiseStrength;
      p.y += (targetY - p.y) * ease + ny * noiseStrength;

      // Kick burst — one-shot radial push
      if (burstNow > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.fx += (dx / dist) * burstNow;
        p.fy += (dy / dist) * burstNow;
      }

      // Perc — tangential push (perpendicular to radial)
      if (tangentNow > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.fx += (-dy / dist) * tangentNow;
        p.fy += (dx / dist) * tangentNow;
      }

      // Decay effect displacement back to zero
      p.fx *= 0.88;
      p.fy *= 0.88;

      // Jitter — fresh random each frame (sparkle, not accumulated)
      let jx = 0, jy = 0;
      if (fx.jitter > 0.05) {
        jx = (Math.random() - 0.5) * fx.jitter;
        jy = (Math.random() - 0.5) * fx.jitter;
      }

      // Draw at base + effect offset + jitter
      const drawX = p.x + p.fx + jx;
      const drawY = p.y + p.fy + jy;
      // Flash boosts alpha and size
      const flashAlpha = Math.min(1, p.alpha * 0.9 + fx.flash * 0.8);
      const flashSize = fx.flash > 0.05 ? 2 + Math.round(fx.flash * 4) : 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(Math.round(drawX) - 1, Math.round(drawY) - 1, flashSize, flashSize);
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }

  _noteToMidi(note) {
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

  setForeground(fg) {
    this.foreground = fg;
    this.canvas.style.zIndex = fg ? 5 : 1;
    if (fg) {
      // Clear the opaque black — switch to transparent background
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  update(haps, time) {
    if (!this._callCount) this._callCount = 0;
    this._callCount++;
    if (this._callCount % 300 === 1) sendDebug(`update called #${this._callCount} haps:${haps.length}`);

    // Clean old entries from seenHaps (keep last 200)
    if (this.seenHaps.size > 200) {
      const entries = [...this.seenHaps];
      this.seenHaps = new Set(entries.slice(-100));
    }

    let kicked = false;
    for (const hap of haps) {
      if (!hap.hasOnset()) continue;

      // Deduplicate: use whole.begin as identity (same onset = same begin time)
      const hapId = `${hap.value?.s || 'synth'}_${hap.whole?.begin}`;
      if (this.seenHaps.has(hapId)) continue;
      this.seenHaps.add(hapId);

      // Debug: log all hap values (temporary)
      if (!this._loggedSamples) this._loggedSamples = new Set();
      const sKey = hap.value?.s || 'none';
      if (!this._loggedSamples.has(sKey)) {
        this._loggedSamples.add(sKey);
        sendDebug(`HAP s:${sKey} note:${hap.value?.note} freq:${hap.value?.freq} keys:${Object.keys(hap.value||{}).join(',')}`);
      }

      const s = hap.value?.s;
      const note = hap.value?.note;
      const gain = hap.value?.gain ?? 1;
      const velocity = hap.value?.velocity ?? 1;
      const intensity = gain * velocity;

      // Kick → radial burst
      if (s === 'bd' || s === 'kick') {
        this.effects.burst = Math.max(this.effects.burst, 8 * intensity);
      }

      // Clap/snare → orbit speed pulse
      if (s === 'cp' || s === 'clap' || s === 'sd' || s === 'sn') {
        this.effects.orbitPulse = Math.max(this.effects.orbitPulse, 3 * intensity);
      }

      // Perc → tangential push
      if (s === 'rim' || s === 'clave' || s === 'cowbell') {
        this.effects.tangent = Math.max(this.effects.tangent, 24 * intensity);
      }

      // Hats → jitter (sparkle)
      if (s === 'hh' || s === 'oh' || s === 'ch') {
        this.effects.jitter = Math.max(this.effects.jitter, 20 * intensity);
      }

      // Stab → brightness flash (short percussive synth, high note)
      const synthSet = ['sawtooth', 'sine', 'triangle', 'square'];
      if (synthSet.includes(s) && note != null) {
        const midi = typeof note === 'number' ? note : this._noteToMidi(note);
        const dur = hap.duration ? Number(hap.duration) : (hap.whole ? Number(hap.whole.end) - Number(hap.whole.begin) : 1);
        if (midi != null && midi >= 48 && dur < 0.5) {
          this.effects.flash = Math.max(this.effects.flash, 1.5 * intensity);
          sendDebug(`STAB note:${note} midi:${midi} dur:${dur.toFixed(2)} flash:${this.effects.flash.toFixed(2)}`);
        }
      }

      // Bass → orbit swell (low notes expand the cloud)
      if (note != null) {
        // note can be string "a1" or number. Convert to MIDI if needed.
        let midi = typeof note === 'number' ? note : this._noteToMidi(note);
        if (midi != null && midi < 52) { // below E3 = bass territory
          // Lower pitch = bigger swell. Map midi 24-52 → swell 1.5-1.1
          // Lower pitch = bigger swell. Map midi 24-52 → swell 1.8-1.3
          const swellAmount = 1.3 + (1 - (midi - 24) / 28) * 0.5;
          this.effects.swell = Math.max(this.effects.swell, swellAmount);
          sendDebug(`BASS note:${note} midi:${midi} swell:${this.effects.swell.toFixed(2)}`);
        }
      }
    }

    // Pad detection — simultaneous synth notes (chords = 3+) → tension-driven effects
    const synthSet = ['sawtooth', 'sine', 'triangle', 'square'];
    const chordMidis = [];
    for (const hap of haps) {
      const s = hap.value?.s;
      const note = hap.value?.note;
      if (!synthSet.includes(s) || note == null) continue;
      const begin = Number(hap.whole?.begin);
      const end = Number(hap.whole?.end);
      if (begin > time || end <= time) continue;
      const midi = typeof note === 'number' ? note : this._noteToMidi(note);
      if (midi != null) chordMidis.push(midi);
    }
    if (chordMidis.length >= 3) {
      chordMidis.sort((a, b) => a - b);

      // Compute tension from all pairwise intervals
      let totalDissonance = 0;
      let pairs = 0;
      for (let i = 0; i < chordMidis.length; i++) {
        for (let j = i + 1; j < chordMidis.length; j++) {
          const interval = (chordMidis[j] - chordMidis[i]) % 12;
          totalDissonance += this._dissonance[interval];
          pairs++;
        }
      }
      const tension = pairs > 0 ? totalDissonance / pairs : 0; // 0-1

      const root = chordMidis[0];
      // Root pitch → noise scale (low = big smooth features, high = tight)
      this.effects.noiseScale = 0.4 + (root - 24) / 48 * 1.0; // ~0.4-1.4

      // Tension → evolution speed (calm=1x, tense=5x)
      this.effects.noiseEvolution = 1 + tension * 4;
      // Tension → flow strength (calm=1x, tense=3x)
      this.effects.noiseStrength = 1 + tension * 2;
      // Tension → orbit looseness (calm=1x tight, tense=0.2x loose)
      this.effects.orbitEase = 1 - tension * 0.8;

      sendDebug(`CHORD [${chordMidis}] tension:${tension.toFixed(2)} evo:${this.effects.noiseEvolution.toFixed(1)} str:${this.effects.noiseStrength.toFixed(1)} ease:${this.effects.orbitEase.toFixed(2)}`);
    }
  }

  destroy() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    window.removeEventListener('resize', this._resize);
    this.canvas.remove();
  }
}
