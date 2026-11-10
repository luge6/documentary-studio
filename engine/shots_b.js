// 3D shots, part B: map, timeline, photo, bars, xray, artifact, landscape, molecule.
import { THREE, stage, spot, dirLight, cam, camPath, shake, dustPoints, floor, text3d, material, canvasTex, texPlane, project, models, images } from './world.js';
import { W, H, F, C, clamp, lin, sm, eo, eio, eob, lerp, rng, hashStr, noise2, text, wrap, measure, sceneTex, lowerThird, brackets, SCANLINES, mk, G } from './core.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- MAP (3D relief with pin drop) ----------
function heightFn(kind, nz) {
  switch (kind) {
    case 'desert': return (x, z) => (0.5 + 0.5 * Math.sin(x * 0.5 + nz(x * 0.05, z * 0.05) * 6)) * 0.6 + nz(x * 0.08, z * 0.08) * 1.6;
    case 'coast': return (x, z) => Math.max(-0.6, nz(x * 0.09 + 3, z * 0.09 + 3, 5) * 5 - 2.2 + x * 0.08);
    case 'plains': case 'forest': return (x, z) => nz(x * 0.07, z * 0.07, 4) * 1.8;
    case 'canyon': return (x, z) => { const n = nz(x * 0.08, z * 0.08); const river = Math.abs(Math.sin(z * 0.15 + n * 3) * 6 - x); return 2.4 * clamp(river / 3) + n * 0.8; };
    default: return (x, z) => Math.pow(nz(x * 0.1 + 5, z * 0.1 + 5, 5), 1.7) * 6.5;
  }
}
export function map(d, S, idx) {
  const scene = stage({ bg: 0x0b0f12, fog: [0x0b0f12, 30, 70], envI: 0.15 }), camera = cam(34);
  const kind = d.terrain || 'mountain', nz = noise2(hashStr(d.place || 'map') + idx), hf = heightFn(kind, nz);
  const SZ = 26, TX = 768;
  const ct = canvasTex(TX, TX, g => {
    const id = g.createImageData(TX, TX), D = id.data;
    const ramp = kind === 'desert' ? [[0, [120, 86, 52]], [0.5, [184, 140, 88]], [1, [228, 200, 150]]] : [[0, [40, 56, 52]], [0.35, [92, 104, 78]], [0.7, [170, 160, 132]], [1, [238, 232, 220]]];
    const top = kind === 'mountain' ? 6.5 : kind === 'coast' ? 3 : kind === 'canyon' ? 3.2 : 2.2;
    for (let j = 0; j < TX; j++) for (let i = 0; i < TX; i++) {
      const x = (i / TX - 0.5) * SZ, z = (j / TX - 0.5) * SZ, h = hf(x, z), u = clamp(h / top);
      let k = 0; while (k < ramp.length - 2 && u > ramp[k + 1][0]) k++;
      const a = ramp[k], b = ramp[k + 1], t = clamp((u - a[0]) / (b[0] - a[0]));
      let c = [0, 1, 2].map(q => lerp(a[1][q], b[1][q], t));
      if (h <= -0.5) c = [26, 44, 60];
      const f = (h * 3) % 1; if (h > -0.5 && f < 0.07) c = c.map(v => v * 0.72);
      const o = (j * TX + i) * 4; D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    g.strokeStyle = 'rgba(255,240,210,0.12)'; g.lineWidth = 1; for (let i = 0; i <= TX; i += TX / 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, TX); g.moveTo(0, i); g.lineTo(TX, i); g.stroke(); }
  });
  const geo = new THREE.PlaneGeometry(SZ, SZ, 180, 180); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.max(-0.5, hf(p.getX(i), p.getZ(i))));
  geo.computeVertexNormals();
  const terr = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.95 })); terr.receiveShadow = terr.castShadow = true; scene.add(terr);
  if (kind === 'coast') { const wtr = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshStandardMaterial({ color: 0x1d3a52, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = -0.3; scene.add(wtr); }
  const sun = dirLight(scene, 0xffd9a8, 2.6, [-14, 9, 6], true, 16); scene.add(new THREE.HemisphereLight(0x9bb4d0, 0x2a2018, 0.45));
  const px = d.pin?.[0] ?? 1.6, pz = d.pin?.[1] ?? -1.2, py = Math.max(-0.3, hf(px, pz));
  const pinG = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 24), material('red')); cone.rotation.x = Math.PI; cone.position.y = 0.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), material('red')); head.position.y = 1.05; cone.castShadow = head.castShadow = true; pinG.add(cone, head); scene.add(pinG);
  const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: 0xff5040, transparent: true, toneMapped: false })); r.rotation.x = Math.PI / 2; r.position.set(px, py + 0.06, pz); scene.add(r); return r; });
  const pinT = d.cue ? S.cue(d.cue, S.dur * 0.35) : S.dur * 0.35;
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      camPath(camera, [{ t: 0, pos: [-2, 24, 16], look: [0, 0, -1] }, { t: 1, pos: [px - 3.5, py + 6.5, pz + 8], look: [px, py + 0.5, pz] }], u, eio);
      const dp = lin(lt, pinT - 0.35, pinT); pinG.position.set(px, py + lerp(7, 0, dp * dp), pz); pinG.visible = dp > 0;
      rings.forEach((r, i) => { const ph = ((lt - pinT) / 1.4 + i / 3) % 1; const on = lt > pinT; r.visible = on; const s = lerp(0.2, 2.6, ph); r.scale.set(s, s, s); r.material.opacity = on ? (1 - ph) * 0.9 : 0; });
    },
    overlay(lt) {
      const a = sm(lin(lt, pinT + 0.15, pinT + 0.6)); if (a <= 0) return;
      const [sx, sy] = project(V3(px, py + 1.4, pz), camera); const g = G.ctx;
      const name = d.place || '', sub = d.coords || '', reg = d.region || '';
      const bw = Math.max(measure(name, `600 44px ${F.SERIF}`), measure(sub, `500 22px ${F.MONO}`, 3)) + 60;
      const bx = clamp(sx + 40, 40, W - bw - 40), by = clamp(sy - 150, 60, H - 220);
      g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(255,90,70,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(bx, by + 60); g.stroke();
      g.fillStyle = 'rgba(8,10,12,0.78)'; g.fillRect(bx, by, bw, reg ? 150 : 115); g.fillStyle = C.RED; g.fillRect(bx, by, 5, reg ? 150 : 115);
      text(name, bx + 28, by + 58, `600 44px ${F.SERIF}`, C.CREAM); text(sub, bx + 30, by + 96, `500 22px ${F.MONO}`, C.AMBER, 'left', 3);
      if (reg) text(String(reg).toUpperCase(), bx + 30, by + 132, `500 18px ${F.SANS}`, C.MUTED, 'left', 4);
      g.restore();
    },
  };
}

