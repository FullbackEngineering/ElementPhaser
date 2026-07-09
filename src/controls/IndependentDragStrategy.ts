import Phaser from 'phaser';
import type { GrinderRow } from '../objects/GrinderRow';
import type { GrinderControlStrategy } from './GrinderControlStrategy';

/**
 * Bağımsız mod — iki jest:
 *  - DRAG: bir grinder'a bas ve eşiği geçecek kadar kaydır → sürüklenir, en yakın slota oturur.
 *  - TAP: kısa dokunuş → grinder seçilir (kenarları parlar); ikinci bir grinder'a tap → ikisi
 *    animasyonlu yer değiştirir.
 * Aynı anda tek jest: ilk pointer jesti bitene kadar diğer pointer'lar yok sayılır (tek grinder).
 */
export class IndependentDragStrategy implements GrinderControlStrategy {
  readonly label = 'Bağımsız · Slot Drag';

  /** Basış tap mı drag mı: bu kadar px hareket edilince drag'e döner. */
  private static readonly DRAG_THRESHOLD = 14;

  private activePointerId = -1;
  private candidateIndex = -1;
  private grabOffset = 0;
  private downX = 0;
  private downY = 0;
  private dragging = false;
  private selectedIndex = -1;

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
    this.clearSelection();
    this.activePointerId = -1;
    this.candidateIndex = -1;
    this.dragging = false;
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    if (this.activePointerId !== -1) return; // tek jest: başka pointer meşgulken yok say
    const idx = this.row.pickGrinderAt(p.x, p.y);
    if (idx < 0) return;
    this.activePointerId = p.id;
    this.candidateIndex = idx;
    this.grabOffset = p.x - this.row.grinders[idx].x;
    this.downX = p.x;
    this.downY = p.y;
    this.dragging = false;
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (p.id !== this.activePointerId || this.candidateIndex < 0) return;
    if (!this.dragging) {
      const dist = Math.hypot(p.x - this.downX, p.y - this.downY);
      if (dist < IndependentDragStrategy.DRAG_THRESHOLD) return; // hâlâ tap olabilir
      this.dragging = true;
      this.clearSelection(); // drag başlarsa bekleyen tap-seçimi iptal
      this.row.beginDrag(this.candidateIndex);
    }
    this.row.dragTo(p.x - this.grabOffset);
  };

  private readonly onUp = (p: Phaser.Input.Pointer): void => {
    if (p.id !== this.activePointerId) return;
    if (this.dragging) {
      this.row.endDrag();
    } else {
      this.handleTap(this.candidateIndex);
    }
    this.activePointerId = -1;
    this.candidateIndex = -1;
    this.dragging = false;
  };

  private handleTap(index: number): void {
    if (this.selectedIndex === -1) {
      this.selectedIndex = index;
      this.row.setSelected(index, true);
    } else if (this.selectedIndex === index) {
      this.clearSelection(); // aynısına tekrar tap → seçim iptal
    } else {
      const from = this.selectedIndex;
      this.clearSelection();
      this.row.swapGrinders(from, index);
    }
  }

  private clearSelection(): void {
    if (this.selectedIndex >= 0) {
      this.row.setSelected(this.selectedIndex, false);
      this.selectedIndex = -1;
    }
  }
}
