// CurlParticles.mjs — Curl noise particle renderer
// Pure animation engine. Receives effect accumulators, renders particles.
// No Strudel imports, no hap knowledge, no sample names.

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
// CurlParticles — Renderer
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

    // Effect accumulators — written by detectEffects(), consumed by animate()
    this.effects = {
      burst: 0,
      swell: 1,
      orbitPulse: 0,
      jitter: 0,
      tangent: 0,
      noiseScale: 1,
      noiseEvolution: 1,
      noiseStrength: 1,
      orbitEase: 1,
      flash: 0,
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
        fx: 0,
        fy: 0,
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

    const fx = this.effects;
    const burstNow = fx.burst;
    fx.burst = 0;
    const tangentNow = fx.tangent;
    fx.tangent = 0;

    fx.swell += (1 - fx.swell) * 0.03;
    fx.orbitPulse *= 0.92;
    fx.jitter *= 0.8;
    fx.flash *= 0.9;
    fx.noiseScale += (1 - fx.noiseScale) * 0.03;
    fx.noiseEvolution += (1 - fx.noiseEvolution) * 0.03;
    fx.noiseStrength += (1 - fx.noiseStrength) * 0.03;
    fx.orbitEase += (1 - fx.orbitEase) * 0.03;

    const cx = this.centerX;
    const cy = this.centerY;
    const effectiveScale = params.scale * fx.noiseScale;

    this.time += params.evolution * (fx.noiseEvolution - 1);

    for (const p of particles) {
      p.orbitAngle += p.orbitSpeed + fx.orbitPulse * 0.02;

      const [nx, ny] = this.curl(p.x / effectiveScale, p.y / effectiveScale);
      const noiseStrength = params.speed * fx.noiseStrength;

      const swelledRadius = p.orbitRadius * fx.swell;
      const targetX = cx + Math.cos(p.orbitAngle) * swelledRadius;
      const targetY = cy + Math.sin(p.orbitAngle) * swelledRadius;

      const ease = 0.02 * fx.orbitEase;
      p.x += (targetX - p.x) * ease + nx * noiseStrength;
      p.y += (targetY - p.y) * ease + ny * noiseStrength;

      if (burstNow > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.fx += (dx / dist) * burstNow;
        p.fy += (dy / dist) * burstNow;
      }

      if (tangentNow > 0) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        p.fx += (-dy / dist) * tangentNow;
        p.fy += (dx / dist) * tangentNow;
      }

      p.fx *= 0.88;
      p.fy *= 0.88;

      let jx = 0, jy = 0;
      if (fx.jitter > 0.05) {
        jx = (Math.random() - 0.5) * fx.jitter;
        jy = (Math.random() - 0.5) * fx.jitter;
      }

      const drawX = p.x + p.fx + jx;
      const drawY = p.y + p.fy + jy;
      const flashAlpha = Math.min(1, p.alpha * 0.9 + fx.flash * 0.8);
      const flashSize = fx.flash > 0.05 ? 2 + Math.round(fx.flash * 4) : 2;
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      ctx.fillRect(Math.round(drawX) - 1, Math.round(drawY) - 1, flashSize, flashSize);
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }

  setForeground(fg) {
    this.foreground = fg;
    this.canvas.style.zIndex = fg ? 5 : 1;
    if (fg) {
      this.ctx.clearRect(0, 0, this.width, this.height);
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
