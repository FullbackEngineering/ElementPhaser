// Capture real gameplay stills from the running game for the promo end card.
// Drives the actual flow (menu → play → falling objects → score/combo) and
// crops to the 720x1280 design area so no letterbox bars end up in the shot.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173/?canvas';
const OUT = 'shots';
const DESIGN_W = 720, DESIGN_H = 1280;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 1340 }, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
await page.waitForFunction(() => window.__game.scene.isActive('MenuScene'), null, { timeout: 8000 });

const rect = await page.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
const scale = Math.min(rect.width / DESIGN_W, rect.height / DESIGN_H);
const offX = rect.left + (rect.width - DESIGN_W * scale) / 2;
const offY = rect.top + (rect.height - DESIGN_H * scale) / 2;
const clip = { x: offX, y: offY, width: DESIGN_W * scale, height: DESIGN_H * scale };
const toClient = (dx, dy) => [offX + dx * scale, offY + dy * scale];

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png`, clip }); console.log('wrote', name); };

await shot('menu');

// PLAY
const [px, py] = toClient(360, 830);
await page.mouse.click(px, py);
await page.waitForFunction(() => window.__game.scene.isActive('GameScene'), null, { timeout: 8000 });

// Hide the debug overlay (GameConfig.debug is on) — it must not land in a promo still.
await page.evaluate(() => {
  const gs = window.__game.scene.getScene('GameScene');
  gs.fpsText?.setVisible(false);
  gs.children.list
    .filter((o) => o.type === 'Text' && /Kontrol:/.test(o.text ?? ''))
    .forEach((o) => o.setVisible(false));
});

// Build a believable HUD: score + combo streak.
await page.evaluate(() => {
  const bus = window.__game.registry.get('eventBus');
  for (let i = 0; i < 7; i++) bus.emit('match:correct', { element: 'fire', x: 360, y: 1000, perfect: true });
});

// Fill the play field. Applied AFTER scoring, or difficulty:changed would overwrite it.
await page.evaluate(() => {
  window.__game.scene.getScene('GameScene').spawner.applyDifficulty({
    spawnIntervalMs: 240, speedMin: 230, speedMax: 300, maxConcurrent: 7,
  });
});
await page.waitForFunction(() => window.__game.scene.getScene('GameScene').spawner.activeCount >= 4, null, { timeout: 8000 });
await page.waitForTimeout(700);
await shot('play-a');

await page.waitForTimeout(900);
await shot('play-b');

await page.waitForTimeout(800);
await shot('play-c');

await browser.close();
