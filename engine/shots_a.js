// 3D shots, part A: title, chapter, statement, number, board, checklist, document, quote.
import { THREE, stage, spot, dirLight, cam, camPath, shake, dustPoints, floor, text3d, textWidth, material, canvasTex, texPlane, images } from './world.js';
import { F, C, clamp, lin, sm, eo, eio, eob, lerp, rng, hashStr, text, wrap, measure, fitFont, sceneTex, parchTex, woodTex, corkTex, stamp as stamp2d, lowerThird } from './core.js';

// ---------- shared helpers ----------
function linesFit(str, font, maxW, size0, maxLines, minSize = 0.35) {
  let size = size0;
  for (; size >= minSize; size *= 0.92) {
    const words = String(str).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (textWidth(t, font, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines && lines.every(l => textWidth(l, font, size) <= maxW)) return { size, lines };
  }
  return { size: minSize, lines: [String(str)] };
}
function labelTex(str, { w = 2048, h = 256, font = `600 64px ${F.SANS}`, color = C.AMBER, spacing = 18, align = 'center' } = {}) {
  return canvasTex(w, h, () => text(str, align === 'center' ? w / 2 : 20, h * 0.62, font, color, align, spacing));
}
function deskScene() {
  const scene = stage({ bg: 0x0a0604, fog: [0x0a0604, 14, 40], envI: 0.2 });
  const wt = new THREE.CanvasTexture(woodTex()); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(2, 2);
  floor(scene, { size: 40, color: 0xffffff, rough: 0.75, map: wt });
  scene.add(new THREE.AmbientLight(0xffe2c0, 0.12));
  const lamp = spot(scene, { color: 0xffc584, intensity: 5.5, pos: [-4, 8, 2.5], target: [0.3, 0, 0], angle: 0.55, penumbra: 0.8 });
  dirLight(scene, 0x8fb0ff, 0.25, [6, 4, -4]);
  return { scene, lamp };
}
// A sheet of paper lying on the desk with a slight curl. Texture px -> units at `ppu`.
function paperMesh(tex, wU, hU) {
  const g = new THREE.PlaneGeometry(wU, hU, 24, 24); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (wU / 2), y = p.getY(i) / (hU / 2); p.setZ(i, 0.05 * Math.pow(Math.abs(x), 3) + 0.03 * Math.pow(Math.abs(y), 4)); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; m.receiveShadow = true; return m;
}

// ---------- TITLE ----------
export function title(d, S) {
  const scene = stage({ bg: 0x050302, fog: [0x050302, 12, 40], envI: 0.35 }), camera = cam(32);
  floor(scene, { color: 0x0d0907, rough: 0.92 });
  const { size, lines } = linesFit(String(d.title).toUpperCase(), 'serif', 10, 1.3, 2);
  const gold = material('gold'), letters = [];
  lines.forEach((l, i) => { const t = text3d(l, { size, depth: size * 0.25, bevel: size * 0.03, material: gold, spacing: size * 0.06 }); t.position.set(0, 1.0 + (lines.length - 1 - i) * size * 1.25, 0); scene.add(t); letters.push(...t.userData.letters); });
  const top = 1.0 + lines.length * size * 1.25;
  let sub, kick;
  if (d.subtitle) { const lt = labelTex(String(d.subtitle).toUpperCase(), { font: `500 56px ${F.SANS}`, color: C.MUTED, spacing: 14 }); sub = texPlane(10, 1.25, lt.tex, { lit: false }); sub.position.set(0, 0.35, 0.6); scene.add(sub); sub.material.opacity = 0; }
  if (d.kicker) { const kt = labelTex(String(d.kicker).toUpperCase()); kick = texPlane(12, 1.5, kt.tex, { lit: false }); kick.position.set(0, top + 0.5, 0); scene.add(kick); kick.material.opacity = 0; }
  const key = spot(scene, { color: 0xffd09a, intensity: 0, pos: [0, 9, 8], target: [0, 1.5, 0], angle: 0.5 });
  spot(scene, { color: 0x7fa6ff, intensity: 1.6, pos: [0, 7, -9], target: [0, 2.2, 0], angle: 0.45, shadow: false });
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  dustPoints(scene, { center: [0, 3, 0], spread: [18, 7, 10] });
  const base = letters.map(m => m.position.y);
  return {
    scene, camera,
    update(lt) {
      camPath(camera, [{ t: 0, pos: [0, 1.4, 16], look: [0, 1.8, 0] }, { t: 1, pos: [0.4, 1.8, 13.5], look: [0, 1.9, 0] }], lt / S.dur, x => x);
      key.intensity = lerp(0, 5, sm(lin(lt, 0.1, 1.4)));
      letters.forEach((m, i) => { const p = eo(lin(lt, 0.2 + i * 0.035, 0.9 + i * 0.035)); m.position.y = base[i] + lerp(-0.5, 0, p); m.scale.setScalar(Math.max(0.001, p)); });
      if (sub) sub.material.opacity = sm(lin(lt, 1.0, 1.8));
      if (kick) kick.material.opacity = sm(lin(lt, 0.6, 1.4));
    },
  };
}

// ---------- CHAPTER ----------
export function chapter(d, S) {
  const scene = stage({ bg: 0x040302, fog: [0x040302, 8, 30], envI: 0.3 }), camera = cam(32);
  const { size, lines } = linesFit(String(d.title), 'serif', 9, 1.1, 2);
  const mat = material('cream'), letters = [];
  lines.forEach((l, i) => { const t = text3d(l, { size, depth: size * 0.22, bevel: size * 0.025, material: mat, spacing: size * 0.02, shadow: false }); t.position.set(0, (lines.length - 1 - i) * size * 1.3 - 0.2, 0); scene.add(t); letters.push(...t.userData.letters); });
  const topY = (lines.length - 1) * size * 1.3 - 0.2 + size * 1.25;
  const k = labelTex(`CHAPTER ${String(d.num ?? '').padStart(2, '0')}`, { font: `600 70px ${F.SANS}`, spacing: 26 });
  const kp = texPlane(10, 1.25, k.tex, { lit: false }); kp.position.set(0, topY + 0.3, 0.1); scene.add(kp);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.04), material('gold')); bar.position.set(0, -0.55, 0.1); scene.add(bar);
  let sub; if (d.subtitle) { const st = labelTex(String(d.subtitle), { font: `italic 60px ${F.SERIF}`, color: C.MUTED, spacing: 2 }); sub = texPlane(12, 1.5, st.tex, { lit: false }); sub.position.set(0, -1.25, 0.1); scene.add(sub); }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 })); back.position.z = -7; back.receiveShadow = true; scene.add(back);
  const sweep = spot(scene, { color: 0xffc98e, intensity: 6, pos: [-7, 5, 7], target: [0, 0.3, 0], angle: 0.35, penumbra: 0.9 });
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  dustPoints(scene, { center: [0, 1, 1], spread: [16, 8, 6], n: 350 });
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      camPath(camera, [{ t: 0, pos: [-0.8, 0.7, 14.5], look: [0, 0.5, 0] }, { t: 1, pos: [0.5, 0.5, 12.5], look: [0, 0.4, 0] }], u, x => x);
      sweep.position.x = lerp(-7, 7, sm(u)); sweep.target.position.x = lerp(-3, 3, sm(u));
      letters.forEach((m, i) => { m.scale.setScalar(Math.max(0.001, eo(lin(lt, 0.25 + i * 0.03, 0.8 + i * 0.03)))); });
      kp.material.opacity = sm(lin(lt, 0.1, 0.6)); bar.scale.x = Math.max(0.001, eo(lin(lt, 0.5, 1.4)));
      if (sub) sub.material.opacity = sm(lin(lt, 0.9, 1.5));
    },
  };
}

