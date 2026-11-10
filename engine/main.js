// Engine entry: loads timeline.json, builds 3D shots on demand, composites frames.
import { renderer, loadFonts, loadImage, loadModel, models, images, disposeTree } from './world.js';
import { W, H, G, F, C, post, lin, sm, lerp, text, wrap, mk } from './core.js';
import * as A from './shots_a.js';
import * as B from './shots_b.js';

const BUILD = {
  title: A.title, chapter: A.chapter, statement: A.statement, number: A.number, board: A.board, checklist: A.checklist,
  document: A.document_, quote: A.quote, map: B.map, timeline: B.timeline, photo: B.photo, bars: B.bars,
  xray: B.xray_, artifact: B.artifact, landscape: B.landscape, molecule: B.molecule,
};
window.SHOT_TYPES = Object.keys(BUILD);
const params = new URLSearchParams(location.search);
const PROJ = params.get('proj') || '/project/';
const TL = await (await fetch(params.get('tl') || PROJ + 'timeline.json')).json();
const main = document.getElementById('c'), ctx = main.getContext('2d', { willReadFrequently: true });
const buf = mk(W, H), bctx = buf.getContext('2d');

// ---------- preload ----------
await loadFonts('/three/examples/fonts/');
for (const s of TL.shots) {
  const d = s.data || {};
  const srcs = [d.src, ...((d.cards || []).map(c => c.image))].filter(Boolean);
  for (const src of srcs) images[src] = await loadImage(PROJ + src);
  if (d.model) { try { models[d.model] = await loadModel(PROJ + d.model); } catch (e) { console.log('model failed', d.model, e.message); } }
}
await Promise.all([`bold 64px ${F.SERIF}`, `italic 40px ${F.SERIF}`, `600 40px ${F.SANS}`, `800 80px ${F.SANS}`, `500 22px ${F.SANS}`, `500 24px ${F.MONO}`, `700 26px ${F.MONO}`, `40px ${F.TYPE}`, `bold 46px ${F.TYPE}`].map(f => document.fonts.load(f)));