// ---------- TIMELINE (3D track with event plinths) ----------
export function timeline(d, S) {
  const scene = stage({ bg: 0x070504, fog: [0x070504, 12, 34], envI: 0.25 }), camera = cam(36);
  floor(scene, { color: 0x100b08, rough: 0.4 });
  const ev = (d.events || []).slice(0, 9), GAP = 4.0, len = (ev.length - 1) * GAP;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len + 8, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0xe0a958, emissive: 0xb07020, emissiveIntensity: 0.9 })); rail.position.set(len / 2, 0.03, 1.4); scene.add(rail);
  const times = S.reveal(ev, 0.03, 0.75);
  const items = ev.map((e, i) => {
    const hi = d.highlight === i || e.highlight;
    const ct = canvasTex(1040, 640, g => {
      g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, 1040, 640); g.fillStyle = hi ? C.RED : '#3a2412'; g.fillRect(0, 0, 1040, 14);
      text(String(e.date), 60, 180, `bold 140px ${F.SERIF}`, hi ? '#a3121a' : '#2a1a0c');
      wrap(e.label || '', 920, `62px ${F.SERIF}`).slice(0, 4).forEach((l, k) => text(l, 62, 300 + k * 84, `62px ${F.SERIF}`, '#2b2118'));
    });
    const grp = new THREE.Group(); grp.position.x = i * GAP; scene.add(grp);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.1), material('stone')); plinth.position.y = 0.35; plinth.castShadow = plinth.receiveShadow = true;
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.97, 0.06), [material('dark'), material('dark'), material('dark'), material('dark'), new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.8 }), material('dark')]);
    board.position.set(0, 2.1, 0); board.rotation.y = -0.18; board.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), material('bronze')); post.position.y = 1.0;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), new THREE.MeshStandardMaterial({ color: hi ? 0xff4030 : 0xffc070, emissive: hi ? 0xff2010 : 0xffa040, emissiveIntensity: 2 })); dot.position.set(0, 0.06, 1.4);
    const pl = new THREE.PointLight(hi ? 0xff4030 : 0xffb060, hi ? 6 : 3, 5, 1.5); pl.position.set(0, 1.5, 2.2);
    grp.add(plinth, board, post, dot, pl);
    return { grp, t: times[i] };
  });
  scene.add(new THREE.AmbientLight(0xffe0c0, 0.15)); dirLight(scene, 0xffd2a0, 1.2, [-6, 10, 8], true, 30).target.position.set(len / 2, 0, 0);
  dustPoints(scene, { center: [len / 2, 2, 1], spread: [len + 20, 6, 10], n: 500 });
  return {
    scene, camera,
    update(lt) {
      let fx = 0;
      items.forEach(it => { const p = eo(lin(lt, it.t, it.t + 0.5)); it.grp.visible = p > 0; it.grp.position.y = lerp(-2.4, 0, p); fx = lerp(fx, it.grp.position.x, eio(lin(lt, it.t - 0.3, it.t + 0.7))); });
      camera.position.set(fx - 1.8 + lt * 0.05, 3.6, 11.5); camera.lookAt(fx + 0.4, 1.5, 0);
    },
    overlay(lt) { lowerThird(d.caption, d.sub, sm(lin(lt, 0.4, 1.0))); },
  };
}

// ---------- PHOTO (print on a desk, or a flat full-frame move) ----------
function photoCanvas(d, idx) {
  const im = d.src && images[d.src]; const src = im || sceneTex(d.scene || 'ruins', idx + 3, 1280, 900);
  const c = mk(1600, 1100), g = c.getContext('2d');
  if (d.bw) g.filter = 'grayscale(1) sepia(0.25) contrast(1.05)';
  const r = Math.max(1600 / src.width, 1100 / src.height), cw = 1600 / r, ch = 1100 / r; g.drawImage(src, (src.width - cw) / 2, (src.height - ch) / 2, cw, ch, 0, 0, 1600, 1100);
  return c;
}
export function photo(d, S, idx) {
  const pc = photoCanvas(d, idx); const tex = new THREE.CanvasTexture(pc); tex.colorSpace = THREE.SRGBColorSpace;
  if (d.layout === 'flat') {
    const scene = stage({ bg: 0x000000, fog: null, envI: 0 }), camera = cam(30);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(16 * 1.12, 11 * 1.12), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scene.add(pl);
    const mv = d.move || 'in', D0 = 21;
    return {
      scene, camera,
      update(lt) { const u = sm(lt / S.dur); const z = mv === 'out' ? lerp(D0 * 0.82, D0, u) : mv === 'in' ? lerp(D0, D0 * 0.82, u) : D0 * 0.88; const x = mv === 'left' ? lerp(1.2, -1.2, u) : mv === 'right' ? lerp(-1.2, 1.2, u) : 0; camera.position.set(x, 0, z); camera.lookAt(x * 0.9, 0, 0); },
      overlay(lt) { lowerThird(d.caption, d.credit, sm(lin(lt, 0.4, 1.0))); },
    };
  }
  const scene = stage({ bg: 0x0a0604, fog: [0x0a0604, 14, 40], envI: 0.2 }), camera = cam(34);
  const wt = new THREE.CanvasTexture(sceneTex('none', 1, 4, 4)); // placeholder replaced below
  const deskTex = new THREE.CanvasTexture((() => { const c = mk(2200, 1300), g = c.getContext('2d'); g.fillStyle = '#24170d'; g.fillRect(0, 0, 2200, 1300); const r = rng(44); for (let i = 0; i < 700; i++) { const y = r() * 1300; g.strokeStyle = r() < 0.5 ? 'rgba(70,45,22,0.35)' : 'rgba(10,6,2,0.4)'; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 2200; x += 100) g.lineTo(x, y + Math.sin(x * 0.003 + i) * 6); g.stroke(); } return c; })());
  wt.dispose(); deskTex.colorSpace = THREE.SRGBColorSpace;
  floor(scene, { size: 40, color: 0xffffff, map: deskTex });
  const mkPrint = (map, w, h) => { const side = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8 }); const ct = canvasTex(1700, 1200, g => { g.fillStyle = '#f2eee4'; g.fillRect(0, 0, 1700, 1200); g.drawImage(map, 50, 50, 1600, 1100); }); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), [side, side, side, side, new THREE.MeshStandardMaterial({ map: ct.tex, roughness: 0.55 }), side]); m.rotation.x = -Math.PI / 2; m.castShadow = m.receiveShadow = true; return m; };
  const r = rng(idx);
  for (let i = 0; i < 2; i++) { const m = mkPrint(photoCanvas({ scene: ['ruins', 'desert', 'tomb', 'mountains'][(r() * 4) | 0], bw: true }, idx + 9 + i), 4.6, 3.2); m.position.set(lerp(-3.5, 3.5, r()), 0.01 + i * 0.01, lerp(-2.5, 1.5, r())); m.rotation.z = (r() - 0.5) * 0.8; scene.add(m); }
  const main = mkPrint(pc, 6.2, 4.3); main.position.set(0, 0.05, 0); main.rotation.z = -0.05; scene.add(main);
  scene.add(new THREE.AmbientLight(0xffe2c0, 0.14)); spot(scene, { color: 0xffc584, intensity: 5.5, pos: [-4, 8, 2.5], target: [0, 0, 0], angle: 0.55, penumbra: 0.8 });
  return {
    scene, camera,
    update(lt) { camPath(camera, [{ t: 0, pos: [-1.5, 9.0, 6.2], look: [0, 0, 0.3] }, { t: 1, pos: [0.6, 7.6, 4.6], look: [0, 0, 0.1] }], lt / S.dur, sm); },
    overlay(lt) { lowerThird(d.caption, d.credit, sm(lin(lt, 0.4, 1.0))); },
  };
}

