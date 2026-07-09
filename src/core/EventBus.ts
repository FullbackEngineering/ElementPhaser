import type { GameEvents } from '../types/events';

type AnyHandler = (payload: unknown) => void;

interface Listener {
  fn: AnyHandler;
  ctx?: unknown;
  once: boolean;
}

/**
 * Tipli event emitter. Yanlış event adı/payload derleme anında yakalanır.
 * Gameplay ↔ sonuç (skor/ses/parçacık/analytics) iletişimi tamamen buradan geçer;
 * böylece yeni tüketiciler (reklam, achievement) gameplay koduna dokunmadan eklenir.
 *
 * Motor-bağımsız (ARCHITECTURE §3: core/ = engine-independent) → Phaser'sız node/
 * jsdom testinde de koşar; Score/Lives manager'ları gerçek bus ile test edilir.
 */
export class EventBus {
  private readonly listeners = new Map<string, Listener[]>();

  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const arr = this.listeners.get(key as string);
    if (!arr || arr.length === 0) return;
    // Snapshot: dinleyici içinde on/off çağrısı iterasyonu bozmasın.
    for (const l of arr.slice()) {
      l.fn.call(l.ctx, payload);
      if (l.once) {
        const i = arr.indexOf(l);
        if (i !== -1) arr.splice(i, 1);
      }
    }
  }

  on<K extends keyof GameEvents>(key: K, fn: (payload: GameEvents[K]) => void, ctx?: unknown): void {
    this.add(key as string, fn as AnyHandler, ctx, false);
  }

  once<K extends keyof GameEvents>(key: K, fn: (payload: GameEvents[K]) => void, ctx?: unknown): void {
    this.add(key as string, fn as AnyHandler, ctx, true);
  }

  off<K extends keyof GameEvents>(key: K, fn?: (payload: GameEvents[K]) => void, ctx?: unknown): void {
    if (!fn) {
      this.listeners.delete(key as string);
      return;
    }
    const arr = this.listeners.get(key as string);
    if (!arr) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      const l = arr[i];
      if (l.fn === (fn as AnyHandler) && (ctx === undefined || l.ctx === ctx)) arr.splice(i, 1);
    }
    if (arr.length === 0) this.listeners.delete(key as string);
  }

  destroy(): void {
    this.listeners.clear();
  }

  private add(key: string, fn: AnyHandler, ctx: unknown, once: boolean): void {
    const arr = this.listeners.get(key);
    if (arr) arr.push({ fn, ctx, once });
    else this.listeners.set(key, [{ fn, ctx, once }]);
  }
}
