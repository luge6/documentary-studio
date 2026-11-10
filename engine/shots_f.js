// Footage shot: real video (stock or AI) as pre-extracted frames, graded, with a slow camera move,
// crossfades between clips and optional overlays (number, statement, HUD, lower third).
import { W, H, F, C, G, clamp, lin, sm, eo, eob, lerp, text, wrap, measure, fitFont, lowerThird, brackets, SCANLINES } from './core.js';

const FPS = 24, XF = 0.35;
const cache = new Map();
async function frame(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url).then(r => (r.ok ? r.blob() : null)).then(b => (b ? createImageBitmap(b) : null)).catch(() => null);
  cache.set(url, p);
  if (cache.size > 120) { const k = cache.keys().next().value; const old = cache.get(k); cache.delete(k); old.then(b => b && b.close && b.close()); }
  return p;
}
const pad = n => String(n).padStart(5, '0');

export function footage(d, S, idx, PROJ) {
  const segs = d.segs || [];
  const segAt = lt => { let k = 0; while (k < segs.length - 1 && lt >= segs[k + 1].t0) k++; return k; };
  const urlFor = (k, lt) => { const s = segs[k]; const i = clamp(Math.floor((lt - s.t0) * FPS), 0, s.n - 1); return `${PROJ}${s.dir}/f_${pad(i + 1)}.jpg`; };
  const imgs = {};
  const words = String(d.overlay?.text || '').split(/\s+/).filter(Boolean);
  const emph = new Set((d.overlay?.emphasis || []).map(w => w.toLowerCase().replace(/[^\w']/g, '')));
  return {
    footage: true,
    async prepare(lt) {
      if (!segs.length) return;
      const k = segAt(lt); imgs.a = await frame(urlFor(k, lt)); imgs.ka = k;
      imgs.b = (k > 0 && lt - segs[k].t0 < XF) ? await frame(urlFor(k - 1, lt)) : null;
    },
    draw(lt, g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const draw = (img, k, alpha) => {
        if (!img) return; const s = segs[k]; const u = clamp((lt - s.t0) / Math.max(0.5, s.t1 - s.t0));
        const z = 1.02 + 0.06 * sm(u), dir = (k + idx) % 2 ? 1 : -1, dx = dir * 30 * (u - 0.5);
        const r = Math.max(W / img.width, H / img.height) * z, w = img.width * r, h = img.height * r;
        g.save(); g.globalAlpha = alpha; g.filter = 'contrast(1.06) saturate(0.86) sepia(0.12) brightness(0.97)';
        g.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h); g.restore();
      };
      if (imgs.b) { draw(imgs.b, imgs.ka - 1, 1); draw(imgs.a, imgs.ka, sm((lt - segs[imgs.ka].t0) / XF)); }
      else draw(imgs.a, imgs.ka ?? 0, 1);
      G.ctx = g; overlay(lt, g);
    },
  };

  function overlay(lt, g) {
    const k = segs.length ? segAt(lt) : 0, s = segs[k] || {};
    const ov = d.overlay;
    if (ov && ov.kind === 'hud') hud(lt, g, ov);
    if (ov && (ov.kind === 'number' || ov.kind === 'statement')) {
      const a = sm(lin(lt, 0.1, 0.6));
      const gr = g.createRadialGradient(960, 540, 100, 960, 540, 1100); gr.addColorStop(0, `rgba(0,0,0,${0.55 * a})`); gr.addColorStop(1, `rgba(0,0,0,${0.75 * a})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (ov.kind === 'number') numberOv(lt, g, ov); else statementOv(lt, g, ov);
    }
    // per-clip caption first, then the shot caption
    const cap = s.caption || d.caption, sub = s.sub ?? d.sub;
    if (cap || sub) { const t0 = s.caption || s.sub ? s.t0 : 0; lowerThird(cap || '', sub, sm(lin(lt, t0 + 0.3, t0 + 0.9)) * (1 - sm(lin(lt, (s.t1 ?? S.dur) - 0.35, s.t1 ?? S.dur)))); }
  }
  function numberOv(lt, g, ov) {
    const target = Number(String(ov.value).replace(/[^\d.]/g, '')) || 0, p = eo(lin(lt, 0.2, Math.max(0.8, S.dur * 0.5)));
    const str = Math.round(target * p).toLocaleString('en-US') + (p > 0.98 ? ov.suffix || '' : '');
    const a = sm(lin(lt, 0.1, 0.5));
    if (ov.kicker) text(String(ov.kicker).toUpperCase(), 960, 330, `500 30px ${F.MONO}`, C.AMBER, 'center', 8, a);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 40;
    const grd = g.createLinearGradient(0, 380, 0, 600); grd.addColorStop(0, '#f6dc9a'); grd.addColorStop(1, '#b8862f');
    g.globalAlpha = a; g.font = `bold 230px ${F.SERIF}`; g.textAlign = 'center'; g.fillStyle = grd; g.letterSpacing = '4px'; g.fillText(str, 960, 600); g.restore();
    text(String(ov.label || '').toUpperCase(), 960, 690, `600 48px ${F.SANS}`, C.CREAM, 'center', 16, sm(lin(lt, S.dur * 0.35, S.dur * 0.35 + 0.5)));
  }
  function statementOv(lt, g, ov) {
    const size = fitFont(ov.text, 1500, 3, 110, 56, s => `bold ${s}px ${F.SERIF}`), font = `bold ${size}px ${F.SERIF}`;
    const lines = wrap(ov.text, 1500, font), lh = size * 1.2, y0 = 540 - ((lines.length - 1) * lh) / 2 + size * 0.35;
    const step = Math.min(0.16, (S.dur * 0.35) / Math.max(1, words.length)); let wi = 0;
    g.save(); g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 30;
    lines.forEach((l, li) => {
      const ws = l.split(' '), lw = measure(l, font); let x = 960 - lw / 2;
      ws.forEach(w => {
        const t = 0.2 + wi * step, p = eo(lin(lt, t, t + 0.35)); wi++;
        const key = w.toLowerCase().replace(/[^\w']/g, '');
        text(w, x, y0 + li * lh + lerp(20, 0, p), font, emph.has(key) ? '#e0473f' : C.CREAM, 'left', 0, p);
        x += measure(w + ' ', font);
      });
    });
    g.restore();
  }
  function hud(lt, g, ov) {
    g.save(); g.globalAlpha = 0.5; g.drawImage(SCANLINES, 0, 0); g.restore();
    const HUD = 'rgba(140,255,200,0.9)', DIM = 'rgba(140,255,200,0.65)';
    brackets(70, 70, W - 140, H - 140, 60, DIM, 2);
    text(String(ov.scan || 'RADIOGRAPHIC SCAN').toUpperCase(), 110, 130, `500 26px ${F.MONO}`, HUD, 'left', 3);
    text('WINDOVER BURIAL', 110, 168, `400 20px ${F.MONO}`, DIM, 'left', 3);
    const rv = sm(lin(lt, S.dur * 0.3, S.dur * 0.3 + 0.4)); if (rv <= 0) return;
    const bx = 960, by = 500, box = lerp(320, 200, eo(lin(lt, S.dur * 0.3, S.dur * 0.3 + 0.5)));
    brackets(bx - box / 2, by - box / 2, box, box, 30, `rgba(255,70,60,${0.95 * rv})`, 4);
    g.save(); g.fillStyle = `rgba(0,0,0,${0.7 * rv})`; g.fillRect(bx + box / 2 + 30, by - box / 2 - 10, 560, ov.detail ? 100 : 60); g.restore();
    const blink = Math.floor(lt * 3) % 2 ? 0.7 : 1;
    text(String(ov.label).toUpperCase(), bx + box / 2 + 50, by - box / 2 + 34, `700 30px ${F.MONO}`, '#ff5a4e', 'left', 2, rv * blink);
    if (ov.detail) text(String(ov.detail).toUpperCase(), bx + box / 2 + 50, by - box / 2 + 76, `400 22px ${F.MONO}`, 'rgba(255,140,130,0.9)', 'left', 2, rv);
  }
}
