/**
 * Genel amaçlı nesne havuzu. Sıcak döngüde `new` yapmamak için — GC spike yok.
 * `factory` yeni nesne üretir; `reset` nesneyi pasif/temiz duruma getirir.
 */
export class ObjectPool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    prewarm = 0
  ) {
    for (let i = 0; i < prewarm; i++) {
      const item = this.factory();
      this.reset(item);
      this.free.push(item);
    }
  }

  acquire(): T {
    const item = this.free.pop();
    return item ?? this.factory();
  }

  release(item: T): void {
    this.reset(item);
    this.free.push(item);
  }

  get freeCount(): number {
    return this.free.length;
  }
}
