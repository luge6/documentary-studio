// 3D toolkit shared by every shot: renderer, lights, materials, 3D text, canvas textures.
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { W, H, G, mk, eio, lerp, clamp, rng } from './core.js';

export { THREE };
const Q = new URLSearchParams(location.search);
export const QUALITY = { aa: Q.get('aa') !== '0', shadow: Q.get('shadow') || 'soft', scale: Number(Q.get('scale') || 0.75), smap: Number(Q.get('smap') || 2048) };
export const renderer = new THREE.WebGLRenderer({ antialias: QUALITY.aa, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(QUALITY.scale); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = QUALITY.shadow !== 'off'; renderer.shadowMap.type = QUALITY.shadow === 'soft' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

let envTex = null;
export function env() { if (!envTex) { const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; } return envTex; }

// ---------- fonts / 3D text ----------
export const fonts = {};
export async function loadFonts(base) {
  const L = new FontLoader();
  for (const [k, f] of [['serif', 'droid/droid_serif_bold.typeface.json'], ['serifR', 'droid/droid_serif_regular.typeface.json'], ['sans', 'droid/droid_sans_bold.typeface.json']]) {
    fonts[k] = L.parse(await (await fetch(base + f)).json());
  }
}
const glyphs = new Map();
function glyph(fontKey, ch, size, depth, bevel) {
  const key = `${fontKey}|${ch}|${size}|${depth}|${bevel}`;
  if (!glyphs.has(key)) {
    const g = ch.trim() ? new TextGeometry(ch, { font: fonts[fontKey], size, depth, curveSegments: 6, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 2 }) : null;
    if (g) g.userData.shared = true;
    glyphs.set(key, g);
  }
  return glyphs.get(key);
}
export function advance(fontKey, ch, size) { const f = fonts[fontKey].data; const gl = f.glyphs[ch] || f.glyphs['?']; return (gl.ha * size) / f.resolution; }
export function textWidth(str, fontKey, size, spacing = 0) { let w = 0; for (const ch of str) w += advance(fontKey, ch, size) + spacing; return w - spacing; }
// A group of per-letter meshes; call .setText(str) to change (cheap, glyphs are cached).
export function text3d(str, { font = 'serif', size = 1, depth = 0.2, bevel = 0.02, material, spacing = 0, align = 'center', shadow = true } = {}) {
  const grp = new THREE.Group();
  grp.setText = (s) => {
    grp.clear(); let x = 0; const letters = [];
    for (const ch of String(s)) {
      const g = glyph(font, ch, size, depth, bevel);
      if (g) { const m = new THREE.Mesh(g, material); m.position.x = x; m.castShadow = shadow; m.receiveShadow = false; grp.add(m); letters.push(m); }
      x += advance(font, ch, size) + spacing;
    }
    const w = x - spacing; const off = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    grp.children.forEach(m => (m.position.x += off));
    grp.userData.width = w; grp.userData.letters = letters; grp.userData.str = s;
  };
  grp.setText(str);
  return grp;
}

// ---------- materials ----------
export const MAT = {
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd8ad62, metalness: 1, roughness: 0.3 }),
  bronze: () => new THREE.MeshStandardMaterial({ color: 0xa8703f, metalness: 1, roughness: 0.42 }),
  iron: () => new THREE.MeshStandardMaterial({ color: 0x5d5a57, metalness: 0.9, roughness: 0.55 }),
  silver: () => new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.25 }),
  cream: () => new THREE.MeshStandardMaterial({ color: 0xf1e3c2, roughness: 0.5, metalness: 0.05 }),
  stone: () => new THREE.MeshStandardMaterial({ color: 0x9d968a, roughness: 0.9, metalness: 0, flatShading: true }),
  flint: () => new THREE.MeshStandardMaterial({ color: 0x7c7064, roughness: 0.45, metalness: 0.08, flatShading: true }),
  clay: () => new THREE.MeshStandardMaterial({ color: 0xa8603a, roughness: 0.85, metalness: 0 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.7, metalness: 0 }),
  bone: () => new THREE.MeshStandardMaterial({ color: 0xe0d2b4, roughness: 0.65, metalness: 0 }),
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xbfd8d2, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 1 }),
  red: () => new THREE.MeshStandardMaterial({ color: 0xb3201f, roughness: 0.4, metalness: 0.2, emissive: 0x3a0505 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.85, metalness: 0 }),
};
export function material(name) { return (MAT[name] || MAT.stone)(); }