// ---------- STATEMENT (words appear as they are spoken) ----------
export function statement(d, S) {
  const scene = stage({ bg: 0x060403, fog: [0x060403, 10, 32], envI: 0.3 }), camera = cam(32);
  floor(scene, { color: 0x100b08, rough: 0.92, y: -2.4 });
  const { size, lines } = linesFit(d.text, 'serif', 10, 1.0, 3);
  const emph = new Set((d.emphasis || []).map(w => w.toLowerCase().replace(/[^\w']/g, '')));
  const cream = material('cream'), red = material('red'), gold = material('gold');
  const words = [];
  lines.forEach((l, li) => {
    const ws = l.split(' '), lw = textWidth(l, 'serif', size); let x = -lw / 2;
    ws.forEach(w => {
      const key = w.toLowerCase().replace(/[^\w']/g, '');
      const m = text3d(w, { size, depth: size * 0.2, bevel: size * 0.02, material: emph.has(key) ? (d.emphasisColor === 'gold' ? gold : red) : cream, align: 'left' });
      m.position.set(x, ((lines.length - 1) / 2 - li) * size * 1.35, 0); scene.add(m);
      words.push({ m, w: key, y: m.position.y }); x += textWidth(w + ' ', 'serif', size);
    });
  });
  const times = S.reveal(words.map(w => ({ cue: w.w })), 0.02, 0.6);
  let kick; if (d.kicker) { const kt = labelTex(String(d.kicker).toUpperCase()); kick = texPlane(12, 1.5, kt.tex, { lit: false }); kick.position.set(0, (lines.length / 2) * size * 1.35 + 0.6, 0); scene.add(kick); }
  spot(scene, { color: 0xffd3a0, intensity: 5, pos: [-2, 7, 8], target: [0, 0, 0], angle: 0.6 });
  spot(scene, { color: 0x86a8ff, intensity: 1.4, pos: [4, 5, -6], target: [0, 0.8, 0], angle: 0.4, shadow: false });
  dustPoints(scene, { center: [0, 0, 1], spread: [18, 8, 8], n: 300 });
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      camPath(camera, [{ t: 0, pos: [-1.2, -0.1, 15.5], look: [0, 0, 0] }, { t: 1, pos: [1.0, 0.4, 13.5], look: [0, 0.1, 0] }], u, x => x);
      words.forEach((w, i) => { const p = eo(lin(lt, times[i] - 0.05, times[i] + 0.3)); w.m.scale.setScalar(Math.max(0.001, p)); w.m.position.y = w.y + lerp(-0.25, 0, p); w.m.position.z = lerp(-0.6, 0, p); });
      if (kick) kick.material.opacity = sm(lin(lt, 0, 0.5));
    },
  };
}

// ---------- NUMBER (counting 3D number) ----------
export function number(d, S) {
  const scene = stage({ bg: 0x070403, fog: [0x070403, 10, 35], envI: 0.45 }), camera = cam(32);
  floor(scene, { color: 0x120c08, rough: 0.9, y: -2.6 });
  const target = Number(String(d.value).replace(/[^\d.-]/g, '')) || 0;
  const dec = (String(d.value).split('.')[1] || '').replace(/\D/g, '').length;
  const fmt = v => `${d.prefix || ''}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${d.suffix || ''}`;
  const final = fmt(target); const size = Math.min(2.4, 8 / textWidth(final, 'serif', 1));
  const num = text3d(fmt(0), { size, depth: size * 0.3, bevel: size * 0.025, material: material('gold'), spacing: size * 0.03 });
  num.position.y = -0.2; scene.add(num);
  let lab; if (d.label) { const f = linesFit(String(d.label).toUpperCase(), 'sans', 11, 0.5, 1); lab = text3d(f.lines[0], { font: 'sans', size: f.size, depth: 0.06, bevel: 0, material: material('cream'), spacing: f.size * 0.25 }); lab.position.y = -0.95 - f.size; scene.add(lab); }
  let kick; if (d.kicker) { const kt = labelTex(String(d.kicker).toUpperCase(), { font: `500 56px ${F.MONO}` }); kick = texPlane(12, 1.5, kt.tex, { lit: false }); kick.position.set(0, size * 0.95 + 0.4, 0); scene.add(kick); }
  let marker, railFill, tl;
  if (d.timeline) {
    tl = new THREE.Group(); tl.position.set(0, -2.55, 1.2); scene.add(tl);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(12, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0x8a7558, roughness: 0.6 })); tl.add(rail);
    for (let i = 0; i <= 10; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.03, i % 5 ? 0.15 : 0.35, 0.03), rail.material); tk.position.set(-6 + i * 1.2, 0.07, 0); tl.add(tk); }
    railFill = new THREE.Mesh(new THREE.BoxGeometry(12, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0xe0a958, emissive: 0xe0a958, emissiveIntensity: 0.8 })); tl.add(railFill);
    marker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 2 })); tl.add(marker);
    const pl = new THREE.PointLight(0xffa040, 2, 3, 2); marker.add(pl);
    for (const [s, x] of [[d.timeline.from, -6], [d.timeline.to, 6]]) { const t = labelTex(String(s), { font: `500 60px ${F.MONO}`, color: C.MUTED, spacing: 4 }); const p = texPlane(4, 0.5, t.tex, { lit: false }); p.position.set(x, -0.4, 0); tl.add(p); }
  }
  spot(scene, { color: 0xffd6a6, intensity: 5, pos: [-3, 8, 8], target: [0, 0, 0], angle: 0.6 });
  spot(scene, { color: 0x7ea2ff, intensity: 1.6, pos: [5, 5, -6], target: [0, 0.8, 0], angle: 0.4, shadow: false });
  dustPoints(scene, { center: [0, 0, 1], spread: [18, 8, 8] });
  const cA = d.countFrom ?? 0;
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      camPath(camera, [{ t: 0, pos: [0, 1.2, 17], look: [0, 0.1, 0] }, { t: 1, pos: [-0.8, 0.8, 14.5], look: [0, 0.0, 0] }], u, x => x);
      const p = eo(lin(lt, 0.15, Math.max(0.6, S.dur * 0.55)));
      const v = lerp(cA, target, p); const s = fmt(dec ? v : Math.round(v)); if (s !== num.userData.str) num.setText(s);
      if (lab) lab.scale.setScalar(Math.max(0.001, eo(lin(lt, S.dur * 0.35, S.dur * 0.35 + 0.5))));
      if (kick) kick.material.opacity = sm(lin(lt, 0.1, 0.6));
      if (tl) { const x = lerp(6, -6, p); marker.position.x = x; railFill.scale.x = Math.max(0.001, (6 - x) / 12); railFill.position.x = (x + 6) / 2; }
    },
  };
}