// ---------- BARS (3D bar chart) ----------
export function bars(d, S) {
  const scene = stage({ bg: 0x080605, fog: [0x080605, 14, 40], envI: 0.35 }), camera = cam(34);
  floor(scene, { color: 0x15100c, rough: 0.45 });
  const it = (d.items || []).slice(0, 7), n = it.length, max = Math.max(...it.map(x => +x.value || 0), 1), GAP = 2.2, x0 = -(n - 1) * GAP / 2;
  const times = S.reveal(it, 0.05, 0.6);
  const bs = it.map((x, i) => {
    const hi = d.highlight === i || x.highlight; const h = Math.max(0.05, (+x.value / max) * 5);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 1.3), material(hi ? 'red' : i % 2 ? 'gold' : 'bronze')); m.castShadow = m.receiveShadow = true; m.position.x = x0 + i * GAP; scene.add(m);
    const lt_ = canvasTex(800, 220, () => text(String(x.label).toUpperCase(), 400, 140, `600 64px ${F.SANS}`, C.CREAM, 'center', 6)); const lp = texPlane(2.2, 0.6, lt_.tex, { lit: false }); lp.position.set(m.position.x, 0.35, 1.2); lp.rotation.x = -0.3; scene.add(lp);
    const vt = canvasTex(800, 240, () => text(`${d.prefix || ''}${x.display ?? Number(x.value).toLocaleString('en-US')}${d.unit || ''}`, 400, 170, `bold 120px ${F.SERIF}`, hi ? '#ff6a5a' : C.CREAM, 'center')); const vp = texPlane(2.2, 0.66, vt.tex, { lit: false }); scene.add(vp);
    return { m, h, vp, t: times[i] };
  });
  let tp; if (d.title) { const tt = canvasTex(2400, 220, () => text(String(d.title).toUpperCase(), 1200, 150, `600 84px ${F.SANS}`, C.AMBER, 'center', 14)); tp = texPlane(14, 1.28, tt.tex, { lit: false }); tp.position.set(0, 7, -1); scene.add(tp); }
  scene.add(new THREE.AmbientLight(0xffffff, 0.08)); spot(scene, { color: 0xffd6a6, intensity: 5, pos: [-5, 12, 8], target: [0, 2, 0], angle: 0.7 }); spot(scene, { color: 0x7ea2ff, intensity: 2, pos: [6, 4, -6], target: [0, 2, 0], shadow: false });
  return {
    scene, camera,
    update(lt) {
      bs.forEach(b => { const p = eo(lin(lt, b.t, b.t + 0.9)); const h = Math.max(0.001, b.h * p); b.m.scale.y = h; b.m.position.y = h / 2; b.vp.position.set(b.m.position.x, h + 0.55, 0.7); b.vp.material.opacity = sm(lin(lt, b.t + 0.6, b.t + 1.0)); });
      camPath(camera, [{ t: 0, pos: [-5, 4.5, 13], look: [0, 2.6, 0] }, { t: 1, pos: [4, 3.8, 12], look: [0, 2.8, 0] }], lt / S.dur, x => x);
    },
  };
}

