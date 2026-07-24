import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { Button } from '../ui/Button';
import type { AudioManager } from '../managers/AudioManager';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    drawGradientBackground(this);
    const cx = GameConfig.designWidth / 2;

    // Arka plan müziğini başlat (idempotent; tarayıcı kilidi varsa ilk dokunuşta açılır).
    (this.registry.get('audioManager') as AudioManager).startMusic();

    this.add
      .text(cx, 320, 'ELEMENT', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '84px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 412, 'GRINDER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '84px',
        color: '#ffd166',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add.text(cx, 545, '🔥   💧   🌱   💨', { fontSize: '56px' }).setOrigin(0.5);

    // Ayar (⚙) butonu — sağ üst köşe; ayarlar overlay'ini açar.
    this.add
      .text(GameConfig.designWidth - 60, 70, '⚙', { fontSize: '52px' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.launch(SceneKeys.Settings));

    new Button(this, {
      x: cx,
      y: 830,
      width: 380,
      height: 100,
      label: '▶  OYNA',
      onClick: () => this.scene.start(SceneKeys.Game)
    });

    new Button(this, {
      x: cx,
      y: 960,
      width: 380,
      height: 88,
      label: '🏆  Liderlik Tablosu',
      fill: Palette.panel,
      textColor: Palette.textLight,
      onClick: () => this.scene.start(SceneKeys.Leaderboard)
    });
  }
}