// ---------- BOARD (3D evidence board) ----------
const CARD = { polaroid: [2.3, 2.75], index: [3.1, 1.85], note: [2.0, 1.7], clip: [2.7, 2.2], photo: [3.0, 2.2] };
const SLOTS = {
  1: [[0, 0]], 2: [[-2.4, 0.1], [2.4, 0.3]], 3: [[-3.1, 0.4], [1.5, 1.4], [2.5, -1.8]],
  4: [[-3.7, 0.9], [0.3, 1.7], [4.0, 0.3], [-0.6, -1.9]], 5: [[-4.2, 1.0], [-0.4, 1.8], [3.6, 1.1], [-2.0, -1.9], [2.6, -2.0]],
};
function drawCard(card, w, h, shown = Infinity) {
  const g = arguments[4];
  const kind = card.kind || 'index';
  if (kind === 'polaroid' || kind === 'photo') {
    g.fillStyle = '#f3efe6'; g.fillRect(0, 0, w, h);
    const im = card.image && images[card.image]; const pad = kind === 'photo' ? 18 : 40, ih = kind === 'photo' ? h - 36 : h * 0.76;
    const src = im || sceneTex(card.scene || 'mountains', hashStr(card.caption || card.scene || 'x'));
    const sw = src.width, sh = src.height, r = Math.max((w - pad * 2) / sw, ih / sh), cw = (w - pad * 2) / r, ch = ih / r;
    g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, pad, pad, w - pad * 2, ih);
    if (kind === 'polaroid' && card.caption) text(card.caption, w / 2, h - 70, `italic 44px ${F.SERIF}`, '#2b2b3a', 'center');
    return;
  }
  if (kind === 'note') {
    g.fillStyle = '#efe0a0'; g.fillRect(0, 0, w, h);
    const ls = wrap(card.text || (card.lines || []).join(' '), w - 90, `italic 58px ${F.SERIF}`);
    ls.slice(0, 5).forEach((l, i) => text(l, 45, 140 + i * 72, `italic 58px ${F.SERIF}`, '#2a2340'));
    return;
  }
  if (kind === 'clip') {
    g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, w, h);
    text((card.source || 'THE DAILY RECORD').toUpperCase(), w / 2, 60, `700 30px ${F.SERIF}`, '#333', 'center', 6);
    g.fillStyle = '#333'; g.fillRect(30, 76, w - 60, 3);
    const hl = wrap(card.headline || card.text || '', w - 70, `bold 64px ${F.SERIF}`).slice(0, 3);
    hl.forEach((l, i) => text(l, 35, 150 + i * 70, `bold 64px ${F.SERIF}`, '#151515'));
    const y0 = 150 + hl.length * 70; const r = rng(hashStr(card.headline || 'c'));
    g.fillStyle = 'rgba(40,40,40,0.55)';
    for (let col = 0; col < 3; col++) for (let y = y0; y < h - 30; y += 22) g.fillRect(35 + col * (w - 70) / 3, y, (w - 70) / 3 - 20 - r() * 30, 9);
    return;
  }
  // index card with typewriter reveal
  g.fillStyle = '#efe6cf'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(200,40,40,0.55)'; g.fillRect(0, 110, w, 4);
  g.fillStyle = 'rgba(70,110,170,0.28)'; for (let i = 1; i < 8; i++) g.fillRect(0, 110 + i * 82, w, 2.5);
  let left = shown; const lines = card.lines || [card.text || ''];
  lines.slice(0, 7).forEach((line, i) => {
    const s = line.slice(0, Math.max(0, left)); left -= line.length;
    text(s, 50, i === 0 ? 84 : 110 + i * 82 - 18, `${i === 0 ? 'bold ' : ''}46px ${F.TYPE}`, '#1d1b26');
  });
}
export function board(d, S, idx) {
  const scene = stage({ bg: 0x0c0806, fog: [0x0c0806, 14, 40], envI: 0.15 }), camera = cam(34);
  const cork = new THREE.CanvasTexture(corkTex()); cork.colorSpace = THREE.SRGBColorSpace; cork.userData.shared = false;
  const boardM = new THREE.Mesh(new THREE.PlaneGeometry(18, 10.5), new THREE.MeshStandardMaterial({ map: cork, bumpMap: cork, bumpScale: 0.6, roughness: 0.95 }));
  boardM.receiveShadow = true; scene.add(boardM);
  const frameM = material('wood');
  for (const [w, h, x, y] of [[18.6, 0.3, 0, 5.4], [18.6, 0.3, 0, -5.4], [0.3, 10.5, 9.15, 0], [0.3, 10.5, -9.15, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), frameM); f.position.set(x, y, 0.1); f.castShadow = f.receiveShadow = true; scene.add(f); }
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 })); wall.position.z = -0.05; wall.receiveShadow = true; scene.add(wall);
  scene.add(new THREE.AmbientLight(0xffe0c0, 0.12));
  spot(scene, { color: 0xffc98e, intensity: 6, pos: [-5, 5, 10], target: [0, 0, 0], angle: 0.55, penumbra: 0.8 });
  dirLight(scene, 0x8aa6ff, 0.3, [8, 2, 6]);
  const cards = (d.cards || []).slice(0, 5), n = cards.length || 1, slots = SLOTS[n] || SLOTS[5], r = rng(idx * 31 + 7);
  const times = S.reveal(cards, 0.03, 0.7);
  const pinMat = material('red'), needle = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 });
  const items = cards.map((c, i) => {
    const [wU, hU] = CARD[c.kind || 'index'] || CARD.index; const PX = 300;
    const total = (c.lines || []).reduce((a, l) => a + l.length, 0);
    const ct = canvasTex(Math.round(wU * PX), Math.round(hU * PX), (g, shown) => drawCard(c, Math.round(wU * PX), Math.round(hU * PX), shown, g));
    const side = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.9 });
    const front = new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.75 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(wU, hU, 0.015), [side, side, side, side, front, side]);
    m.castShadow = true; m.receiveShadow = true;
    const [sx, sy] = slots[i]; const rot = (r() - 0.5) * 0.12, z = 0.03 + i * 0.006;
    m.position.set(sx, sy, z); m.rotation.z = rot; scene.add(m);
    const pinG = new THREE.Group(); const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), pinMat); head.position.z = 0.12; head.castShadow = true;
    const nd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), needle); nd.rotation.x = Math.PI / 2; nd.position.z = 0.05; pinG.add(head, nd);
    const pl = new THREE.Vector3(0, hU / 2 - 0.1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rot); pinG.position.set(sx + pl.x, sy + pl.y, z); scene.add(pinG);
    return { c, m, pinG, ct, total, shown: -1, t: times[i], home: [sx, sy, z], typed: (c.kind || 'index') === 'index' };
  });
  const links = d.links || items.slice(1).map((_, i) => [i, i + 1]);
  const strings = links.filter(([a, b]) => items[a] && items[b]).map(([a, b]) => {
    const A = items[a].pinG.position.clone().setZ(0.14), B = items[b].pinG.position.clone().setZ(0.14);
    const mid = A.clone().lerp(B, 0.5); mid.y -= 0.35 + A.distanceTo(B) * 0.04; mid.z = 0.2;
    const tub = 48, rad = 6; const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, mid, B), tub, 0.014, rad, false);
    const s = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb0141c, roughness: 0.6 })); s.castShadow = true; scene.add(s);
    return { s, geo, tub, rad, t: Math.max(items[a].t, items[b].t) + 0.35 };
  });
  let titleP; if (d.title) { const tt = canvasTex(1400, 260, g => { g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 1400, 260); text(String(d.title).toUpperCase(), 60, 168, `bold 96px ${F.TYPE}`, '#1d1b26', 'left', 6); }); titleP = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.78, 0.01), new THREE.MeshStandardMaterial({ map: tt.tex, roughness: 0.8 })); titleP.position.set(-6, 4.35, 0.03); titleP.rotation.z = 0.02; titleP.castShadow = true; scene.add(titleP); }
  return {
    scene, camera,
    update(lt) {
      let fx = 0, fy = 0, dist = 14.5;
      items.forEach(it => {
        const p = lin(lt, it.t, it.t + 0.28);
        it.m.visible = it.pinG.visible = p > 0;
        it.m.position.z = it.home[2] + lerp(1.2, 0, eo(p)); it.m.scale.setScalar(lerp(1.12, 1, eo(p)));
        it.pinG.scale.setScalar(lin(lt, it.t + 0.2, it.t + 0.32) > 0 ? 1 : 0.001);
        if (it.typed) { const sh = Math.floor(it.total * lin(lt, it.t + 0.2, it.t + 0.2 + Math.min(2.6, it.total * 0.045))); if (sh !== it.shown) { it.shown = sh; it.ct.redraw(sh); } }
        const k = eio(lin(lt, it.t - 0.1, it.t + 0.9)); fx = lerp(fx, it.home[0], k * 0.55); fy = lerp(fy, it.home[1], k * 0.55); dist = lerp(dist, 10.5, k * 0.5);
      });
      strings.forEach(s => { const p = eo(lin(lt, s.t, s.t + 0.6)); s.s.visible = p > 0; s.geo.setDrawRange(0, Math.floor(p * s.tub) * s.rad * 6); });
      const drift = lt * 0.12;
      camera.position.set(fx + 1.4 - drift, fy - 0.6, dist - drift * 0.6); camera.lookAt(fx * 0.9, fy * 0.9, 0);
    },
    overlay(lt) { lowerThird(d.caption, d.sub, sm(lin(lt, 0.4, 1.0))); },
  };
}

