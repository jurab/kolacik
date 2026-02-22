// CurlParticles.mjs — Curl noise particle system for mixer background
// Ported from poems/artifacts/13-cloud

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
      count = 1200,
      scale = 130,
      speed = 2.6,
      evolution = 0.005,
      fade = 0.08,
    } = options;

    this.params = { scale, speed, evolution, fade };
    this.noise2D = createNoise2D();
    this.time = 0;
    this.particles = [];
    this.raf = null;
    this.foreground = false;

    // Effect accumulators (for Phase 2 — music reactivity)
    this.effects = {
      burst: 0,
      driftAngle: 0,
      driftIntensity: 0,
      scatter: 0,
      flowSpeed: 1,
      attractPull: 0,
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
      // Distribute in a loose cloud around center
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(this.width, this.height) * 0.35;
      this.particles.push({
        x: this.centerX + Math.cos(angle) * radius,
        y: this.centerY + Math.sin(angle) * radius,
        alpha: 0.3 + Math.random() * 0.7,
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

    // Fade trail — in foreground mode use clearRect for transparency
    if (this.foreground) {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${params.fade})`;
      ctx.fillRect(0, 0, width, height);
    }

    for (const p of particles) {
      // Curl velocity
      const [cx, cy] = this.curl(p.x / params.scale, p.y / params.scale);
      const vx = cx * params.speed;
      const vy = cy * params.speed;

      p.x += vx;
      p.y += vy;

      // Wrap around edges with margin
      const margin = 50;
      if (p.x < -margin) p.x = width + margin;
      if (p.x > width + margin) p.x = -margin;
      if (p.y < -margin) p.y = height + margin;
      if (p.y > height + margin) p.y = -margin;

      // Draw
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }

  setForeground(fg) {
    this.foreground = fg;
    this.canvas.style.zIndex = fg ? 5 : 1;
    if (fg) {
      // Clear the opaque black — switch to transparent background
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  // Phase 2 stub — will receive haps from the Drawer
  update(haps, time) {
    // TODO: process hap events, update effect accumulators
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