// ---------- canvas textures (drawn with the 2D helpers in core.js) ----------
export function canvasTex(w, h, draw) {
  const c = mk(w, h), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const redraw = (...a) => { const prev = G.ctx; G.ctx = c.getContext('2d'); G.ctx.clearRect(0, 0, w, h); draw(G.ctx, ...a); G.ctx = prev; tex.needsUpdate = true; };
  redraw();
  return { tex, canvas: c, redraw };
}
// A flat textured plane (labels, prints, paper).
export function texPlane(w, h, tex, { transparent = true, lit = true, rough = 0.8 } = {}) {
  const m = lit ? new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: rough, metalness: 0 }) : new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); return mesh;
}

// ---------- scene / lights / camera ----------
export function stage({ bg = 0x070504, fog = [0x070504, 10, 45], envI = 0.25 } = {}) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  if (fog) s.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
  s.environment = env(); s.environmentIntensity = envI;
  return s;
}
export function spot(scene, { color = 0xffc58a, intensity = 4, pos = [-4, 8, 6], target = [0, 0, 0], angle = 0.6, penumbra = 0.7, shadow = true, mapSize = 2048 } = {}) {
  const l = new THREE.SpotLight(color, intensity, 0, angle, penumbra, 0);
  l.position.set(...pos); l.target.position.set(...target); scene.add(l, l.target);
  if (shadow) { l.castShadow = true; mapSize = Math.min(mapSize, QUALITY.smap); l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 4; }
  return l;
}
export function dirLight(scene, color, intensity, pos, shadow = false, size = 12) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...pos); scene.add(l);
  if (shadow) { l.castShadow = true; l.shadow.mapSize.set(QUALITY.smap, QUALITY.smap); const c = l.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 80; l.shadow.bias = -0.0004; l.shadow.normalBias = 0.03; }
  return l;
}
export function cam(fov = 35) { return new THREE.PerspectiveCamera(fov, W / H, 0.05, 500); }
// keyframed camera: keys = [{t:0..1, pos:[x,y,z], look:[x,y,z]}], u = progress 0..1
export function camPath(camera, keys, u, ease = eio) {
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1].t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const k = b === a ? 1 : ease(clamp((u - a.t) / (b.t - a.t)));
  camera.position.set(lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k));
  camera.lookAt(lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k));
}
export function shake(camera, amt, t) { if (amt <= 0) return; camera.position.x += Math.sin(t * 91) * amt; camera.position.y += Math.cos(t * 77) * amt; }

export function dustPoints(scene, { n = 500, spread = [20, 10, 20], center = [0, 2, 0], color = 0xffd2a0, size = 0.03, opacity = 0.55, seed = 3 } = {}) {
  const r = rng(seed), a = [];
  for (let i = 0; i < n; i++) a.push(center[0] + (r() - 0.5) * spread[0], center[1] + (r() - 0.5) * spread[1], center[2] + (r() - 0.5) * spread[2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(p); return p;
}
export function floor(scene, { size = 80, color = 0x120c08, rough = 0.85, y = 0, map = null } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, map }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
}
export function project(v, camera) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H, p.z]; }

// Dispose every geometry/material/texture under an object.
export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { for (const k of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'emissiveMap']) if (m[k] && !m[k].userData?.shared) m[k].dispose(); m.dispose(); });
  });
}

// ---------- GLB models ----------
const gltf = new GLTFLoader(); export const models = {};
export async function loadModel(url) { if (!models[url]) models[url] = (await gltf.loadAsync(url)).scene; return models[url]; }

// ---------- images ----------
export const images = {};
export async function loadImage(url) {
  if (url in images) return images[url];
  images[url] = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  return images[url];
}
