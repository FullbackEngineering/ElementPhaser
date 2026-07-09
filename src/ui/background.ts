import Phaser from 'phaser';
import { Palette } from '../config/GameConfig';

/** Dikey gradyan arka plan (premium dark tema). */
export function drawGradientBackground(
  scene: Phaser.Scene,
  top: number = Palette.bgTop,
  bottom: number = Palette.bgBottom
): Phaser.GameObjects.Graphics {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, width, height);
  g.setDepth(-1000);
  return g;
}
