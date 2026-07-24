import Phaser from 'phaser';
import { Palette } from '../config/GameConfig';

export interface ButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick: () => void;
  fill?: number;
  textColor?: string;
  fontSize?: number;
}

/** Yeniden kullanılabilir yuvarlatılmış buton (hover/press mikro-animasyonlu). */
export class Button extends Phaser.GameObjects.Container {
  private readonly labelText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, cfg: ButtonConfig) {
    super(scene, cfg.x, cfg.y);

    const fill = cfg.fill ?? Palette.accent;
    const radius = Math.min(cfg.height / 2, 28);

    const bg = scene.add.graphics();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(-cfg.width / 2, -cfg.height / 2, cfg.width, cfg.height, radius);

    const label = scene.add
      .text(0, 0, cfg.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${cfg.fontSize ?? 34}px`,
        color: cfg.textColor ?? '#1a1f3d',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.labelText = label;

    this.add([bg, label]);
    this.setSize(cfg.width, cfg.height);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerover', () =>
      scene.tweens.add({ targets: this, scale: 1.05, duration: 120, ease: 'Sine.out' })
    );
    this.on('pointerout', () =>
      scene.tweens.add({ targets: this, scale: 1.0, duration: 120, ease: 'Sine.out' })
    );
    this.on('pointerdown', () =>
      scene.tweens.add({ targets: this, scale: 0.95, duration: 80, ease: 'Sine.out' })
    );
    this.on('pointerup', () => {
      scene.tweens.add({ targets: this, scale: 1.05, duration: 80, ease: 'Sine.out' });
      cfg.onClick();
    });

    scene.add.existing(this);
  }

  /** Buton metnini günceller (örn. geri sayım). */
  setLabel(text: string): this {
    this.labelText.setText(text);
    return this;
  }
}