// ---------- CHECKLIST (parchment on a desk, 3D rubber stamp) ----------
export function checklist(d, S) {
  const { scene } = deskScene(), camera = cam(34);
  const PX = 200, wU = 6.4, hU = 5.8, w = wU * PX, h = hU * PX;
  const items = d.items || [];
  const appear = S.reveal(items, 0.03, 0.4);
  const markT = items.map((it, i) => (it.markCue ? S.cue(it.markCue, null) : null) ?? lerp(S.dur * 0.45, S.dur * 0.72, items.length > 1 ? i / (items.length - 1) : 0));
  const stampT = d.stamp ? (d.stamp.cue ? S.cue(d.stamp.cue, S.dur * 0.8) : S.dur * 0.8) : Infinity;
  const ROWY = i => 430 + i * 125;
  const ct = canvasTex(w, h, (g, st) => {
    st = st || { items: [], marks: [], stamp: 0 };
    g.drawImage(parchTex(w, h, 33), 0, 0);
    text(String(d.title || 'CAUSE OF DEATH').toUpperCase(), 110, 170, `bold 76px ${F.SERIF}`, C.INK, 'left', 3);
    g.fillStyle = C.INK; g.fillRect(110, 200, w - 220, 4); g.fillRect(110, 212, w - 220, 1.5);
    if (d.subtitle) text(d.subtitle, 110, 280, `italic 40px ${F.SERIF}`, '#5a3b1e');
    items.forEach((it, i) => {
      const a = st.items[i]; if (a <= 0) return; const y = ROWY(i);
      g.save(); g.globalAlpha = a; g.strokeStyle = C.INK; g.lineWidth = 4; g.strokeRect(110, y - 50, 58, 58);
      text(it.text, 205, y, `52px ${F.SERIF}`, C.INK); g.restore();
      const mp = st.marks[i]; if (mp <= 0) return;
      const mark = it.mark || 'check';
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      if (mark === 'check') { g.strokeStyle = '#2a170a'; g.lineWidth = 10; const P = [[118, y - 26], [142, y + 2], [192, y - 74]]; g.beginPath(); g.moveTo(...P[0]); if (mp < 0.35) g.lineTo(lerp(P[0][0], P[1][0], mp / 0.35), lerp(P[0][1], P[1][1], mp / 0.35)); else { g.lineTo(...P[1]); const u = (mp - 0.35) / 0.65; g.lineTo(lerp(P[1][0], P[2][0], u), lerp(P[1][1], P[2][1], u)); } g.stroke(); }
      else if (mark === 'cross') { g.strokeStyle = '#a3121a'; g.lineWidth = 8; const tw = measure(it.text, `52px ${F.SERIF}`); g.beginPath(); g.moveTo(195, y - 18); g.lineTo(195 + (tw + 20) * mp, y - 18); g.stroke(); }
      else if (mark === 'question') { text('?', 205 + measure(it.text, `52px ${F.SERIF}`) + 30, y + 10, `italic bold 100px ${F.SERIF}`, '#a3121a', 'left', 0, mp); }
      g.restore();
    });
    if (st.stamp > 0) { stamp2d(String(d.stamp.text).toUpperCase(), w * 0.66, h * 0.8, -0.2, 1, '#a8141c', 92, '#dcc590'); }
  });
  const paper = paperMesh(ct.tex, wU, hU); paper.rotation.z = 0.03; scene.add(paper);
  // 3D stamp
  const stampG = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 20), material('wood')); handle.position.y = 0.75;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), material('wood')); knob.position.y = 1.25;
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.26, 0.8), material('dark')); base.position.y = 0.2;
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.75), material('red')); rubber.position.y = 0.04;
  [handle, knob, base, rubber].forEach(m => { m.castShadow = true; stampG.add(m); });
  const sx = w * 0.66 / PX - wU / 2, sz = h * 0.8 / PX - hU / 2; stampG.position.set(sx, 6, sz); stampG.rotation.y = 0.2; scene.add(stampG);
  let key = '';
  return {
    scene, camera,
    update(lt) {
      const st = { items: items.map((_, i) => sm(lin(lt, appear[i], appear[i] + 0.3))), marks: items.map((it, i) => (it.mark === 'none' ? 0 : lin(lt, markT[i], markT[i] + 0.4))), stamp: lt >= stampT ? 1 : 0 };
      const k = JSON.stringify(st, (_, v) => (typeof v === 'number' ? Math.round(v * 40) / 40 : v)); if (k !== key) { key = k; ct.redraw(st); }
      // stamp motion
      if (isFinite(stampT)) {
        const down = lin(lt, stampT - 0.28, stampT), up = lin(lt, stampT + 0.25, stampT + 0.7);
        stampG.position.y = up > 0 ? lerp(0.02, 6, eio(up)) : lerp(6, 0.02, down * down);
      }
      const u = lt / S.dur; const act = items.reduce((a, _, i) => (lt > appear[i] ? i : a), 0);
      const fz = (ROWY(act) / PX - hU / 2) * 0.6;
      camera.position.set(lerp(0.8, 0.3, u), lerp(7.2, 5.6, sm(u)), lerp(5.4, 4.2, sm(u)) + fz * 0.4); camera.lookAt(0, 0, lerp(0.2, fz, 0.5));
      shake(camera, lt > stampT ? Math.exp(-(lt - stampT) * 14) * 0.08 : 0, lt);
    },
    overlay(lt) { lowerThird(d.caption, d.sub, sm(lin(lt, 0.4, 1.0))); },
  };
}

