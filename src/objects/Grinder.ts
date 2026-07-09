import Phaser from 'phaser';
import type { ElementType } from '../types';

/**
 * Tek bir öğütücü/kase. Şu an placeholder çizim; gerçek sanat gelince
 * yalnızca görsel katman `Tex.grinder[element]` sprite'ı ile değişir (API aynı kalır).
 */
export class Grinder extends Phaser.GameObjects.Container {
  readonly element: ElementType;
  readonly radius: number;

  /** Seçili durumda kenarlardan parlayan halka (independent modda tap-seçim). */
  private readonly highlight: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, element: ElementType, color: number, emoji: string, size: number) {
    super(scene, 0, 0);
    this.element = element;
    this.radius = size / 2;

    // Seçim parıltısı — kutunun dışını saran halka; kapalıyken görünmez.
    const glow = scene.add.graphics();
    glow.lineStyle(6, color, 1);
    glow.strokeRoundedRect(-size / 2 - 7, -size / 2 - 7, size + 14, size + 14, 30);
    glow.setAlpha(0);
    this.highlight = glow;

    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 0.22);
    gfx.lineStyle(4, color, 0.95);
    gfx.fillRoundedRect(-size / 2, -size / 2, size, size, 26);
    gfx.strokeRoundedRect(-size / 2, -size / 2, size, size, 26);

    const icon = scene.add.text(0, 0, emoji, { fontSize: `${Math.round(size * 0.46)}px` }).setOrigin(0.5);

    this.add([glow, gfx, icon]);
    this.setSize(size, size);
  }

  /** Seçili görünümü aç/kapat; açıkken kenarlar nabız gibi parlar. */
  setHighlight(on: boolean): void {
    this.highlightTween?.stop();
    this.highlightTween = undefined;
    if (on) {
      this.highlight.setAlpha(1).setScale(1);
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlight,
        alpha: { from: 0.4, to: 1 },
        scaleX: { from: 1, to: 1.08 },
        scaleY: { from: 1, to: 1.08 },
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    } else {
      this.highlight.setAlpha(0).setScale(1);
    }
  }
}