// ---------- XRAY (full-body 3D radiograph) ----------
const xray = (color, s = 1) => new THREE.ShaderMaterial({
  uniforms: { c: { value: new THREE.Color(color) }, s: { value: s } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 c; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 1.7)*0.85 + 0.06; gl_FragColor = vec4(c*a*s, 1.); }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false,
});
const FOCUS = {
  full: [0, -0.4, 0, 13], skull: [0, 2.7, 0.05, 3.2], jaw: [0, 2.3, 0.3, 2.4], teeth: [0, 2.3, 0.3, 2.4], chest: [0, 0.9, 0, 5], spine: [0, 0.4, -0.5, 6],
  left_shoulder: [0.85, 1.25, -0.35, 3.4], right_shoulder: [-0.85, 1.25, -0.35, 3.4], pelvis: [0, -0.55, 0, 4], hips: [0, -0.55, 0, 4],
  left_arm: [1.08, -0.3, 0, 4.6], right_arm: [-1.08, -0.3, 0, 4.6], left_leg: [0.4, -2.2, 0, 4.8], right_leg: [-0.4, -2.2, 0, 4.8],
  left_knee: [0.38, -2.15, 0.05, 2.8], right_knee: [-0.38, -2.15, 0.05, 2.8], abdomen: [0, 0.0, 0.2, 4.5],
};
function skeleton(BONE, FLESH) {
  const sk = new THREE.Group();
  const tube = (pts, r, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8, false), mat); sk.add(m); return m; };
  const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); sk.add(m); return m; };
  // skull
  add(new THREE.SphereGeometry(0.5, 28, 20), BONE, [0, 2.78, -0.02]).scale.set(0.82, 1, 1);
  add(new THREE.TorusGeometry(0.3, 0.05, 8, 24, Math.PI), BONE, [0, 2.36, 0.12], [Math.PI / 2 + 0.3, 0, Math.PI]);
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.1, 0.025, 8, 20), BONE, [s * 0.17, 2.72, 0.4]);
  for (let i = 0; i < 10; i++) add(new THREE.BoxGeometry(0.045, 0.06, 0.04), BONE, [Math.sin((i / 9 - 0.5) * 2.2) * 0.25, 2.4, 0.3 + Math.cos((i / 9 - 0.5) * 2.2) * 0.12 - 0.12]);
  // spine
  for (let i = 0; i < 30; i++) { const y = 2.2 - i * 0.1, z = -0.5 + 0.07 * Math.sin((i / 29) * Math.PI * 1.5) + (y < 0 ? 0.05 : 0); add(new THREE.CylinderGeometry(0.06 + i * 0.0015, 0.07 + i * 0.0015, 0.075, 12), BONE, [0, y, z]); }
  // ribs
  for (let i = 0; i < 11; i++) {
    const yi = 1.38 - i * 0.165, rx = 0.42 + 0.42 * Math.sin(Math.PI * (i + 2.2) / 15), rz = 0.52 + 0.05 * Math.sin(Math.PI * i / 11), endA = Math.PI / 2 - (i < 7 ? 0.22 : 0.5 + (i - 7) * 0.25);
    for (const s of [-1, 1]) { const pts = []; for (let k = 0; k <= 14; k++) { const th = -Math.PI / 2 + 0.12 + (endA + Math.PI / 2 - 0.12) * k / 14; pts.push(V3(s * rx * Math.cos(th), yi - 0.3 * (th + Math.PI / 2) / Math.PI, rz * Math.sin(th))); } tube(pts, 0.026, BONE, 28); }
  }
  add(new THREE.BoxGeometry(0.13, 0.85, 0.04), BONE, [0, 0.95, 0.54], [-0.12, 0, 0]);
  for (const s of [-1, 1]) {
    tube([V3(s * 0.08, 1.4, 0.48), V3(s * 0.45, 1.46, 0.36), V3(s * 0.88, 1.52, 0.02)], 0.035, BONE, 12);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.48, 0.06); sh.lineTo(0.42, -0.2); sh.lineTo(0.1, -0.78); sh.closePath();
    const sc = add(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false }), BONE, [s * 0.32, 1.45, -0.66], [0, s * 0.35, 0]); sc.scale.x = s;
    add(new THREE.SphereGeometry(0.13, 16, 12), BONE, [s * 0.95, 1.38, -0.08]);
    tube([V3(s * 0.97, 1.3, -0.08), V3(s * 1.02, 0.6, -0.06), V3(s * 1.08, -0.15, 0)], 0.055, BONE, 10);
    tube([V3(s * 1.08, -0.18, 0.02), V3(s * 1.12, -0.85, 0.08), V3(s * 1.15, -1.5, 0.12)], 0.035, BONE, 10);
    tube([V3(s * 1.0, -0.18, 0.0), V3(s * 1.04, -0.85, 0.06), V3(s * 1.08, -1.5, 0.1)], 0.03, BONE, 10);
    for (let f = 0; f < 4; f++) tube([V3(s * (1.03 + f * 0.04), -1.55, 0.1), V3(s * (1.04 + f * 0.05), -1.8, 0.12), V3(s * (1.05 + f * 0.05), -1.98, 0.12)], 0.016, BONE, 6);
    // pelvis wings + legs
    add(new THREE.TorusGeometry(0.34, 0.06, 10, 24, Math.PI * 1.1), BONE, [s * 0.36, -0.42, -0.05], [Math.PI / 2 - 0.3, 0, s > 0 ? 0.6 : Math.PI - 0.6]);
    add(new THREE.SphereGeometry(0.11, 14, 10), BONE, [s * 0.45, -0.72, 0.02]);
    tube([V3(s * 0.47, -0.72, 0.02), V3(s * 0.42, -1.45, 0.05), V3(s * 0.38, -2.12, 0.05)], 0.06, BONE, 12);
    add(new THREE.SphereGeometry(0.08, 14, 10), BONE, [s * 0.38, -2.18, 0.14]);
    tube([V3(s * 0.37, -2.25, 0.03), V3(s * 0.365, -2.85, 0.02), V3(s * 0.36, -3.42, 0)], 0.045, BONE, 10);
    tube([V3(s * 0.47, -2.28, -0.02), V3(s * 0.46, -2.85, -0.03), V3(s * 0.45, -3.4, -0.03)], 0.022, BONE, 10);
    add(new THREE.BoxGeometry(0.2, 0.08, 0.5), BONE, [s * 0.37, -3.52, 0.14]);
    // flesh
    tube([V3(s * 0.98, 1.45, -0.08), V3(s * 1.04, 0.2, -0.04), V3(s * 1.12, -1.6, 0.1)], 0.19, FLESH, 16);
    tube([V3(s * 0.45, -0.6, 0), V3(s * 0.4, -2.0, 0.03), V3(s * 0.37, -3.45, 0)], 0.24, FLESH, 16);
  }
  add(new THREE.BoxGeometry(0.28, 0.42, 0.12), BONE, [0, -0.5, -0.4], [0.4, 0, 0]);
  const body = add(new THREE.CylinderGeometry(0.98, 0.78, 2.6, 40, 1, true), FLESH, [0, 0.55, -0.05]); body.scale.z = 0.68;
  const hips = add(new THREE.CylinderGeometry(0.78, 0.7, 0.9, 40, 1, true), FLESH, [0, -0.95, -0.05]); hips.scale.z = 0.7;
  add(new THREE.SphereGeometry(0.98, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), FLESH, [0, 1.85, -0.05]).scale.set(1, 0.32, 0.68);
  add(new THREE.CylinderGeometry(0.26, 0.3, 0.6, 20, 1, true), FLESH, [0, 2.15, -0.25]);
  add(new THREE.SphereGeometry(0.6, 28, 20), FLESH, [0, 2.78, 0]).scale.set(0.85, 1.05, 1);
  return sk;
}
export function xray_(d, S) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x010604); const camera = cam(34);
  const BONE = xray('#7dffc4', 1), FLESH = xray('#2fae86', 0.3), sk = skeleton(BONE, FLESH); scene.add(sk);
  const f = FOCUS[d.focus] || FOCUS.chest; const fp = V3(f[0], f[1], f[2]); const side = Math.sign(f[0]);
  const markMat = xray('#ff3b30', 0); const marker = new THREE.Mesh(d.markerShape === 'sphere' ? new THREE.SphereGeometry(0.09, 16, 12) : new THREE.ConeGeometry(0.06, 0.24, 8), markMat);
  marker.position.copy(fp); marker.rotation.set(0.9, 0, -0.6); if (d.marker !== false) sk.add(marker);
  const hitT = d.cue ? S.cue(d.cue, S.dur * 0.55) : S.dur * 0.55;
  return {
    scene, camera,
    update(lt) {
      const u = lt / S.dur;
      sk.rotation.y = lerp(side ? 0.45 * side : 0.4, side ? -0.5 * side : -0.4, sm(u)); sk.updateMatrixWorld(true);
      const tgt = fp.clone().applyMatrix4(sk.matrixWorld);
      const dz = sm(lin(lt, hitT, S.dur)); const far = Math.min(13, f[3] * 1.9);
      const look = V3(0, f[1] * 0.6, 0).lerp(tgt, 0.5 + 0.5 * dz);
      camera.position.copy(V3(0, f[1] * 0.6 + 0.2, far).lerp(V3(tgt.x + 0.4 * (side || 1), tgt.y + 0.15, tgt.z + f[3]), 0.35 + 0.65 * dz)); camera.lookAt(look);
      const rv = lin(lt, hitT - 0.1, hitT + 0.1); markMat.uniforms.s.value = rv * 3.2 * (0.75 + 0.25 * Math.sin((lt - hitT) * 14));
      BONE.uniforms.s.value = lerp(0.6, 1.0, lin(lt, 0, 0.4));
      this._tgt = tgt; this._rv = rv; this._hit = hitT;
    },
    overlay(lt) {
      const g = G.ctx;
      const sw = lin(lt, 0.1, Math.min(1.6, S.dur * 0.5));
      if (sw > 0 && sw < 1) { const y = lerp(80, 1000, sw); const gr = g.createLinearGradient(0, y - 140, 0, y); gr.addColorStop(0, 'rgba(120,255,190,0)'); gr.addColorStop(1, 'rgba(120,255,190,0.16)'); g.fillStyle = gr; g.fillRect(0, y - 140, W, 140); g.fillStyle = 'rgba(190,255,220,0.9)'; g.fillRect(0, y, W, 2); }
      g.drawImage(SCANLINES, 0, 0);
      const HUD = 'rgba(140,255,200,0.85)', DIM = 'rgba(140,255,200,0.6)';
      brackets(70, 70, W - 140, H - 140, 60, DIM, 2);
      text(String(d.scan || 'RADIOGRAPHIC SCAN').toUpperCase(), 110, 130, `500 24px ${F.MONO}`, HUD, 'left', 3);
      if (d.subject) text(String(d.subject).toUpperCase(), 110, 166, `400 20px ${F.MONO}`, DIM, 'left', 2);
      text(`SLICE ${String(Math.min(240, Math.floor(sw * 240))).padStart(4, '0')} / 0240`, W - 110, 130, `500 24px ${F.MONO}`, HUD, 'right', 3);
      text('kV 120   mA 300   W 1500 L 450', W - 110, 166, `400 20px ${F.MONO}`, DIM, 'right', 2);
      g.save(); g.strokeStyle = 'rgba(140,255,200,0.7)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 120; i++) { const v = Math.sin(i * 0.35 + lt * 6) * 0.4 + Math.sin(i * 0.13 - lt * 3) * 0.6; g.lineTo(110 + i * 3, 900 - v * 28 - (this._rv > 0 && i > 70 && i < 85 ? 40 * this._rv : 0)); } g.stroke(); g.restore();
      text('DENSITY PROFILE', 110, 960, `400 18px ${F.MONO}`, DIM, 'left', 3);
      if (d.marker !== false && this._rv > 0 && this._tgt) {
        const [sx, sy] = project(this._tgt, this.camera); const box = lerp(260, 120, eo(lin(lt, this._hit, this._hit + 0.45))); const blink = Math.floor((lt - this._hit) * 6) % 2 === 0 ? 1 : 0.55;
        brackets(sx - box / 2, sy - box / 2, box, box, 26, `rgba(255,70,60,${0.95 * this._rv})`, 4);
        const left = sx > W * 0.62; const ex = left ? sx - box / 2 - 420 : sx + box / 2 + 420;
        g.save(); g.strokeStyle = `rgba(255,70,60,${0.8 * this._rv})`; g.lineWidth = 2; g.beginPath(); g.moveTo(left ? sx - box / 2 : sx + box / 2, sy - box / 2); g.lineTo(left ? sx - box / 2 - 70 : sx + box / 2 + 70, sy - box / 2 - 60); g.lineTo(ex, sy - box / 2 - 60); g.stroke(); g.restore();
        const tx = clamp(left ? sx - box / 2 - 410 : sx + box / 2 + 80, 90, W - 520);
        g.fillStyle = `rgba(0,0,0,${0.65 * this._rv})`; g.fillRect(tx - 12, sy - box / 2 - 108, 520, d.detail ? 92 : 52);
        text(String(d.label || 'ANOMALY DETECTED').toUpperCase(), tx, sy - box / 2 - 72, `700 26px ${F.MONO}`, '#ff5a4e', 'left', 2, this._rv * blink);
        if (d.detail) text(String(d.detail).toUpperCase(), tx, sy - box / 2 - 30, `400 20px ${F.MONO}`, 'rgba(255,120,110,0.85)', 'left', 2, sm(lin(lt, this._hit + 0.25, this._hit + 0.6)));
      }
    },
  };
}

