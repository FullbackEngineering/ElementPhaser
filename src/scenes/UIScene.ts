import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import type { EventBus } from '../core/EventBus';
import type { SaveManager } from '../managers/SaveManager';
import type { GameEvents } from '../types/events';

/**
 * HUD overlay — GameScene üstünde paralel çalışır. Sadece EventBus üzerinden
 * beslenir (GameScene'in iç objelerine erişmez). M5'te Score/Lives manager'ları
 * bu event'leri yayınlayınca HUD otomatik güncellenecek.
 */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Text[] = [];
  private paused = false;

  constructor() {
    super(SceneKeys.UI);
  }

  create(): void {
    const bus = this.registry.get('eventBus') as EventBus;
    const w = GameConfig.designWidth;

    const panel = this.add.graphics();
    panel.fillStyle(Palette.panel, 0.55);
    panel.fillRoundedRect(16, 24, w - 32, 150, 24);

    this.scoreText = this.add.text(40, 40, '0', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '56px',
      color: Palette.textLight,
      fontStyle: 'bold'
    });
    const save = this.registry.get('saveManager') as SaveManager;
    this.add.text(42, 116, `BEST: ${save.bestScore}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: Palette.textDim
    });

    this.comboText = this.add
      .text(w / 2, 100, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffd166',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    for (let i = 0; i < GameConfig.startingLives; i++) {
      const heart = this.add
        .text(w - 44 - i * 52, 70, '♥', { fontSize: '44px', color: Palette.heart })
        .setOrigin(0.5);
      this.hearts.push(heart);
    }

    const pauseBtn = this.add
      .text(w - 52, 138, '⏸', { fontSize: '38px', color: Palette.textLight })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    pauseBtn.on('pointerup', () => this.togglePause());

    bus.on('score:changed', this.onScore);
    bus.on('combo:changed', this.onCombo);
    bus.on('life:changed', this.onLife);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('score:changed', this.onScore);
      bus.off('combo:changed', this.onCombo);
      bus.off('life:changed', this.onLife);
    });
  }

  private readonly onScore = (p: GameEvents['score:changed']): void => {
    this.scoreText.setText(`${p.score}`);
  };

  private readonly onCombo = (p: GameEvents['combo:changed']): void => {
    this.comboText.setText(p.combo > 1 ? `x${p.multiplier} · ${p.combo} COMBO` : '');
  };

  private readonly onLife = (p: GameEvents['life:changed']): void => {
    this.hearts.forEach((h, i) => h.setColor(i < p.lives ? Palette.heart : Palette.heartEmpty));
  };

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) this.scene.pause(SceneKeys.Game);
    else this.scene.resume(SceneKeys.Game);
  }
}
