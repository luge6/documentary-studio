// Shared drawing utilities for the documentary engine.
export const W = 1920, H = 1080;
export const F = {
  SERIF: "'Bitstream Charter', 'Caladea', 'DejaVu Serif', serif",
  SANS: "'Inter', 'DejaVu Sans', sans-serif",
  MONO: "'JetBrains Mono', 'DejaVu Sans Mono', monospace",
  TYPE: "'Courier 10 Pitch', 'Liberation Mono', monospace",
};
export const C = {
  CREAM: '#f3e6c8', AMBER: '#e0a958', GOLD: '#d9b779', RED: '#c62a30', INK: '#3a2412',
  GREEN: '#8cffc8', MUTED: '#cdbfa6', BG: '#0b0705',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lin = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
export const sm = x => x * x * (3 - 2 * x);
export const eo = x => 1 - Math.pow(1 - x, 3);
export const eio = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eob = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const lerp = (a, b, x) => a + (b - a) * x;
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// The engine draws every shot into G.ctx (swapped for transitions).
export const G = { ctx: null, frame: 0, t: 0 };
const X = () => G.ctx;

// ---------- value noise ----------
export function noise2(seed) {
  const r = rng(seed), P = new Float32Array(512);
  for (let i = 0; i < 512; i++) P[i] = r();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  const f = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = sm(xf), v = sm(yf);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  };
  return (x, y, oct = 4) => { let a = 0, amp = 0.5, fr = 1, n = 0; for (let i = 0; i < oct; i++) { a += f(x * fr, y * fr) * amp; n += amp; amp *= 0.5; fr *= 2.03; } return a / n; };
}

// ---------- text ----------
export function text(str, x, y, font, color, align = 'left', spacing = 0, alpha = 1, baseline = 'alphabetic') {
  if (alpha <= 0) return; const g = X();
  g.save(); g.globalAlpha *= alpha; g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = baseline;
  g.letterSpacing = spacing + 'px'; g.fillText(str, x, y); g.restore();
}
let MEAS = null;
export function measure(str, font, spacing = 0) { const g = MEAS || (MEAS = mk(8, 8).getContext('2d')); g.save(); g.font = font; g.letterSpacing = spacing + 'px'; const w = g.measureText(str).width; g.restore(); return w; }
export function wrap(str, maxW, font, spacing = 0) {
  const words = String(str).split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (measure(test, font, spacing) > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur); return lines;
}
// Fit a font size so text wraps into at most maxLines inside maxW.
export function fitFont(str, maxW, maxLines, size, minSize, mkFont) {
  let s = size; while (s > minSize && wrap(str, maxW, mkFont(s)).length > maxLines) s -= 4; return s;
}

// ---------- paper props ----------
export function rotPt(cx, cy, rot, lx, ly) { const c = Math.cos(rot), s = Math.sin(rot); return [cx + lx * c - ly * s, cy + lx * s + ly * c]; }
export function card(cx, cy, w, h, rot, fill, fn, scale = 1, alpha = 1) {
  if (alpha <= 0) return; const g = X();
  g.save(); g.globalAlpha *= alpha; g.translate(cx, cy); g.rotate(rot); g.scale(scale, scale);
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 28; g.shadowOffsetX = 10; g.shadowOffsetY = 16;
  if (fill instanceof HTMLCanvasElement) g.drawImage(fill, -w / 2, -h / 2, w, h); else { g.fillStyle = fill; g.fillRect(-w / 2, -h / 2, w, h); }
  g.shadowColor = 'transparent';
  fn && fn(-w / 2, -h / 2, w, h);
  g.restore();
}
export function pin(x, y, color = '#d32f2f') {
  const g = X(); g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8; g.shadowOffsetX = 5; g.shadowOffsetY = 7;
  const gr = g.createRadialGradient(x - 4, y - 5, 1, x, y, 15);
  gr.addColorStop(0, '#ff8a80'); gr.addColorStop(0.35, color); gr.addColorStop(1, '#5f0b0d');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); g.restore();
}
export function redString(a, b, p, sag = 45) {
  if (p <= 0) return; const g = X();
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 + sag;
  g.save(); g.strokeStyle = '#b0141c'; g.lineWidth = 3.5; g.lineCap = 'round';
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.shadowOffsetX = 3; g.shadowOffsetY = 5;
  g.beginPath(); g.moveTo(a[0], a[1]);
  const N = 40;
  for (let i = 1; i <= N * p; i++) { const u = i / N; g.lineTo((1 - u) ** 2 * a[0] + 2 * (1 - u) * u * cx + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * cy + u * u * b[1]); }
  g.stroke(); g.restore();
}
export function brackets(x, y, w, h, len, color, lw = 3) {
  const g = X(); g.save(); g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([a, b, sx, sy]) => { g.moveTo(a + sx * len, b); g.lineTo(a, b); g.lineTo(a, b + sy * len); });
  g.stroke(); g.restore();
}
export function stamp(label, x, y, rot, p, color = '#a8141c', size = 84, bg = '#dcc590') {
  if (p <= 0) return; const g = X();
  const font = `800 ${size}px ${F.SANS}`, w = measure(label, font, size * 0.12) + size * 0.9, h = size * 1.65;
  g.save(); g.translate(x, y); g.rotate(rot); const s = lerp(1.8, 1, eo(clamp(p))); g.scale(s, s); g.globalAlpha *= clamp(p) * 0.9;
  g.strokeStyle = color; g.lineWidth = size * 0.085; g.strokeRect(-w / 2, -h / 2, w, h); g.lineWidth = size * 0.03; g.strokeRect(-w / 2 + size * 0.17, -h / 2 + size * 0.17, w - size * 0.34, h - size * 0.34);
  text(label, 0, size * 0.36, font, color, 'center', size * 0.12);
  const r = rng(hashStr(label)); g.globalAlpha = 0.5; g.fillStyle = bg;
  for (let i = 0; i < 260; i++) g.fillRect(-w / 2 + r() * w, -h / 2 + r() * h, 1 + r() * 4, 1 + r() * 3);
  g.restore();
}

