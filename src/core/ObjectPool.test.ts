import { describe, it, expect } from 'vitest';
import { ObjectPool } from './ObjectPool';

interface Item {
  active: boolean;
}

function makePool(prewarm = 0) {
  let created = 0;
  const factory = (): Item => {
    created++;
    return { active: true };
  };
  const reset = (i: Item): void => {
    i.active = false;
  };
  const pool = new ObjectPool<Item>(factory, reset, prewarm);
  return { pool, created: () => created };
}

describe('ObjectPool', () => {
  it('prewarm nesneleri üretir ve resetler', () => {
    const { pool, created } = makePool(3);
    expect(pool.freeCount).toBe(3);
    expect(created()).toBe(3);
  });

  it('acquire havuzdan alır, boşsa yenisini üretir', () => {
    const { pool, created } = makePool(1);
    pool.acquire(); // havuzdakini kullan
    expect(pool.freeCount).toBe(0);
    pool.acquire(); // havuz boş → factory
    expect(created()).toBe(2);
  });

  it('release resetleyip havuza iade eder (new yok)', () => {
    const { pool, created } = makePool(0);
    const item = pool.acquire();
    expect(item.active).toBe(true);
    pool.release(item);
    expect(item.active).toBe(false); // reset çağrıldı
    expect(pool.freeCount).toBe(1);

    const reused = pool.acquire();
    expect(reused).toBe(item); // aynı nesne geri geldi
    expect(created()).toBe(1); // yeni üretim olmadı
  });
});
