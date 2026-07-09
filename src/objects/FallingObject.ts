import Phaser from 'phaser';
import { Palette } from '../config/GameConfig';
import type { ElementType } from '../types';
import type { ObjectDef } from '../config/objectCatalog';
import { objTex } from '../constants/assetKeys';

const COLOR: Record<ElementType, number> = {
  fire: Palette.fire,
  water: Palette.water,
  earth: Palette.earth,
  air: Palette.air
};

/**
 * Havuzlanabilir düşen obje. Arcade dynamic body ile düşer (velocity.y).
 * Placeholder görsel: element renginde disk + emoji. Gerçek sanat gelince
 * yalnızca `redraw` sprite'a çevrilir (API aynı). Havuza `deactivate` ile döner.
 */
export class FallingObject extends Phaser.GameObjects.Container {
  element: ElementType = 'fire';
  radius = 46;

  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly sprite: Phaser.GameObjects.Image;
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.gfx = scene.add.graphics();
    this.icon = scene.add.text(0, 0, '', { fontSize: '48px' }).setOrigin(0.5);
    this.sprite = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.add([this.gfx, this.icon, this.sprite]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.deactivate();
  }

  spawn(def: ObjectDef, x: number, speed: number, scale: number): void {
    this.element = def.element;
    const r = Math.round(46 * scale);
    this.radius = r;

    // Gerçek sanat varsa sprite'ı göster (en büyük kenar ≈ 2r), placeholder'ı gizle;
    // yoksa (earth/air/meteor) renkli disk + emoji placeholder'da kalır.
    const tex = objTex(def.element, def.key);
    if (this.scene.textures.exists(tex)) {
      this.sprite.setTexture(tex);
      this.sprite.setScale((r * 2) / Math.max(this.sprite.width, this.sprite.height));
      this.sprite.setVisible(true);
      this.gfx.setVisible(false);
      this.icon.setVisible(false);
    } else {
      this.gfx.clear();
      this.gfx.fillStyle(COLOR[def.element], 0.22);
      this.gfx.lineStyle(3, COLOR[def.element], 0.95);
      this.gfx.fillCircle(0, 0, r);
      this.gfx.strokeCircle(0, 0, r);
      this.icon.setText(def.emoji);
      this.icon.setFontSize(Math.round(r * 1.15));
      this.sprite.setVisible(false);
      this.gfx.setVisible(true);
      this.icon.setVisible(true);
    }

    this.setPosition(x, -r - 10);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setSize(r * 2, r * 2);
    this.body.setOffset(-r, -r); // body'yi container origin'ine ortala
    this.body.setVelocity(0, speed);
  }

  deactivate(): void {
    // body, sahne yıkımı sırasında undefined olabilir → guard.
    if (this.body) {
      this.body.setVelocity(0, 0);
      this.body.enable = false;
    }
    this.setActive(false);
    this.setVisible(false);
    this.setPosition(-999, -999);
  }
}
