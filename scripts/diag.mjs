import { chromium } from 'playwright';
const URL = process.argv[2] ?? 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}\n${e.stack ?? ''}`));
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { game: false };
  return {
    game: true,
    scenes: g.scene.scenes.map((s) => ({ key: s.sys.settings.key, active: s.sys.isActive() })),
    fps: Math.round(g.loop.actualFps)
  };
});
console.log('=== CONSOLE / ERRORS ===');
console.log(logs.join('\n') || '(yok)');
console.log('\n=== GAME INFO ===');
console.log(JSON.stringify(info, null, 2));
await browser.close();
