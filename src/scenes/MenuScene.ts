import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { Button } from '../ui/Button';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    drawGradientBackground(this);
    const cx = GameConfig.designWidth / 2;

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

    new Button(this, {
      x: cx,
      y: 830,
      width: 380,
      height: 100,
      label: '▶  OYNA',
      onClick: () => this.scene.start(SceneKeys.Game)
    });

    this.add
      .text(cx, GameConfig.designHeight - 70, 'M5 · Skor · Combo · Can', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: Palette.textDim
      })
      .setOrigin(0.5);
  }
}
