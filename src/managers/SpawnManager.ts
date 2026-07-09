import Phaser from 'phaser';
import { FallingObject } from '../objects/FallingObject';
import { ObjectPool } from '../core/ObjectPool';
import { ELEMENTS, OBJECTS_BY_ELEMENT } from '../config/objectCatalog';
import { GameConfig } from '../config/GameConfig';
import type { DifficultySnapshot } from '../types/domain';

/**
 * Objeleri üstten, rastgele X'ten, farklı hız/boyutta düşürür ve havuzdan geri
 * dönüştürür (GC yok). M3'te sabit temel oran; zorluk eğrisi M10'da bağlanacak.
 * Eşleşme/çarpışma M4'te (MatchResolver) — burada obje sadece doğar, düşer, dibi
 * geçince havuza döner.
 */
export class SpawnManager {
  private readonly pool: ObjectPool<FallingObject>;
  private readonly activeObjects: FallingObject[] = [];

  private timer = 0;
  private started = false; // ilk spawn oldu mu (ilk gecikme farklı: firstSpawnMs)
  private readonly firstSpawnMs = GameConfig.difficulty.firstSpawnMs;
  // Zorluk parametreleri (DifficultyManager `applyDifficulty` ile besler; başlangıç ilk kademe).
  private intervalMs = 1800;
  private speedMin = 160;
  private speedMax = 200;
  private maxConcurrent = 1;
  private totalSpawnedCount = 0;
  private totalDespawnedCount = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly height: number,
    /** Objelerin hizalanacağı sabit lane merkezleri (grinder slot X'leri). */
    private readonly lanes: readonly number[]
  ) {
    this.pool = new ObjectPool<FallingObject>(
      () => new FallingObject(scene),
      (o) => o.deactivate(),
      10
    );
  }

  /** DifficultyManager'dan gelen zorluk parametrelerini uygular (event üzerinden). */
  applyDifficulty(s: DifficultySnapshot): void {
    this.intervalMs = s.spawnIntervalMs;
    this.speedMin = s.speedMin;
    this.speedMax = s.speedMax;
    this.maxConcurrent = s.maxConcurrent;
  }

  update(dt: number): void {
    this.timer += dt;
    // İlk spawn kısa gecikmeyle (firstSpawnMs), sonrakiler kademe aralığıyla (intervalMs).
    const threshold = this.started ? this.intervalMs : this.firstSpawnMs;
    if (this.timer >= threshold) {
      if (this.activeObjects.length < this.maxConcurrent) {
        this.timer -= threshold;
        this.started = true;
        this.spawnOne();
      } else {
        this.timer = threshold; // kapasite dolu; taşmayı önle, yer açılınca hemen spawn
      }
    }
    // ekran dibini geçenleri havuza iade et (güvenlik ağı; normalde MatchResolver
    // catch-line'da yakalar)
    for (let i = this.activeObjects.length - 1; i >= 0; i--) {
      if (this.activeObjects[i].y > this.height + 90) this.despawnAt(i);
    }
  }

  /** MatchResolver için: aktif objeler (salt-okunur). */
  get items(): readonly FallingObject[] {
    return this.activeObjects;
  }

  /** Bir objeyi havuza döndür (eşleşme sonrası). */
  despawn(obj: FallingObject): void {
    const i = this.activeObjects.indexOf(obj);
    if (i >= 0) this.despawnAt(i);
  }

  reset(): void {
    for (const o of this.activeObjects) this.pool.release(o);
    this.activeObjects.length = 0;
    this.timer = 0;
    this.started = false;
  }

  get activeCount(): number {
    return this.activeObjects.length;
  }

  get totalSpawned(): number {
    return this.totalSpawnedCount;
  }

  get totalDespawned(): number {
    return this.totalDespawnedCount;
  }

  /** Debug/test için: bir aktif objenin Y'si (yoksa null). */
  get sampleY(): number | null {
    return this.activeObjects.length ? this.activeObjects[0].y : null;
  }

  private spawnOne(): void {
    const element = ELEMENTS[Phaser.Math.Between(0, ELEMENTS.length - 1)];
    const defs = OBJECTS_BY_ELEMENT[element];
    const def = defs[Phaser.Math.Between(0, defs.length - 1)];

    const scale = def.size * Phaser.Math.FloatBetween(0.9, 1.15);
    const speed = Phaser.Math.Between(this.speedMin, this.speedMax);
    // Bir grinder lane'inin tam üstüne hizala → obje hep bir öğütücünün merkezine düşer.
    const x = this.lanes[Phaser.Math.Between(0, this.lanes.length - 1)];

    const o = this.pool.acquire();
    o.spawn(def, x, speed, scale);
    this.activeObjects.push(o);
    this.totalSpawnedCount++;
  }

  private despawnAt(index: number): void {
    const o = this.activeObjects[index];
    this.activeObjects.splice(index, 1);
    this.pool.release(o);
    this.totalDespawnedCount++;
  }
}