// ---------- ARTIFACT (procedural objects or a supplied .glb, on a museum plinth) ----------
function lathe(pts, mat, seg = 48) { return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat); }
const OBJECTS = {
  arrowhead(m) {
    const outline = [[0, 1.0], [0.3, 0.3], [0.36, -0.12], [0.24, -0.42], [0.1, -0.46], [0.1, -0.76], [-0.1, -0.76], [-0.1, -0.46], [-0.24, -0.42], [-0.36, -0.12], [-0.3, 0.3]];
    const r = rng(13), sh = new THREE.Shape();
    outline.forEach((p, i) => { const q = outline[(i + 1) % outline.length]; for (let k = 0; k < 5; k++) { const u = k / 5; let x = lerp(p[0], q[0], u); const y = lerp(p[1], q[1], u); if (k > 0 && Math.abs(y) < 0.95) x += Math.sign(x || 1) * (r() - 0.5) * 0.035; i === 0 && k === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y); } });
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1 }); g.center();
    const pos = g.attributes.position, h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); pos.setZ(i, z + Math.sign(z) * (h(Math.round(pos.getX(i) * 40), Math.round(pos.getY(i) * 40)) - 0.5) * 0.045); }
    g.computeVertexNormals(); const o = new THREE.Mesh(g, m || material('flint')); o.scale.setScalar(1.6); return o;
  },
  vase: m => { const o = lathe([[0, -1.2], [0.45, -1.15], [0.62, -0.9], [0.85, -0.2], [0.8, 0.35], [0.45, 0.85], [0.3, 1.05], [0.36, 1.2], [0.32, 1.25], [0.25, 1.1], [0, 1.1]], m || material('clay')); const g = new THREE.Group(); g.add(o); for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 20, Math.PI), o.material); hd.position.set(s * 0.45, 0.75, 0); hd.rotation.z = s * -Math.PI / 2; g.add(hd); } return g; },
  amphora: m => { const o = lathe([[0, -1.6], [0.12, -1.5], [0.35, -1.0], [0.7, -0.2], [0.72, 0.3], [0.5, 0.8], [0.2, 1.1], [0.2, 1.5], [0.26, 1.6], [0, 1.6]], m || material('clay')); return o; },
  jar: m => lathe([[0, -0.9], [0.7, -0.88], [0.85, -0.3], [0.8, 0.5], [0.55, 0.75], [0.58, 0.9], [0, 0.9]], m || material('clay')),
  flask: m => { const g = new THREE.Group(); g.add(lathe([[0, -0.9], [0.55, -0.85], [0.62, -0.4], [0.45, 0.1], [0.16, 0.45], [0.15, 0.95], [0.18, 1.0], [0, 1.0]], m || material('glass'))); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.25, 16), material('wood')); c.position.y = 1.08; g.add(c); return g; },
  coin: (m, d) => { const mat = m || material('gold'); const ct = canvasTex(512, 512, g => { g.fillStyle = '#888'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#ddd'; g.beginPath(); g.ellipse(256, 230, 90, 120, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(256, 420, 160, 90, 0, Math.PI, 0); g.fill(); g.strokeStyle = '#eee'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 225, 0, 7); g.stroke(); text(String(d.inscription || 'REX').toUpperCase(), 256, 90, `bold 44px ${F.SERIF}`, '#eee', 'center', 8); });
    const face = mat.clone(); face.bumpMap = ct.tex; face.bumpScale = 3; const o = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.14, 64), [mat, face, face]); o.rotation.x = Math.PI / 2; return o; },
  dagger: m => { const g = new THREE.Group(); const sh = new THREE.Shape(); sh.moveTo(0, 1.4); sh.quadraticCurveTo(0.2, 0.6, 0.16, -0.1); sh.lineTo(-0.16, -0.1); sh.quadraticCurveTo(-0.2, 0.6, 0, 1.4);
    const b = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 2 }), m || material('bronze')); b.position.z = -0.01; g.add(b);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.12), material('gold')); guard.position.y = -0.15; const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 16), material('wood')); grip.position.y = -0.55; const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), material('gold')); pom.position.y = -0.95; g.add(guard, grip, pom); g.position.y = -0.2; return g; },
  box: m => { const g = new THREE.Group(); const w = m || material('wood'); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.1), w); const lid = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 1.16), w); lid.position.y = 0.54; g.add(b, lid); for (const x of [-0.6, 0.6]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.12, 1.18), material('bronze')); band.position.set(x, 0.1, 0); g.add(band); } return g; },
  skull: m => { const g = new THREE.Group(); const mat = m || new THREE.MeshStandardMaterial({ color: 0x9c8a68, roughness: 0.8 }); const cr = new THREE.Mesh(new THREE.SphereGeometry(0.75, 40, 30), mat); cr.scale.set(0.85, 0.95, 1.05); cr.position.y = 0.2; const face = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 24), mat); face.scale.set(0.95, 0.9, 0.7); face.position.set(0, -0.15, 0.35);
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 12, 30, Math.PI), mat); jaw.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI); jaw.position.set(0, -0.55, 0.2); g.add(cr, face, jaw);
    const dk = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), dk); e.position.set(s * 0.22, 0.0, 0.62); e.scale.z = 0.5; g.add(e); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 3), dk); nose.position.set(0, -0.2, 0.7); nose.rotation.x = Math.PI; g.add(nose);
    for (let i = 0; i < 10; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), mat); const a = (i / 9 - 0.5) * 1.6; t.position.set(Math.sin(a) * 0.3, -0.42, 0.42 + Math.cos(a) * 0.12 - 0.1); g.add(t); } return g; },
  tooth: m => { const g = new THREE.Group(); const mat = m || material('bone'); g.add(lathe([[0, 0.2], [0.42, 0.25], [0.5, 0.6], [0.42, 0.9], [0.2, 1.0], [0, 0.95]], mat, 10)); for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.2, 12), mat); r.rotation.z = Math.PI + s * 0.15; r.position.set(s * 0.2, -0.35, 0); g.add(r); } g.position.y = -0.2; return g; },
  tablet: (m, d) => { const ct = canvasTex(1024, 1400, g => { g.fillStyle = '#777'; g.fillRect(0, 0, 1024, 1400); const r = rng(5); g.fillStyle = '#222'; for (let y = 90; y < 1320; y += 70) for (let x = 70; x < 960; x += 26 + r() * 30) { if (r() < 0.15) continue; g.save(); g.translate(x, y); g.rotate(r() * 0.6); g.fillRect(0, 0, 18, 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(8, 22); g.lineTo(14, 0); g.fill(); g.restore(); } });
    const mat = m || material('clay'); const face = mat.clone(); face.bumpMap = ct.tex; face.bumpScale = 4; const o = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.35, 1, 1, 1), [mat, mat, mat, mat, face, mat]); return o; },
  ring: m => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.13, 24, 64), m || material('gold')); const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshPhysicalMaterial({ color: 0xb01020, roughness: 0.05, metalness: 0, clearcoat: 1, emissive: 0x300005, flatShading: true })); gem.position.y = 0.85; g.add(t, gem); return g; },
  bone: m => { const g = new THREE.Group(); const mat = m || material('bone'); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.2, 16), mat); g.add(s); for (const y of [-1.15, 1.15]) for (const x of [-0.13, 0.13]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat); k.position.set(x, y, 0); g.add(k); } g.rotation.z = 0.4; return g; },
  stake: m => { const g = new THREE.Group(); const mat = m || new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.95, flatShading: true }); const L = 2.6;
    const geo = new THREE.CylinderGeometry(0.17, 0.2, L, 9, 12); const p = geo.attributes.position, r = rng(21);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + (r() - 0.5) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    geo.computeVertexNormals(); const shaft = new THREE.Mesh(geo, mat); shaft.position.y = 0.25; g.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 7), mat); tip.rotation.x = Math.PI; tip.position.y = 0.25 - L / 2 - 0.27; g.add(tip);
    const cut = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 9), material('cream')); cut.material.color.set(0xb08a5a); cut.position.y = 0.25 + L / 2; g.add(cut);
    g.rotation.z = 0.18; g.scale.setScalar(0.85); return g; },
  stone: m => { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position, r = rng(4); for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(0.85 + r() * 0.2); p.setXYZ(i, v.x, v.y * 0.7, v.z); } g.computeVertexNormals(); return new THREE.Mesh(g, m || material('stone')); },
};
export function artifact(d, S) {
  const scene = stage({ bg: 0x070504, fog: [0x070504, 9, 28], envI: 0.55 }), camera = cam(30);
  floor(scene, { color: 0x0e0a07, rough: 0.6, y: -2.2 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.6, 48), new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.6 })); ped.position.y = -1.4; ped.receiveShadow = ped.castShadow = true; scene.add(ped);
  let obj; const mat = d.material ? material(d.material) : null;
  if (d.model && models[d.model]) { obj = models[d.model].clone(true); const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(V3(0, 0, 0)), c = b.getCenter(V3(0, 0, 0)); obj.position.sub(c); const w = new THREE.Group(); w.add(obj); w.scale.setScalar(2.4 / Math.max(sz.x, sz.y, sz.z)); obj = w; }
  else obj = (OBJECTS[d.object] || OBJECTS.stone)(mat, d);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const holder = new THREE.Group(); holder.add(obj); holder.position.y = 0.55; scene.add(holder);
  spot(scene, { color: 0xffb46b, intensity: 4.5, pos: [-4, 6, 5], target: [0, 0.4, 0], angle: 0.45, penumbra: 0.7 });
  spot(scene, { color: 0x7fb0ff, intensity: 6, pos: [4, 3, -5], target: [0, 0.4, 0], angle: 0.5, shadow: false });
  spot(scene, { color: 0xffffff, intensity: 2.5, pos: [0, 9, 1], target: [0, 0, 0], angle: 0.35, shadow: false });
  dustPoints(scene, { center: [0, 1, 0], spread: [8, 5, 6], n: 400, size: 0.02 });
  const spin = d.spin ?? (d.object === 'skull' ? 0.25 : 0.9);
  return {
    scene, camera,
    update(lt) {
      holder.rotation.set(0.12 + Math.sin(lt * 0.8) * 0.05, d.object === 'skull' ? -0.15 + Math.sin(lt * 0.45) * 0.55 : 0.5 + lt * spin, 0); holder.position.y = 0.55 + Math.sin(lt * 1.3) * 0.05;
      camPath(camera, [{ t: 0, pos: [-1.2, 1.3, 7.8], look: [0, 0.4, 0] }, { t: 1, pos: [0.8, 1.0, 6.2], look: [0, 0.5, 0] }], lt / S.dur, x => x);
    },
    overlay(lt) { lowerThird(d.label, d.detail, sm(lin(lt, 0.5, 1.1))); },
  };
}