// ---------- DOCUMENT (paper on desk, highlighter sweeps) ----------
export function document_(d, S) {
  const { scene } = deskScene(), camera = cam(36);
  const PX = 200, wU = 5.6, hU = 7.2, w = wU * PX, h = hU * PX;
  const letter = d.style === 'letter';
  const bodyFont = letter ? `italic 48px ${F.SERIF}` : `40px ${F.TYPE}`, lh = letter ? 70 : 62;
  const lines = []; (d.lines || [d.text || '']).forEach(p => { wrap(p, w - 220, bodyFont).forEach(l => lines.push(l)); lines.push(''); });
  const hl = (d.highlight || []).map(p => ({ p, t: S.cue(String(p).split(/\s+/)[0], null) }));
  hl.forEach((x, i) => { if (x.t == null) x.t = lerp(S.dur * 0.35, S.dur * 0.75, hl.length > 1 ? i / (hl.length - 1) : 0); });
  const ct = canvasTex(w, h, (g, prog = []) => {
    g.drawImage(parchTex(w, h, 61, letter ? [228, 210, 165] : [236, 228, 208]), 0, 0);
    let y = 150;
    if (d.heading) { text(String(d.heading).toUpperCase(), w / 2, y, `bold 54px ${letter ? F.SERIF : F.TYPE}`, '#1d1b26', 'center', 4); y += 50; g.fillStyle = '#1d1b26'; g.fillRect(110, y, w - 220, 3); y += 80; }
    lines.forEach(l => {
      if (l) {
        hl.forEach((x, i) => { const at = l.indexOf(x.p); const p = prog[i] || 0; if (p <= 0) return; let a0 = -1, a1 = -1;
          if (at >= 0) { a0 = at; a1 = at + x.p.length; } else if (x.p.includes(l.trim())) { a0 = 0; a1 = l.length; }
          if (a0 < 0) return; const x0 = 110 + measure(l.slice(0, a0), bodyFont), x1 = 110 + measure(l.slice(0, a1), bodyFont);
          g.fillStyle = 'rgba(255,214,50,0.5)'; g.fillRect(x0 - 6, y - lh * 0.62, (x1 - x0 + 12) * p, lh * 0.8); });
        text(l, 110, y, bodyFont, '#1d1b26');
      }
      y += lh;
    });
    if (d.signature) text(d.signature, w - 140, h - 160, `italic 64px ${F.SERIF}`, '#1d2a55', 'right');
  });
  const paper = paperMesh(ct.tex, wU, hU); paper.rotation.z = -0.04; scene.add(paper);
  // props: pen + magnifier for depth
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 16), material('dark')); pen.rotation.set(Math.PI / 2, 0, 0.7); pen.position.set(3.6, 0.07, 1.2); pen.castShadow = true; scene.add(pen);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 16), material('gold')); tip.rotation.set(0, 0, 0); pen.add(tip); tip.position.y = 1.32;
  const mag = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 12, 48), material('bronze')); ring.rotation.x = Math.PI / 2; const lens = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48), material('glass')); lens.rotation.x = -Math.PI / 2; const hand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 16), material('wood')); hand.rotation.z = Math.PI / 2; hand.position.x = 1.45;
  mag.add(ring, lens, hand); mag.position.set(-3.9, 0.12, -1.5); mag.rotation.y = 0.6; ring.castShadow = hand.castShadow = true; scene.add(mag);
  let key = '';
  return {
    scene, camera,
    update(lt) {
      const prog = hl.map(x => lin(lt, x.t, x.t + 0.6)); const k = prog.map(p => p.toFixed(2)).join(); if (k !== key) { key = k; ct.redraw(prog); }
      camPath(camera, [{ t: 0, pos: [-1.0, 7.0, 2.4], look: [0, 0, -1.4] }, { t: 1, pos: [0.7, 6.2, 5.0], look: [0, 0, 0.8] }], lt / S.dur, x => sm(x));
    },
    overlay(lt) { lowerThird(d.caption, d.sub, sm(lin(lt, 0.4, 1.0))); },
  };
}