// ---------- per-shot timing helper ----------
const norm = w => String(w).toLowerCase().replace(/[^a-z0-9']/g, '');
function makeS(shot) {
  const dur = shot.end - shot.start, words = shot.words || [];
  const cue = (w, fb = null) => { const k = norm(w); if (!k) return fb; const hit = words.find(x => norm(x.w) === k) || words.find(x => norm(x.w).startsWith(k)); return hit ? Math.max(0, hit.t) : fb; };
  const reveal = (items, a, b) => { const n = items.length; return items.map((it, i) => { const c = it && it.cue ? cue(it.cue, null) : null; return c ?? lerp(a * dur, b * dur, n > 1 ? i / (n - 1) : 0); }); };
  return { dur, words, cue, reveal };
}

// ---------- instances ----------
const inst = new Map();
function get(i) {
  if (!inst.has(i)) {
    const s = TL.shots[i], fn = BUILD[s.type];
    if (!fn) throw new Error(`unknown shot type "${s.type}" (shot ${i})`);
    const o = fn(s.data || {}, makeS(s), i); o.S = makeS(s); inst.set(i, o);
  }
  for (const k of [...inst.keys()]) if (k < i - 1 || k > i + 1) { disposeTree(inst.get(k).scene); inst.delete(k); }
  return inst.get(i);
}
function drawShot(i, lt, g) {
  const o = get(i); const s = TL.shots[i]; lt = Math.max(0, Math.min(lt, s.end - s.start));
  o.update(lt); renderer.render(o.scene, o.camera);
  g.drawImage(renderer.domElement, 0, 0, W, H);
  if (o.overlay) { const prev = G.ctx; G.ctx = g; g.save(); o.overlay(lt); g.restore(); G.ctx = prev; }
}
function shotAt(t) { let lo = 0, hi = TL.shots.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (TL.shots[m].start <= t) lo = m; else hi = m - 1; } return lo; }

function subtitles(t) {
  const s = (TL.subtitles || []).find(x => t >= x.start && t <= x.end); if (!s) return;
  const al = Math.min(lin(t, s.start, s.start + 0.1), 1 - lin(t, s.end - 0.1, s.end));
  ctx.save(); ctx.font = `600 40px ${F.SANS}`; ctx.textAlign = 'center'; const w = ctx.measureText(s.text).width + 56;
  ctx.globalAlpha = al; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(960 - w / 2, 958, w, 64, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(s.text, 960, 1003); ctx.restore();
}

window.renderFrame = (t) => {
  const frame = Math.round(t * (TL.fps || 24)); G.frame = frame; G.t = t;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const i = shotAt(t), s = TL.shots[i], lt = t - s.start, dur = s.end - s.start;
  const tr = s.transition || 'cut', TD = 0.5;
  if (tr === 'fade' && i > 0 && lt < TD) {
    const p = TL.shots[i - 1]; drawShot(i - 1, t - p.start, ctx); drawShot(i, lt, bctx);
    ctx.save(); ctx.globalAlpha = sm(lt / TD); ctx.drawImage(buf, 0, 0); ctx.restore();
  } else drawShot(i, lt, ctx);
  let k = 0;
  if (tr === 'dip') k = Math.max(k, 1 - lin(lt, 0, 0.45));
  const nx = TL.shots[i + 1]; if (nx && nx.transition === 'dip') k = Math.max(k, lin(lt, dur - 0.45, dur));
  if (TL.burnSubtitles) subtitles(t);
  post(ctx, frame, 0.08);
  k = Math.max(k, 1 - lin(t, 0, 0.6), lin(t, TL.duration - 1.2, TL.duration));
  if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
};

// Thumbnail: a frame of shot i at local time lt with big punchy text on the left.
window.renderThumb = (i, lt, words = '', accent = '') => {
  const s = TL.shots[i]; ctx.setTransform(1, 0, 0, 1, 0, 0); drawShot(i, lt ?? (s.end - s.start) * 0.7, ctx); post(ctx, 1, 0.05);
  const gr = ctx.createLinearGradient(0, 0, W * 0.75, 0); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const lines = String(words).toUpperCase().split('|'); const size = lines.length > 2 ? 150 : 180;
  lines.forEach((l, k) => { const y = H / 2 - ((lines.length - 1) * size * 1.05) / 2 + k * size * 1.05 + size * 0.35; G.ctx = ctx;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 30; text(l, 90, y, `bold ${size}px ${F.SERIF}`, accent && l.includes(accent.toUpperCase()) ? '#ff3b30' : C.CREAM, 'left', 2); ctx.restore(); });
};
// Render a frame and return it as a JPEG (base64) - far faster than a page screenshot.
window.grabFrame = async (t, q = 0.92) => {
  window.renderFrame(t);
  const blob = await new Promise(r => main.toBlob(r, 'image/jpeg', q));
  const b = new Uint8Array(await blob.arrayBuffer()); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
window.profile = (t) => {
  const i = shotAt(t), o = get(i), s = TL.shots[i], lt = t - s.start; const gl = renderer.getContext();
  const t0 = performance.now(); o.update(lt); const t1 = performance.now(); renderer.render(o.scene, o.camera); gl.finish(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t2 = performance.now();
  ctx.drawImage(renderer.domElement, 0, 0, W, H); const t3 = performance.now(); post(ctx, 1, 0.08); ctx.getImageData(0, 0, 1, 1); const t4 = performance.now();
  return { type: s.type, update: t1 - t0, gl: t2 - t1, blit: t3 - t2, post: t4 - t3 };
};
window.profileGrab = async (t) => {
  const a = performance.now(); window.renderFrame(t); const gl = renderer.getContext(); ctx.getImageData(0, 0, 1, 1); const b = performance.now();
  const blob = await new Promise(r => main.toBlob(r, 'image/jpeg', 0.92)); const c = performance.now();
  const raw = ctx.getImageData(0, 0, W, H); const d = performance.now();
  return { render: b - a, toBlob: c - b, getImageData: d - c, kb: blob.size / 1024 };
};
window.TIMELINE = TL;
window.READY = true;