// ---------- LANDSCAPE (low-poly terrain flyover) ----------
const SKY = {
  dawn: ['#2b3550', '#c98b6b', '#f3c38f', 0xffc28a, 1.6], day: ['#4d78a8', '#9fc0da', '#dfe8ee', 0xfff1d8, 2.4], dusk: ['#1b1d38', '#7a3f4a', '#e08a4f', 0xff9a5a, 1.8],
  night: ['#070b18', '#16223c', '#2c3d5e', 0x9db6ff, 1.3], storm: ['#1a1f24', '#3a4248', '#5a6066', 0xb0bcc8, 0.9],
};
export function landscape(d, S, idx) {
  const kind = d.terrain || 'mountain', time = SKY[d.time] ? d.time : 'dusk', [s0, s1, s2, sunC, sunI] = SKY[time];
  const scene = new THREE.Scene(); const camera = cam(42);
  const sky = canvasTex(16, 512, g => { const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, s0); gr.addColorStop(0.6, s1); gr.addColorStop(1, s2); g.fillStyle = gr; g.fillRect(0, 0, 16, 512); });
  scene.background = sky.tex; scene.fog = new THREE.Fog(new THREE.Color(s2), 25, kind === 'forest' ? 90 : 130);
  const nz = noise2(hashStr(kind + time) + idx); const SZ = 260;
  const hf = (x, z) => { const n = nz(x * 0.012 + 10, z * 0.012 + 10, 5);
    switch (kind) { case 'desert': return (Math.sin(x * 0.05 + n * 8) * 0.5 + 0.5) * 9 + Math.pow(n, 1.5) * 26; case 'coast': return n * 26 - 12.5; case 'ice': return Math.pow(n, 2) * 30; case 'plains': case 'forest': return n * 9; case 'canyon': { const rv = Math.abs(x + Math.sin(z * 0.03) * 12); return rv < 9 ? n * 2 : 18 + n * 10; } default: return Math.pow(n, 1.9) * 55; } };
  const geo = new THREE.PlaneGeometry(SZ, SZ, 150, 150); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = [];
  const pal = { mountain: [[0, '#3c4632'], [0.35, '#5b5a4e'], [0.6, '#8d8a80'], [0.75, '#eef2f5']], desert: [[0, '#9a6230'], [0.5, '#c98a4b'], [1, '#e7bb7f']], coast: [[0, '#c9b48a'], [0.2, '#5d7040'], [0.6, '#3d4a2c'], [1, '#7c7a70']], ice: [[0, '#9fb3c4'], [0.5, '#dfe8ee'], [1, '#ffffff']], plains: [[0, '#5a6b3a'], [1, '#8a8d58']], forest: [[0, '#2d3a22'], [1, '#4c5a33']], canyon: [[0, '#6b3f22'], [0.5, '#a35a2e'], [1, '#c98250']] }[kind] || [[0, '#555'], [1, '#999']];
  const top = { mountain: 55, desert: 14, coast: 17, ice: 30, plains: 9, forest: 9, canyon: 28 }[kind] || 20;
  for (let i = 0; i < p.count; i++) { const h = hf(p.getX(i), p.getZ(i)); p.setY(i, Math.max(kind === 'coast' ? -1 : -50, h)); const u = clamp(h / top); let k = 0; while (k < pal.length - 2 && u > pal[k + 1][0]) k++; const a = new THREE.Color(pal[k][1]), b = new THREE.Color(pal[Math.min(k + 1, pal.length - 1)][1]); const t = pal.length > 1 ? clamp((u - pal[k][0]) / ((pal[k + 1]?.[0] ?? 1) - pal[k][0] || 1)) : 0; const c = a.lerp(b, t); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const terr = new THREE.Mesh(geo.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })); terr.geometry.computeVertexNormals(); terr.receiveShadow = true; scene.add(terr);
  if (kind === 'coast') { const w = new THREE.Mesh(new THREE.PlaneGeometry(SZ, SZ), new THREE.MeshStandardMaterial({ color: 0x1f4a66, roughness: 0.55, metalness: 0 })); w.rotation.x = -Math.PI / 2; w.position.y = -0.2; scene.add(w); }
  if (kind === 'forest' || kind === 'plains') { const n = kind === 'forest' ? 2600 : 500, tg = new THREE.ConeGeometry(0.9, 3.4, 6), tm = new THREE.MeshStandardMaterial({ color: 0x1e2b16, roughness: 0.9, flatShading: true }), inst = new THREE.InstancedMesh(tg, tm, n), r = rng(8), M = new THREE.Matrix4(); for (let i = 0; i < n; i++) { const x = (r() - 0.5) * SZ * 0.9, z = (r() - 0.5) * SZ * 0.9, s = 0.7 + r() * 0.9; M.compose(V3(x, hf(x, z) + 1.5 * s, z), new THREE.Quaternion(), V3(s, s, s)); inst.setMatrixAt(i, M); } scene.add(inst); }
  const sun = new THREE.DirectionalLight(sunC, sunI); sun.position.set(-60, 40, -80); scene.add(sun); scene.add(new THREE.HemisphereLight(new THREE.Color(s1), 0x1a140e, time === 'night' ? 0.7 : 0.6));
  let parts; if (['mountain', 'ice'].includes(kind) || time === 'storm' || d.particles === 'snow') parts = dustPoints(scene, { n: 2500, center: [0, 15, 0], spread: [80, 30, 160], color: 0xffffff, size: 0.12, opacity: 0.7 }); else if (kind === 'desert' || d.particles === 'dust') parts = dustPoints(scene, { n: 1500, center: [0, 6, 0], spread: [80, 12, 160], color: 0xe9c08a, size: 0.1, opacity: 0.5 });
  const speed = d.speed ?? 6, x0 = d.x ?? 0;
  return {
    scene, camera,
    update(lt) {
      const z = 70 - lt * speed, ahead = z - 20, clear = Math.max(hf(x0, z), hf(x0, ahead), hf(x0, z - 8)) + (d.altitude ?? 9);
      camera.position.set(x0 + Math.sin(lt * 0.15) * 3, clear, z); camera.lookAt(x0, clear - 4.5, z - 30);
      if (parts) { parts.position.z = -lt * 2; parts.position.y = -((lt * 1.5) % 10); }
    },
    overlay(lt) { lowerThird(d.caption, d.sub, sm(lin(lt, 0.5, 1.1))); },
  };
}