// ---------- QUOTE (carved into a stone slab, raking light) ----------
export function quote(d, S) {
  const scene = stage({ bg: 0x050403, fog: [0x050403, 10, 30], envI: 0.15 }), camera = cam(32);
  const w = 2400, h = 1200;
  const ct = canvasTex(w, h, g => {
    const r = rng(9); g.fillStyle = '#8f877b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,35,30' : '200,190,175'},${r() * 0.12})`; const s = 2 + r() * 10; g.fillRect(r() * w, r() * h, s, s); }
    const size = fitFont(d.text, w - 400, 5, 96, 48, s => `italic ${s}px ${F.SERIF}`); const font = `italic ${size}px ${F.SERIF}`;
    const ls = wrap(`“${d.text}”`, w - 400, font); const y0 = h / 2 - (ls.length - 1) * size * 0.65 - (d.attribution ? 50 : 0);
    ls.forEach((l, i) => { const y = y0 + i * size * 1.3; text(l, w / 2 + 3, y + 3, font, 'rgba(255,245,230,0.35)', 'center'); text(l, w / 2, y, font, '#2a241d', 'center'); });
    if (d.attribution) text(`— ${d.attribution}`.toUpperCase(), w / 2, y0 + ls.length * size * 1.3 + 50, `600 44px ${F.SANS}`, '#3a3128', 'center', 8);
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.6), [material('stone'), material('stone'), material('stone'), material('stone'), new THREE.MeshStandardMaterial({ map: ct.tex, bumpMap: ct.tex, bumpScale: 1.5, roughness: 0.95 }), material('stone')]);
  slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  floor(scene, { color: 0x0f0b08, y: -3.05 });
  const rake = spot(scene, { color: 0xffcf98, intensity: 7, pos: [-9, 2, 4], target: [0, 0, 0], angle: 0.5, penumbra: 0.9 });
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  dustPoints(scene, { center: [0, 0, 2], spread: [16, 8, 6], n: 300 });
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      camPath(camera, [{ t: 0, pos: [-3.0, 0.3, 14.5], look: [0, 0, 0] }, { t: 1, pos: [1.0, 0.1, 12.8], look: [0, 0, 0] }], u, x => x);
      rake.position.x = lerp(-10, -5, u); rake.intensity = lerp(2, 7, sm(lin(lt, 0, 1.2)));
    },
  };
}
