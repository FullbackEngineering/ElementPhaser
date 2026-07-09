import type { EventBus } from '../core/EventBus';
import type { GrinderRow } from '../objects/GrinderRow';
import type { SpawnManager } from './SpawnManager';
import type { ElementType } from '../types';

export type MatchOutcome = 'correct' | 'wrong' | 'missed';

/**
 * SAF karar: motordan bağımsız, birim test edilebilir.
 * Altında öğütücü yok → missed; element eşleşiyor → correct; değilse → wrong.
 */
export function resolveMatch(objectEl: ElementType, grinderEl: ElementType | null): MatchOutcome {
  if (grinderEl === null) return 'missed';
  return grinderEl === objectEl ? 'correct' : 'wrong';
}

/**
 * Her frame catch-line'ı geçen objeleri altındaki öğütücüyle çözer, EventBus'a
 * yayınlar ve objeyi havuza döndürür. Skor/can bunu dinleyen manager'larda.
 */
export class MatchResolver {
  constructor(
    private readonly bus: EventBus,
    private readonly row: GrinderRow,
    private readonly spawner: SpawnManager,
    private readonly catchLineY: number
  ) {}

  update(): void {
    // `items`, SpawnManager'ın CANLI aktif-obje dizisidir (kopya değil, performans için).
    // GERİYE doğru geziyoruz: `despawn()` içteki splice mevcut indeksin ALTINDAKİ
    // elemanları kaydırdığında bile hiçbir obje atlanmaz veya İKİ KEZ ziyaret edilmez.
    const items = this.spawner.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const obj = items[i];
      // TEK-İŞLEME GARANTİSİ + use-after-free koruması:
      //  - `!obj.active`: obje aynı frame içinde başka bir yolla (ekran-dışı despawn ya
      //    da bir event dinleyicisinden gelen olası re-entrancy) zaten havuza dönmüşse
      //    `deactivate()` onu pasif yapmıştır → BİR DAHA işlemeyiz (çift-despawn imkânsız).
      //  - Bir obje yalnızca `grinderUnderX` ile TEK bir öğütücüye eşlenir; iki slot
      //    üst üste binse bile ilk isabet alınır → "aynı item birden çok slotta işlenir"
      //    durumu mimari gereği oluşamaz.
      if (!obj.active || obj.y < this.catchLineY) continue;

      const grinder = this.row.grinderUnderX(obj.x);
      const outcome = resolveMatch(obj.element, grinder ? grinder.element : null);
      const x = obj.x;
      const y = obj.y;

      if (outcome === 'correct') {
        const centerDist = Math.abs(obj.x - (grinder!.x + this.row.container.x));
        const perfect = centerDist < grinder!.radius * 0.45;
        this.bus.emit('match:correct', { element: obj.element, x, y, perfect });
      } else if (outcome === 'wrong') {
        this.bus.emit('match:wrong', { objectElement: obj.element, grinderElement: grinder!.element, x, y });
      } else {
        this.bus.emit('object:missed', { element: obj.element, x, y });
      }

      this.spawner.despawn(obj);
    }
  }
}