// ---------- MOLECULE (ball-and-stick) ----------
export function molecule(d, S) {
  const scene = stage({ bg: 0x05090c, fog: [0x05090c, 10, 30], envI: 0.6 }), camera = cam(32);
  const CENT = [[0, 0], [Math.sqrt(3), 0], [Math.sqrt(3) / 2, 1.5], [3 * Math.sqrt(3) / 2, 1.5], [Math.sqrt(3) / 2, -1.5], [-Math.sqrt(3) / 2, 1.5]];
  const nR = clamp(d.rings ?? 2, 1, 6); const verts = [], key = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`, vid = new Map(), bonds = new Set(), deg = [];
  const addV = (x, y) => { const k = key(x, y); if (!vid.has(k)) { vid.set(k, verts.length); verts.push([x, y]); deg.push(0); } return vid.get(k); };
  for (let r = 0; r < nR; r++) { const [cx, cy] = CENT[r]; const ids = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ids.push(addV(cx + Math.cos(a), cy + Math.sin(a))); } for (let i = 0; i < 6; i++) { const a = ids[i], b = ids[(i + 1) % 6]; bonds.add(a < b ? `${a}-${b}` : `${b}-${a}`); } }
  bonds.forEach(b => { const [a, c] = b.split('-').map(Number); deg[a]++; deg[c]++; });
  const cen = verts.reduce((s, v) => [s[0] + v[0] / verts.length, s[1] + v[1] / verts.length], [0, 0]);
  const grp = new THREE.Group(); scene.add(grp);
  const AT = { C: [0x2c2c2c, 0.32], H: [0xeeeeee, 0.2], O: [0xd03030, 0.3], N: [0x3060d0, 0.3], S: [0xd8c040, 0.34], Cl: [0x40c040, 0.34] };
  const ball = (el, x, y, z = 0) => { const [c, r] = AT[el] || AT.C; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.1 })); m.position.set(x - cen[0], y - cen[1], z); grp.add(m); return m; };
  const stick = (a, b, off = 0) => { const A = V3(a[0] - cen[0], a[1] - cen[1], off), B = V3(b[0] - cen[0], b[1] - cen[1], off); const L = A.distanceTo(B); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, L, 12), new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.4, metalness: 0.3 })); m.position.copy(A.clone().lerp(B, 0.5)); m.quaternion.setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize()); grp.add(m); };
  verts.forEach(v => ball('C', v[0], v[1]));
  let bi = 0; bonds.forEach(b => { const [a, c] = b.split('-').map(Number); if (bi++ % 2 === 0) { stick(verts[a], verts[c], 0.09); stick(verts[a], verts[c], -0.09); } else stick(verts[a], verts[c]); });
  const extra = [...(d.extra || [])]; const r = rng(7);
  verts.forEach((v, i) => { if (deg[i] !== 2) return; const dx = v[0] - cen[0], dy = v[1] - cen[1], L = Math.hypot(dx, dy) || 1; const el = extra.length && r() < 0.5 ? extra.shift() : 'H'; const len = el === 'H' ? 1.0 : 1.35; const p = [v[0] + dx / L * len, v[1] + dy / L * len]; stick(v, p); ball(el, p[0], p[1]); });
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  spot(scene, { color: 0xffffff, intensity: 5, pos: [-4, 6, 8], target: [0, 0, 0], angle: 0.6 }); spot(scene, { color: 0x5fb0ff, intensity: 4, pos: [5, -2, -6], target: [0, 0, 0], shadow: false });
  dustPoints(scene, { center: [0, 0, 0], spread: [20, 12, 14], color: 0x9fd8ff, n: 400 });
  const span = Math.max(...verts.map(v => Math.hypot(v[0] - cen[0], v[1] - cen[1]))) + 1.6;
  return {
    scene, camera,
    update(lt) { grp.rotation.set(0.3 + Math.sin(lt * 0.4) * 0.15, Math.sin(lt * 0.5) * 0.7, 0.1); grp.scale.setScalar(eo(lin(lt, 0, 0.8)) * 0.999 + 0.001); const z = span * 3.4 + 2; camera.position.set(0, 0.5, lerp(z * 1.15, z, sm(lt / S.dur))); camera.lookAt(0, 0, 0); },
    overlay(lt) { lowerThird(d.name, d.formula, sm(lin(lt, 0.5, 1.1))); },
  };
}
