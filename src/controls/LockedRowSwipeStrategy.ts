import Phaser from 'phaser';
import type { GrinderRow } from '../objects/GrinderRow';
import type { GrinderControlStrategy } from './GrinderControlStrategy';

/** Tüm öğütücü satırını tek parça olarak swipe ile kaydırır (tek başparmak dostu). */
export class LockedRowSwipeStrategy implements GrinderControlStrategy {
  readonly label = 'Kilitli Satır · Swipe';

  private grabbing = false;
  private grabPointerX = 0;
  private grabRowX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly row: GrinderRow
  ) {}

  attach(): void {
    this.scene.input.on('pointerdown', this.onDown);
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('pointerupoutside', this.onUp);
  }

  detach(): void {
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.scene.input.off('pointerupoutside', this.onUp);
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    this.grabbing = true;
    this.grabPointerX = p.x;
    this.grabRowX = this.row.rowX;
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (!this.grabbing) return;
    this.row.slideTo(this.grabRowX + (p.x - this.grabPointerX));
  };

  private readonly onUp = (): void => {
    this.grabbing = false;
  };
}
