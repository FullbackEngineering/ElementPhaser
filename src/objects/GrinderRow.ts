import Phaser from 'phaser';
import { Palette } from '../config/GameConfig';
import type { ElementType } from '../types';
import { Grinder } from './Grinder';

export type ControlMode = 'lockedRow' | 'independent';

interface GrinderDef {
  element: ElementType;
  color: number;
  emoji: string;
}

const DEFS: GrinderDef[] = [
  { element: 'fire', color: Palette.fire, emoji: '🔥' },
  { element: 'water', color: Palette.water, emoji: '💧' },
  { element: 'earth', color: Palette.earth, emoji: '🌱' },
  { element: 'air', color: Palette.air, emoji: '💨' }
];

/**
 * 4 öğütücünün container'ı. İki kontrol modu:
 *  - lockedRow: tüm satır birlikte, sürekli kayar (container.x). Her grinder tüm genişliğe ulaşır.
 *  - independent: her grinder 4 SABİT SLOT'tan birine oturur. Sürüklerken en yakın slota
 *    canlı yer değiştirir (reorder) ve bırakınca slot merkezine sabitlenir. Ayrıca tap ile
 *    seçilip başka grinder'a tap ile animasyonlu yer değiştirilebilir (swapGrinders).
 * Hareket hedefe doğru lerp ile yumuşatılır. Eşleşme sorgusu (M4) için `grinderUnderX`.
 */
export class GrinderRow {
  readonly container: Phaser.GameObjects.Container;
  readonly grinders: Grinder[] = [];

  private readonly scene: Phaser.Scene;
  private mode: ControlMode;
  private readonly width: number;
  private readonly edgeMargin = 78;

  /** Sabit slot X pozisyonları (soldan sağa). */
  private readonly slotX: number[] = [];
  /** grinderIndex -> slotIndex (independent modda permütasyon). */
  private readonly slotOf: number[] = [];
  /** Swap tween'i sürerken lerp'in ezmemesi için kilitli grinder indeksleri. */
  private readonly locked = new Set<number>();

  // lockedRow durumu
  private rowTargetX = 0;
  private readonly minCx: number;
  private readonly maxCx: number;

  // independent sürükleme durumu
  private draggedIndex = -1;
  private dragX = 0;

  constructor(scene: Phaser.Scene, width: number, y: number, mode: ControlMode) {
    this.scene = scene;
    this.width = width;
    this.mode = mode;
    this.container = scene.add.container(0, y);

    const size = 132;
    const spacing = 160;
    const clusterW = spacing * (DEFS.length - 1);
    const startX = (width - clusterW) / 2;

    DEFS.forEach((d, i) => {
      const g = new Grinder(scene, d.element, d.color, d.emoji, size);
      g.x = startX + i * spacing;
      this.container.add(g);
      this.grinders.push(g);
      this.slotX.push(g.x);
      this.slotOf.push(i);
    });

    // Kilitli-satır kayma sınırları: her grinder [margin, width-margin] aralığına ulaşabilsin.
    const minLocal = this.slotX[0];
    const maxLocal = this.slotX[this.slotX.length - 1];
    this.minCx = this.edgeMargin - maxLocal;
    this.maxCx = width - this.edgeMargin - minLocal;
  }

  get rowX(): number {
    return this.rowTargetX;
  }

  /** Objelerin hizalanacağı sabit lane merkezleri (= slot X'leri, ekran koordinatı). */
  get laneCenters(): readonly number[] {
    return this.slotX;
  }

  setMode(mode: ControlMode): void {
    this.mode = mode;
    this.resetToRest();
  }

  resetToRest(): void {
    this.rowTargetX = 0;
    this.container.x = 0;
    this.draggedIndex = -1;
    this.locked.clear();
    this.clearSelection();
    this.grinders.forEach((g, i) => {
      this.scene.tweens.killTweensOf(g);
      this.slotOf[i] = i;
      g.x = this.slotX[i];
      g.setScale(1);
    });
  }

  // --- lockedRow API ---
  slideTo(cx: number): void {
    this.rowTargetX = Phaser.Math.Clamp(cx, this.minCx, this.maxCx);
  }

