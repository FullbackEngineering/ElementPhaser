// Quick visual check: dump a few key frames as PNGs to eyeball before the
// full render. Usage: node verify_frames.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.addInitScript(() => { window.__recording = true; });
await page.goto('file://' + join(__dirname, 'promo.html'), { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true');
const { fps, duration } = await page.evaluate('window.__AUDIO');

// fractions of the whole clip → intro, reveal, search, find, combo, end card
for (const [name, frac] of Object.entries({ intro: 0.08, reveal: 0.25, search: 0.44, find: 0.54, combo: 0.74, endcard: 0.92 })) {
  const f = Math.round(frac * duration * fps);
  const dataUrl = await page.evaluate((i) => { window.__seek(i); return document.getElementById('stage').toDataURL('image/png'); }, f);
  writeFileSync(join(__dirname, `_frame_${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('wrote _frame_' + name + '.png');
}
await browser.close();
