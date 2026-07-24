// Renders promo.html frame-by-frame in headless Chromium and encodes a
// social-ready MP4 (H.264 / yuv420p, 60fps) with a procedural soundtrack whose
// accents are read from the page's own timeline (window.__AUDIO), so audio
// stays in sync no matter how you retune promo.html's BRIEF.duration / marks.
//
//   NODE_PATH is not enough for ESM — link the global Playwright first:
//     mkdir -p node_modules
//     ln -sf "$(npm root -g)/playwright"      node_modules/playwright
//     ln -sf "$(npm root -g)/playwright-core" node_modules/playwright-core
//   then: node record.mjs [out.mp4]
//
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || join(__dirname, 'promo.mp4');
const WAV = join(__dirname, 'soundtrack.wav');
const PAGE = 'file://' + join(__dirname, 'promo.html');

// ffmpeg with libx264/aac. Defaults to the bundled imageio-ffmpeg build; set
// $FFMPEG to override. Install once with: pip3 install imageio-ffmpeg
function resolveFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const guess = '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
  if (existsSync(guess)) return guess;
  return 'ffmpeg'; // fall back to PATH
}
const FF = resolveFfmpeg();

const SR = 44100;

// Procedural soundtrack keyed to the page's timeline marks.
function buildWav(audio) {
  const DURATION = audio.duration;
  const T = audio.marks;
  const N = Math.floor(SR * DURATION);
  const L = new Float32Array(N), R = new Float32Array(N);
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const idx = t => Math.floor(t * SR);
  const tone = (t0, dur, freq, amp, decay = 6, glide = 0, pan = 0) => {
    const s = idx(t0), e = Math.min(N, idx(t0 + dur));
    for (let i = s; i < e; i++) {
      const tt = (i - s) / SR;
      const v = Math.sin(2 * Math.PI * (freq + glide * tt) * tt) * amp * Math.exp(-decay * tt);
      L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan));
    }
  };
  const bell = (t0, freq, amp, dur = 0.6, pan = 0) => {
    tone(t0, dur, freq, amp, 5, 0, pan);
    tone(t0, dur, freq * 2.01, amp * 0.5, 7, 0, pan);
    tone(t0, dur, freq * 3.0, amp * 0.25, 9, 0, pan);
  };
  const noise = (t0, dur, amp, decay = 8) => {
    const s = idx(t0), e = Math.min(N, idx(t0 + dur));
    for (let i = s; i < e; i++) { const v = (rnd() * 2 - 1) * amp * Math.exp(-decay * (i - s) / SR); L[i] += v; R[i] += v; }
  };

  noise(0.10, 0.55, 0.18, 4);
  bell(0.12, 220, 0.16, 1.2);
  for (let t = 0.4; t < T.find - 0.1; t += 0.82) { tone(t, 0.16, 60, 0.5, 10); tone(t + 0.17, 0.16, 52, 0.42, 11); }
  { const s = idx(T.scanStart), e = idx(T.find);
    for (let i = s; i < e; i++) { const p = (i - s) / (e - s); L[i] += Math.sin(2*Math.PI*(180+p*p*760)*((i-s)/SR)) * (0.05+p*0.14); R[i] = L[i]; } }
  noise(T.find, 0.12, 0.3, 20);
  bell(T.find, 880, 0.34, 0.7);
  bell(T.find + 0.02, 1320, 0.20, 0.55, 0.3);
  tone(T.find, 0.3, 70, 0.5, 8, -120);
  bell(T.m1, 660, 0.26, 0.5, -0.3);
  bell(T.m2, 880, 0.28, 0.5, 0.3);
  bell(T.m3, 1174, 0.34, 0.8, 0);
  noise(T.m3, 0.1, 0.22, 18);
  let tick = T.alarm, gap = 0.16;
  while (tick < T.outStart) { tone(tick, 0.05, 1600, 0.16, 40); tick += gap; gap = Math.max(0.06, gap * 0.9); }
  noise(T.outStart, 0.5, 0.28, 6);
  tone(T.outStart, 0.6, 48, 0.6, 3, -30);
  for (const f of [110, 138.6, 164.8, 220]) {
    const s = idx(T.outStart + 0.05);
    for (let i = s; i < N; i++) { const tt = (i - s) / SR; L[i] += Math.sin(2*Math.PI*f*tt) * 0.07 * Math.min(1, tt*4) * Math.exp(-0.5*tt); R[i] = L[i]; }
  }

  const enc = Buffer.alloc(44 + N * 4);
  enc.write('RIFF', 0); enc.writeUInt32LE(36 + N * 4, 4); enc.write('WAVE', 8);
  enc.write('fmt ', 12); enc.writeUInt32LE(16, 16); enc.writeUInt16LE(1, 20);
  enc.writeUInt16LE(2, 22); enc.writeUInt32LE(SR, 24); enc.writeUInt32LE(SR * 4, 28);
  enc.writeUInt16LE(4, 32); enc.writeUInt16LE(16, 34);
  enc.write('data', 36); enc.writeUInt32LE(N * 4, 40);
  const fade = idx(0.15);
  for (let i = 0; i < N; i++) {
    let f = 1; if (i < fade) f = i / fade; if (i > N - fade) f = (N - i) / fade;
    const cl = x => Math.tanh(x * 1.1) * 0.92 * f;
    enc.writeInt16LE(Math.max(-32767, Math.min(32767, cl(L[i]) * 32767)), 44 + i * 4);
    enc.writeInt16LE(Math.max(-32767, Math.min(32767, cl(R[i]) * 32767)), 44 + i * 4 + 2);
  }
  writeFileSync(WAV, enc);
}

async function main() {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.__recording = true; });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true');

  const audio = await page.evaluate('window.__AUDIO');
  buildWav(audio);
  const { fps: FPS, frames: FRAMES } = audio;
  console.log(`rendering ${FRAMES} frames @ ${FPS}fps (${audio.duration}s) → ${OUT}`);

  const ff = spawn(FF, [
    '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
    '-i', WAV,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let f = 0; f < FRAMES; f++) {
    const dataUrl = await page.evaluate((i) => { window.__seek(i); return document.getElementById('stage').toDataURL('image/png'); }, f);
    const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 30 === 0) process.stdout.write(`\r  frame ${f}/${FRAMES}`);
  }
  process.stdout.write(`\r  frame ${FRAMES}/${FRAMES}\n`);
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  await browser.close();
  console.log('✅ wrote', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
