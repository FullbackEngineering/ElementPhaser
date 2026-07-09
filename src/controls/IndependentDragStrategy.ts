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

  /** Aktif jestin pointer'ı (referansla; Phaser Pointer nesnelerini yeniden kullanır). */
  private activePointer: Phaser.Input.Pointer | null = null;
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
    this.resetGesture();
  }

  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    // Kendini-iyileştirme: önceki jestin pointer'ı artık BASILI değilse (kayıp
    // pointerup / touchcancel / ikinci parmak) takılı state'i temizle. Aksi halde
    // activePointer sonsuza dek dolu kalır → hiçbir grinder tutulamaz, "yenileyene
    // kadar tepki vermez". Bu tek satır o donma sınıfını imkânsız kılar.
    if (this.activePointer && !this.activePointer.isDown) this.resetGesture();
    if (this.activePointer) return; // tek jest: başka pointer meşgulken yok say
    const idx = this.row.pickGrinderAt(p.x, p.y);
    if (idx < 0) return;
    this.activePointer = p;
    this.candidateIndex = idx;
    this.grabOffset = p.x - this.row.grinders[idx].x;
    this.downX = p.x;
    this.downY = p.y;
    this.dragging = false;
  };

  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (p !== this.activePointer || this.candidateIndex < 0) return;
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
    if (p !== this.activePointer) return;
    if (!this.dragging) this.handleTap(this.candidateIndex); // tap-seçim jest state'inden bağımsız kalır
    this.resetGesture();
  };

  /** Jest state'ini sıfırla; sürükleme yarıda kaldıysa grinder'ı slotuna oturt (tap-seçimi korunur). */
  private resetGesture(): void {
    if (this.dragging) this.row.endDrag();
    this.activePointer = null;
    this.candidateIndex = -1;
    this.dragging = false;
  }

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
