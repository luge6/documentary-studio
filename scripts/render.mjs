#!/usr/bin/env node
// Render a documentary project to video with headless Chromium + Three.js.
//   node render.mjs <project> [--workers 4]          full render -> build/video_silent.mp4
//   node render.mjs <project> --sheet [--shots 0,4]  QC contact sheets -> qc/sheet_XX.png
//   node render.mjs <project> --stills 12.5,40       single frames -> qc/t_12.50.png
//   node render.mjs <project> --range 60-90          preview a time range -> build/preview.mp4
//   node render.mjs <project> --thumb 23 "LINE ONE|LINE TWO" ACCENTWORD [localTime]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(execFileSync('npm', ['root', '-g']).toString().trim() + '/playwright')); }

const SKILL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2); const PROJ = path.resolve(args[0] || '.');
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has = k => args.includes(k);
const TL = JSON.parse(fs.readFileSync(path.join(PROJ, 'timeline.json'), 'utf8'));
const FPS = TL.fps || 24;
fs.mkdirSync(path.join(PROJ, 'build'), { recursive: true }); fs.mkdirSync(path.join(PROJ, 'qc'), { recursive: true });

// ---- static server: /engine, /three, /project ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };
const roots = { '/engine/': path.join(SKILL, 'engine'), '/three/': path.join(SKILL, 'node_modules', 'three'), '/project/': PROJ };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]); const pre = Object.keys(roots).find(p => u.startsWith(p));
  const f = pre ? path.join(roots[pre], u.slice(pre.length)) : null;
  if (!f) { s.writeHead(404); s.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' }); s.end(d); });
});
await new Promise(r => srv.listen(0, r)); const PORT = srv.address().port;
const QUAL = opt('--quality') || process.env.DOC_QUALITY || '';
const URL_ = `http://localhost:${PORT}/engine/index.html?proj=/project/${QUAL ? '&' + QUAL : ''}`;

async function openPage() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  let fail; const failed = new Promise((_, rej) => { fail = rej; });
  page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); fail(new Error('page error: ' + e.message)); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('page:', m.text()); });
  await page.goto(URL_);
  await Promise.race([page.waitForFunction(() => window.READY, null, { timeout: 180000 }), failed]);
  failed.catch(() => {});
  return { browser, page };
}
const shot = (page, t) => page.evaluate(t => window.renderFrame(t), t);

async function stills(times, names) {
  const { browser, page } = await openPage(); const out = [];
  for (let k = 0; k < times.length; k++) { await shot(page, times[k]); const f = path.join(PROJ, 'qc', names ? names[k] : `t_${times[k].toFixed(2)}.png`); await page.screenshot({ path: f }); out.push(f); }
  await browser.close(); return out;
}

async function renderRange(f0, f1, outFile, label = '') {
  const { browser, page } = await openPage();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const b = Buffer.from(await page.evaluate(t => window.grabFrame(t), f / FPS), 'base64');
    if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r));
    const done = f - f0 + 1;
    if (done % 120 === 0 || f === f1 - 1) { const el = (Date.now() - t0) / 1000; console.log(`${label} ${done}/${f1 - f0} frames  ${(done / el).toFixed(2)} fps  eta ${Math.round((f1 - f0 - done) / (done / el))}s`); }
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close();
}