// ---------- backgrounds ----------
export function radialBg(c0 = '#3a2614', c1 = '#160d06', c2 = '#040201', cx = 960, cy = 480) {
  const g = X(); const gr = g.createRadialGradient(cx, cy, 50, 960, 540, 1100);
  gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
export function lightPool(x = 820, y = 430, a = 0.1, edge = 0.6) {
  const g = X(); const gr = g.createRadialGradient(x, y, 120, 960, 520, 1250);
  gr.addColorStop(0, `rgba(255,190,110,${a})`); gr.addColorStop(1, `rgba(0,0,0,${edge})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
const DUST = (() => { const r = rng(55); return Array.from({ length: 160 }, () => ({ x: r() * W, y: r() * H, s: 0.6 + r() * 2.4, v: 6 + r() * 22, ph: r() * 6.28, a: 0.15 + r() * 0.5 })); })();
export function dust(t, color = '#f0c78a', amt = 1) {
  const g = X(); g.save(); g.fillStyle = color;
  for (let i = 0; i < DUST.length * amt; i++) {
    const d = DUST[i]; const y = (d.y - t * d.v + H * 100) % H, x = d.x + Math.sin(t * 0.7 + d.ph) * 18;
    g.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.ph)); g.beginPath(); g.arc(x, y, d.s, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
// camera helper: zoom around a focus point
export function camera(z, fx, fy, fn) { const g = X(); g.save(); g.translate(960, 540); g.scale(z, z); g.translate(-fx, -fy); fn(); g.restore(); }

// ---------- textures (cached) ----------
const cache = new Map();
export function cached(key, build) { if (!cache.has(key)) cache.set(key, build()); return cache.get(key); }

export function corkTex() {
  return cached('cork', () => {
    const c = mk(2400, 1400), g = c.getContext('2d'), r = rng(7);
    g.fillStyle = '#93693f'; g.fillRect(0, 0, c.width, c.height);
    const cols = ['#6b4524', '#b3864f', '#7d5530', '#c49a60', '#5a3a1e'];
    for (let i = 0; i < 90000; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.globalAlpha = 0.25 + r() * 0.5; const s = 1 + r() * 3.5; g.fillRect(r() * c.width, r() * c.height, s, s * (0.5 + r())); }
    g.globalAlpha = 1;
    for (let i = 0; i < 40; i++) { const x = r() * c.width, y = r() * c.height, rad = 80 + r() * 260; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(40,20,5,0.18)'); gr.addColorStop(1, 'rgba(40,20,5,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    return c;
  });
}
export function parchTex(w, h, seed = 33, tone = [226, 204, 154]) {
  return cached(`parch${w}x${h}s${seed}${tone}`, () => {
    const c = mk(w, h), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = `rgb(${tone})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 1800; i++) { const x = r() * w, y = r() * h, rad = 20 + r() * 160; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${120 + r() * 40 | 0},${80 + r() * 30 | 0},30,${0.04 + r() * 0.08})`); gr.addColorStop(1, 'rgba(120,80,30,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    g.strokeStyle = 'rgba(110,75,35,0.08)'; g.lineWidth = 1;
    for (let i = 0; i < w * h / 1800; i++) { const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 8); g.stroke(); }
    const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.62);
    e.addColorStop(0, 'rgba(90,50,15,0)'); e.addColorStop(1, 'rgba(80,40,10,0.6)'); g.fillStyle = e; g.fillRect(0, 0, w, h);
    return c;
  });
}
export function woodTex() {
  return cached('wood', () => {
    const c = mk(2200, 1300), g = c.getContext('2d'), r = rng(44);
    g.fillStyle = '#24170d'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 700; i++) { const y = r() * c.height; g.strokeStyle = r() < 0.5 ? 'rgba(70,45,22,0.35)' : 'rgba(10,6,2,0.4)'; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= c.width; x += 100) g.lineTo(x, y + Math.sin(x * 0.003 + i) * 6 + (r() - 0.5) * 2); g.stroke(); }
    return c;
  });
}
export function jaggedPath(w, h, seed) {
  return cached(`jag${w}x${h}s${seed}`, () => {
    const r = rng(seed), pts = [], step = 18;
    for (let x = 0; x <= w; x += step) pts.push([x - w / 2, -h / 2 + (r() - 0.5) * 6]);
    for (let y = 0; y <= h; y += step) pts.push([w / 2 + (r() - 0.5) * 6, y - h / 2]);
    for (let x = w; x >= 0; x -= step) pts.push([x - w / 2, h / 2 + (r() - 0.5) * 6]);
    for (let y = h; y >= 0; y -= step) pts.push([-w / 2 + (r() - 0.5) * 6, y - h / 2]);
    return pts;
  });
}
export function paperSheet(w, h, seed, tone) {
  const g = X(), pts = jaggedPath(w, h, seed);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 50; g.shadowOffsetY = 20;
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  g.fillStyle = '#d9c08a'; g.fill(); g.restore();
  g.save(); g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip();
  g.drawImage(parchTex(w, h, seed, tone), -w / 2, -h / 2); g.restore();
}

// ---------- generated "photos" for polaroids / missing images ----------
export function sceneTex(kind, seed = 1, w = 640, h = 480) {
  return cached(`scene_${kind}_${seed}_${w}x${h}`, () => {
    const c = mk(w, h), g = c.getContext('2d'), r = rng(seed + hashStr(kind));
    const sky = (a, b, cc) => { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, a); s.addColorStop(0.6, b); s.addColorStop(1, cc); g.fillStyle = s; g.fillRect(0, 0, w, h); };
    const ridge = (base, amp, col, step = 60) => { g.beginPath(); g.moveTo(0, h); let x = 0; while (x <= w + step) { g.lineTo(x, base - r() * amp); x += step * (0.5 + r()); } g.lineTo(w, h); g.closePath(); g.fillStyle = col; g.fill(); };
    switch (kind) {
      case 'mountains': sky('#2a3b55', '#8ea3b8', '#c9d2d6'); ridge(h * 0.45, h * 0.25, '#5d6f86', 70); ridge(h * 0.6, h * 0.25, '#3f4f63', 60); ridge(h * 0.75, h * 0.15, '#dfe8ee', 90); break;
      case 'desert': sky('#e9b46a', '#f3d39a', '#e0a35d'); g.fillStyle = 'rgba(255,240,200,0.9)'; g.beginPath(); g.arc(w * 0.7, h * 0.35, h * 0.08, 0, 7); g.fill();
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.6 + k * 0.12) + Math.sin(x * 0.01 + k * 2 + r()) * h * 0.05); g.lineTo(w, h); g.closePath(); g.fillStyle = ['#c98a4b', '#b37538', '#9a6230'][k]; g.fill(); } break;
      case 'sea': sky('#1f3346', '#6b8aa3', '#a9bccb'); g.fillStyle = '#29475f'; g.fillRect(0, h * 0.55, w, h * 0.45);
        g.strokeStyle = 'rgba(220,235,245,0.35)'; for (let i = 0; i < 60; i++) { const y = h * 0.57 + r() * h * 0.42, x = r() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 40, y); g.stroke(); } break;
      case 'forest': sky('#3d4a3a', '#7f8f73', '#a7ad94'); for (let k = 0; k < 3; k++) for (let i = 0; i < 26; i++) { const x = r() * w, base = h * (0.65 + k * 0.13), th = h * (0.25 + r() * 0.2); g.fillStyle = ['#36452f', '#26331f', '#141c10'][k]; g.beginPath(); g.moveTo(x, base - th); g.lineTo(x - th * 0.25, base); g.lineTo(x + th * 0.25, base); g.closePath(); g.fill(); } break;
      case 'city': sky('#1a1f2b', '#3c4558', '#6a7180'); for (let i = 0; i < 30; i++) { const bw = 20 + r() * 60, bh = h * (0.15 + r() * 0.45), x = r() * w; g.fillStyle = `rgb(${20 + r() * 20},${22 + r() * 20},${30 + r() * 20})`; g.fillRect(x, h - bh, bw, bh); g.fillStyle = 'rgba(255,210,140,0.6)'; for (let j = 0; j < 8; j++) if (r() < 0.4) g.fillRect(x + 4 + r() * (bw - 10), h - bh + 6 + r() * (bh - 12), 4, 6); } break;
      case 'portrait': { const bg = g.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, w * 0.7); bg.addColorStop(0, '#8c8273'); bg.addColorStop(1, '#3a342c'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1e1a16'; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.13, h * 0.2, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(w / 2, h * 1.02, w * 0.36, h * 0.38, 0, Math.PI, 0); g.fill(); g.fillRect(w / 2 - w * 0.05, h * 0.55, w * 0.1, h * 0.15); break; }
      case 'tomb': { g.fillStyle = '#1a120b'; g.fillRect(0, 0, w, h); const gl = g.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.5); gl.addColorStop(0, '#d98d3a'); gl.addColorStop(0.35, '#6b3e18'); gl.addColorStop(1, '#120b06'); g.fillStyle = gl;
        g.beginPath(); g.moveTo(w * 0.3, h); g.lineTo(w * 0.3, h * 0.35); g.lineTo(w * 0.7, h * 0.35); g.lineTo(w * 0.7, h); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(w * 0.42, h * 0.5, w * 0.16, h * 0.5); break; }
      case 'lab': { sky('#1d2a2e', '#38504f', '#5f7473'); g.fillStyle = '#121a1b'; g.fillRect(0, h * 0.62, w, h * 0.38); for (let i = 0; i < 6; i++) { const x = w * (0.1 + i * 0.15); g.fillStyle = 'rgba(180,240,230,0.5)'; g.fillRect(x, h * 0.45, 18, h * 0.17); g.beginPath(); g.arc(x + 9, h * 0.44, 14, 0, 7); g.fill(); } g.fillStyle = 'rgba(210,255,250,0.15)'; g.fillRect(0, 0, w, h * 0.08); break; }
      case 'night': sky('#05070d', '#111827', '#1d2433'); g.fillStyle = '#fff'; for (let i = 0; i < 160; i++) { g.globalAlpha = r(); g.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5); } g.globalAlpha = 1; ridge(h * 0.8, h * 0.15, '#05060a', 80); break;
      case 'ruins': sky('#c99a62', '#e8c995', '#d6b07a'); g.fillStyle = '#8a6a48'; g.fillRect(0, h * 0.75, w, h * 0.25); for (let i = 0; i < 7; i++) { const x = w * (0.08 + i * 0.13), ch = h * (0.25 + r() * 0.3); g.fillStyle = '#b89366'; g.fillRect(x, h * 0.75 - ch, w * 0.05, ch); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + w * 0.035, h * 0.75 - ch, w * 0.015, ch); } g.fillStyle = '#b89366'; g.fillRect(w * 0.06, h * 0.33, w * 0.45, h * 0.04); break;
      default: sky('#3a3a3a', '#6a6a6a', '#8a8a8a');
    }
    const id = g.getImageData(0, 0, w, h), d = id.data, rr = rng(seed);
    for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, n = (rr() - 0.5) * 22; d[i] = lerp(d[i], l * 1.05 + 12, 0.35) + n; d[i + 1] = lerp(d[i + 1], l, 0.35) + n; d[i + 2] = lerp(d[i + 2], l * 0.85, 0.35) + n; }
    g.putImageData(id, 0, 0);
    return c;
  });
}

// ---------- post ----------
const GRAIN = (() => { const out = [], r = rng(99); for (let k = 0; k < 6; k++) { const c = mk(960, 540), g = c.getContext('2d'), id = g.createImageData(960, 540); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); out.push(c); } return out; })();
export function post(g, frame, grain = 0.09) {
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = grain; g.drawImage(GRAIN[frame % GRAIN.length], 0, 0, W, H); g.restore();
  const v = g.createRadialGradient(960, 540, 420, 960, 540, 1150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}
export const SCANLINES = (() => { const c = mk(W, H), g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2); return c; })();

// Lower-third caption used by many shots.
export function lowerThird(title, sub, a, x = 110, y = 930) {
  if (a <= 0 || !title) return;
  const g = X(); const p = eo(a);
  g.save(); g.globalAlpha *= a;
  const bg = g.createLinearGradient(0, y - 120, 0, H); bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = bg; g.fillRect(0, y - 120, W * 0.6, H - y + 120);
  g.translate(lerp(-24, 0, p), 0);
  g.fillStyle = C.AMBER; g.fillRect(x, y - 52, 4, sub ? 86 : 56);
  text(title, x + 24, y - 12, `600 40px ${F.SERIF}`, C.CREAM);
  if (sub) text(String(sub).toUpperCase(), x + 26, y + 26, `500 20px ${F.SANS}`, C.AMBER, 'left', 4);
  g.restore();
}