  // --- independent (slot-tabanlı) API ---
  beginDrag(index: number): void {
    this.scene.tweens.killTweensOf(this.grinders[index]);
    this.locked.delete(index);
    this.grinders[index].setScale(1);
    this.draggedIndex = index;
    this.dragX = this.grinders[index].x;
  }

  /** Sürüklenen grinder'ı finger'a taşı; en yakın slota canlı reorder uygula. */
  dragTo(x: number): void {
    if (this.draggedIndex < 0) return;
    this.dragX = Phaser.Math.Clamp(x, this.edgeMargin, this.width - this.edgeMargin);

    const targetSlot = this.nearestSlot(this.dragX);
    const currentSlot = this.slotOf[this.draggedIndex];
    if (targetSlot !== currentSlot) {
      const other = this.slotOf.findIndex((s, gi) => s === targetSlot && gi !== this.draggedIndex);
      if (other >= 0) {
        this.slotOf[other] = currentSlot; // yerinden olan komşu boşalan slota kayar
        this.slotOf[this.draggedIndex] = targetSlot;
      }
    }
  }

  endDrag(): void {
    this.draggedIndex = -1; // update() grinder'ı slot merkezine oturtur
  }

  // --- tap-seçim / swap API (independent) ---
  setSelected(index: number, on: boolean): void {
    this.grinders[index]?.setHighlight(on);
  }

  clearSelection(): void {
    for (const g of this.grinders) g.setHighlight(false);
  }

  /** İki grinder'ı slotlarıyla birlikte animasyonlu yer değiştirir. */
  swapGrinders(a: number, b: number): void {
    if (a === b) return;
    const sa = this.slotOf[a];
    const sb = this.slotOf[b];
    this.slotOf[a] = sb;
    this.slotOf[b] = sa;
    this.animateSwap(a);
    this.animateSwap(b);
  }

  /** Verilen ekran X'ine en yakın grinder indeksi (yarıçap eşiği içinde), yoksa -1. */
  nearestGrinderIndex(x: number): number {
    let best = -1;
    let bestDist = Infinity;
    this.grinders.forEach((g, i) => {
      const d = Math.abs(g.x + this.container.x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return bestDist <= this.grinders[0].radius * 1.4 ? best : -1;
  }

  /** Bir dokunuşun hedeflediği grinder indeksi; satır bandının dışındaysa -1. */
  pickGrinderAt(x: number, y: number): number {
    if (Math.abs(y - this.container.y) > this.grinders[0].radius * 1.6) return -1;
    return this.nearestGrinderIndex(x);
  }

  /** M4 için: verilen ekran X'inin altındaki grinder (aralık dışıysa null). */
  grinderUnderX(x: number): Grinder | null {
    for (const g of this.grinders) {
      if (Math.abs(g.x + this.container.x - x) <= g.radius) return g;
    }
    return null;
  }

  update(dt: number): void {
    const t = Math.min(1, dt * 0.03); // snappy, framerate-bağımsız yumuşatma
    if (this.mode === 'lockedRow') {
      this.container.x = Phaser.Math.Linear(this.container.x, this.rowTargetX, t);
      return;
    }
    this.grinders.forEach((g, i) => {
      if (this.locked.has(i)) return; // swap tween'i sürüyor
      const target = i === this.draggedIndex ? this.dragX : this.slotX[this.slotOf[i]];
      g.x = Phaser.Math.Linear(g.x, target, t);
    });
  }

  /** swapGrinders için: bir grinder'ı yeni slotuna zıplama + pop ile taşır. */
  private animateSwap(i: number): void {
    const g = this.grinders[i];
    const targetX = this.slotX[this.slotOf[i]];
    this.scene.tweens.killTweensOf(g);
    this.locked.add(i);
    this.scene.tweens.add({
      targets: g,
      x: targetX,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => {
        g.x = targetX;
        this.locked.delete(i);
      }
    });
    this.scene.tweens.add({
      targets: g,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 150,
      yoyo: true,
      ease: 'Quad.out'
    });
  }

  private nearestSlot(x: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let s = 0; s < this.slotX.length; s++) {
      const d = Math.abs(this.slotX[s] - x);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }
}