try {
  if (has('--bench')) {
    const { browser, page } = await openPage(); const times = TL.shots.map(s => s.start + (s.end - s.start) * 0.5);
    for (const t of times) { await shot(page, t); }
    let ev = 0, sc = 0;
    for (let r = 0; r < 3; r++) for (const t of times) { const a = Date.now(); await shot(page, t + r * 0.04); const b = Date.now(); await page.evaluate(t => window.grabFrame(t), t + r * 0.04 + 0.01); ev += b - a; sc += Date.now() - b; }
    const n = times.length * 3; console.log(`quality='${QUAL}'  render ${(ev / n).toFixed(0)} ms/frame  screenshot ${(sc / n).toFixed(0)} ms/frame`); await browser.close();
  } else if (has('--profile')) {
    const { browser, page } = await openPage();
    for (const s of TL.shots) { const t = s.start + (s.end - s.start) * 0.5; await page.evaluate(t => window.profile(t), t); const r = has('--grab') ? await page.evaluate(t => window.profileGrab(t), t + 0.05) : await page.evaluate(t => window.profile(t), t + 0.05); console.log(Object.entries(r).map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(0) : v}`).join('  ')); }
    await browser.close();
  } else if (has('--sheet')) {
    const pick = opt('--shots') ? opt('--shots').split(',').map(Number) : TL.shots.map((_, i) => i);
    const times = pick.map(i => { const s = TL.shots[i]; return s.start + (s.end - s.start) * 0.72; });
    const files = await stills(times, pick.map(i => `shot_${String(i).padStart(3, '0')}.png`));
    const per = 12; let page = 0;
    for (let k = 0; k < files.length; k += per, page++) {
      const chunk = files.slice(k, k + per); const ids = pick.slice(k, k + per); const inputs = chunk.flatMap(f => ['-i', f]);
      const lab = chunk.map((_, j) => `[${j}]scale=640:360,drawtext=text='#${ids[j]} ${TL.shots[ids[j]].type}':x=12:y=12:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6[v${j}]`).join(';');
      const n = chunk.length; const layout = chunk.map((_, j) => `${(j % 4) * 640}_${Math.floor(j / 4) * 360}`).join('|');
      const fc = n > 1 ? `${lab};${chunk.map((_, j) => `[v${j}]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=black` : lab.replace('[v0]', '');
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', fc, '-frames:v', '1', path.join(PROJ, 'qc', `sheet_${String(page + 1).padStart(2, '0')}.png`)]);
    }
    console.log(`contact sheets: ${page} in ${path.join(PROJ, 'qc')}`);
  } else if (has('--stills')) {
    console.log((await stills(opt('--stills').split(',').map(Number))).join('\n'));
  } else if (has('--thumb')) {
    const i = Number(args[args.indexOf('--thumb') + 1]), words = args[args.indexOf('--thumb') + 2] || '', accent = args[args.indexOf('--thumb') + 3] || '', lt = args[args.indexOf('--thumb') + 4];
    const { browser, page } = await openPage();
    await page.evaluate(([i, lt, w, a]) => window.renderThumb(i, lt === undefined ? undefined : Number(lt), w, a), [i, lt, words, accent]);
    const big = path.join(PROJ, 'qc', 'thumb_full.png'); await page.screenshot({ path: big }); await browser.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', big, '-vf', 'scale=1280:720', path.join(PROJ, 'thumbnail.png')]);
    console.log(path.join(PROJ, 'thumbnail.png'));
  } else if (has('--range')) {
    const [a, b] = opt('--range').split('-').map(Number);
    await renderRange(Math.round(a * FPS), Math.round(b * FPS), path.join(PROJ, 'build', 'preview.mp4'), 'preview');
    console.log(path.join(PROJ, 'build', 'preview.mp4'));
  } else {
    const N = Number(opt('--workers') || Math.max(1, Math.min(4, os.cpus().length)));
    const total = Math.ceil(TL.duration * FPS); const per = Math.ceil(total / N);
    console.log(`rendering ${total} frames (${TL.duration.toFixed(1)}s @ ${FPS}fps) with ${N} workers`);
    const segs = [];
    await Promise.all(Array.from({ length: N }, (_, k) => { const a = k * per, b = Math.min(total, a + per); const f = path.join(PROJ, 'build', `seg_${k}.mp4`); segs.push(f); return a < b ? renderRange(a, b, f, `[w${k}]`) : null; }));
    const list = path.join(PROJ, 'build', 'segs.txt'); fs.writeFileSync(list, segs.filter(f => fs.existsSync(f)).map(f => `file '${f}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(PROJ, 'build', 'video_silent.mp4')]);
    console.log('DONE', path.join(PROJ, 'build', 'video_silent.mp4'));
  }
} finally { srv.close(); }
