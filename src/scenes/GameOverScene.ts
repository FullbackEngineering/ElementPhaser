import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { Button } from '../ui/Button';

interface GameOverData {
  score: number;
  best: number;
  bestCombo: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.GameOver);
  }

  create(data: Partial<GameOverData>): void {
    drawGradientBackground(this, Palette.bgBottom, 0x05060f);
    const cx = GameConfig.designWidth / 2;
    const score = data.score ?? 0;
    const best = data.best ?? 0;
    const bestCombo = data.bestCombo ?? 0;

    this.add
      .text(cx, 360, 'GAME OVER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '72px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 500, `SKOR\n${score}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        color: '#ffd166',
        fontStyle: 'bold',
        align: 'center'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 650, `EN İYİ: ${best}      EN YÜKSEK COMBO: ${bestCombo}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: Palette.textDim,
        align: 'center'
      })
      .setOrigin(0.5);

    new Button(this, {
      x: cx,
      y: 880,
      width: 380,
      height: 100,
      label: '↻  TEKRAR OYNA',
      onClick: () => this.scene.start(SceneKeys.Game)
    });

    new Button(this, {
      x: cx,
      y: 1010,
      width: 380,
      height: 88,
      label: 'MENÜ',
      fill: Palette.panel,
      textColor: Palette.textLight,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });
  }
}
