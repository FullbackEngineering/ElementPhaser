import { describe, it, expect, vi } from 'vitest';
import { levelForScore, DifficultyManager } from './DifficultyManager';
import { EventBus } from '../core/EventBus';
import type { DifficultyConfig, DifficultyLevel } from '../types/domain';

// Elle ayarlanan seviye tablosu — "oyun çok zor" geri bildirimi + gelecekteki seviye sistemi.
const LEVELS: DifficultyLevel[] = [
  { fromScore: 0, spawnIntervalMs: 1800, speedMin: 160, speedMax: 200, maxConcurrent: 1, label: 'Isınma' },
  { fromScore: 250, spawnIntervalMs: 1650, speedMin: 185, speedMax: 225, maxConcurrent: 1, label: 'Kademe 1' },
  { fromScore: 500, spawnIntervalMs: 1500, speedMin: 210, speedMax: 255, maxConcurrent: 2, label: 'Kademe 2' }
];
const cfg: DifficultyConfig = { celebrateOnLevelUp: true, firstSpawnMs: 700, levels: LEVELS };

describe('levelForScore', () => {
  it('skora göre doğru kademeyi seçer (en yüksek fromScore <= score)', () => {
    expect(levelForScore(0, LEVELS).index).toBe(0);
    expect(levelForScore(249, LEVELS).index).toBe(0);
    expect(levelForScore(250, LEVELS).index).toBe(1);
    expect(levelForScore(499, LEVELS).index).toBe(1);
    expect(levelForScore(500, LEVELS).index).toBe(2);
    expect(levelForScore(99999, LEVELS).index).toBe(2); // son kademe tavan
  });

  it('kademe değerlerini verir', () => {
    expect(levelForScore(250, LEVELS).level.spawnIntervalMs).toBe(1650);
    expect(levelForScore(500, LEVELS).level.maxConcurrent).toBe(2);
  });
});

describe('DifficultyManager (event akışı)', () => {
  it('başlangıçta level 0 snapshot verir, kutlama yok', () => {
    const bus = new EventBus();
    const mile = vi.fn();
    bus.on('milestone:reached', mile);
    const dm = new DifficultyManager(bus, cfg);
    expect(dm.snapshot.spawnIntervalMs).toBe(1800);
    expect(dm.snapshot.maxConcurrent).toBe(1);
    expect(dm.levelIndex).toBe(0);
    expect(mile).not.toHaveBeenCalled();
  });

  it('kademe atlayınca difficulty:changed + milestone:reached (label ile) yayar', () => {
    const bus = new EventBus();
    const diff = vi.fn();
    const mile = vi.fn();
    bus.on('difficulty:changed', diff);
    bus.on('milestone:reached', mile);
    new DifficultyManager(bus, cfg);

    bus.emit('score:changed', { score: 240, delta: 10 });
    expect(diff).not.toHaveBeenCalled();

    bus.emit('score:changed', { score: 250, delta: 10 });
    expect(diff).toHaveBeenCalledTimes(1);
    expect(diff.mock.calls[0][0].maxConcurrent).toBe(1);
    expect(mile).toHaveBeenCalledWith({ score: 250, tier: 1, label: 'Kademe 1' });
  });

  it('aynı kademede kalınca tekrar yaymaz', () => {
    const bus = new EventBus();
    const diff = vi.fn();
    bus.on('difficulty:changed', diff);
    new DifficultyManager(bus, cfg);
    bus.emit('score:changed', { score: 250, delta: 10 });
    bus.emit('score:changed', { score: 300, delta: 10 });
    expect(diff).toHaveBeenCalledTimes(1);
  });

  it('celebrateOnLevelUp false ise milestone yaymaz ama zorluk yine değişir', () => {
    const bus = new EventBus();
    const mile = vi.fn();
    const diff = vi.fn();
    bus.on('milestone:reached', mile);
    bus.on('difficulty:changed', diff);
    new DifficultyManager(bus, { ...cfg, celebrateOnLevelUp: false });
    bus.emit('score:changed', { score: 500, delta: 10 });
    expect(diff).toHaveBeenCalledTimes(1);
    expect(mile).not.toHaveBeenCalled();
  });
});
