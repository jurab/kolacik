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
    };

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

    // Decay swell back to 1
    fx.swell += (1 - fx.swell) * 0.03;
    // Decay orbit pulse
    fx.orbitPulse *= 0.92;

    const cx = this.centerX;
    const cy = this.centerY;

    for (const p of particles) {
      // Slow orbit around center + clap pulse adds angular kick
      p.orbitAngle += p.orbitSpeed + fx.orbitPulse * 0.02;

      // Gentle curl noise displacement on top of orbit
      const [nx, ny] = this.curl(p.x / params.scale, p.y / params.scale);
      const noiseStrength = params.speed;

      const swelledRadius = p.orbitRadius * fx.swell;
      const targetX = cx + Math.cos(p.orbitAngle) * swelledRadius;
      const targetY = cy + Math.sin(p.orbitAngle) * swelledRadius;

      // Update base position — ease toward orbit + noise
      p.x += (targetX - p.x) * 0.02 + nx * noiseStrength;
      p.y += (targetY - p.y) * 0.02 + ny * noiseStrength;

      // Kick burst — one-shot radial push
      if (burstNow > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.fx += (dx / dist) * burstNow;
        p.fy += (dy / dist) * burstNow;
      }

      // Decay effect displacement back to zero
      p.fx *= 0.88;
      p.fy *= 0.88;

      // Draw at base + effect offset
      const drawX = p.x + p.fx;
      const drawY = p.y + p.fy;
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.9})`;
      ctx.fillRect(Math.round(drawX) - 1, Math.round(drawY) - 1, 2, 2);
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
        sendDebug(`CLAP s:${s} orbitPulse:${this.effects.orbitPulse.toFixed(2)}`);
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
