import Phaser from 'phaser';
import { GameConfig } from './config/GameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

// Headless smoke-test ortamında WebGL framebuffer desteklenmediğinden `?canvas`
// ile Canvas renderer'a düşülebilir (oyun mantığı aynı). Normalde AUTO = WebGL.
const forceCanvas = new URLSearchParams(window.location.search).has('canvas');

const config: Phaser.Types.Core.GameConfig = {
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO, // WebGL, gerekirse Canvas fallback
  parent: 'game',
  backgroundColor: '#0f1226',
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GameConfig.designWidth,
    height: GameConfig.designHeight
  },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60, min: 30 },
  // Arcade Physics: düşen objeler velocity ile düşer; M4'te overlap tespiti.
  // Yerçekimi yok (0) — hız manuel ayarlanır (bkz. ARCHITECTURE.md §2).
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Debug'ta smoke-test / geliştirme için Phaser instance'ını dışa aç.
if (GameConfig.debug) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
