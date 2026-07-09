import type { EventBus } from '../core/EventBus';
import type { DifficultyConfig, DifficultyLevel, DifficultySnapshot } from '../types/domain';
import { GameConfig } from '../config/GameConfig';

/**
 * SAF: skora göre seviye tablosundan aktif kademeyi seçer → Phaser'sız birim test edilebilir.
 * `levels` fromScore'a göre ARTAN sıralı olmalı; en yüksek `fromScore <= score` kademe kazanır.
 */
export function levelForScore(
  score: number,
  levels: DifficultyLevel[]
): { index: number; level: DifficultyLevel } {
  let index = 0;
  for (let i = 0; i < levels.length; i++) {
    if (score >= levels[i].fromScore) index = i;
    else break;
  }
  return { index, level: levels[index] };
}

function snapshotOf(l: DifficultyLevel): DifficultySnapshot {
  return {
    spawnIntervalMs: l.spawnIntervalMs,
    speedMin: l.speedMin,
    speedMax: l.speedMax,
    maxConcurrent: l.maxConcurrent
  };
}

/**
 * Skoru dinler; kademe değişince `difficulty:changed` yayar, ÜST kademeye çıkınca
 * (config'te açıksa) `milestone:reached` ile kutlama tetikler. Değerler tamamen
 * `GameConfig.difficulty.levels` tablosundan gelir — mantıkta gömülü sayı yok.
 */
export class DifficultyManager {
  private readonly cfg: DifficultyConfig;
  private current: DifficultySnapshot;
  private currentIndex: number;

  constructor(
    private readonly bus: EventBus,
    cfg: DifficultyConfig = GameConfig.difficulty
  ) {
    this.cfg = cfg;
    const start = levelForScore(0, cfg.levels);
    this.currentIndex = start.index;
    this.current = snapshotOf(start.level);
    bus.on('score:changed', this.onScore);
  }

  get snapshot(): DifficultySnapshot {
    return this.current;
  }

  get levelIndex(): number {
    return this.currentIndex;
  }

  private readonly onScore = (p: { score: number }): void => {
    const { index, level } = levelForScore(p.score, this.cfg.levels);
    if (index === this.currentIndex) return;

    const leveledUp = index > this.currentIndex;
    this.currentIndex = index;
    this.current = snapshotOf(level);
    this.bus.emit('difficulty:changed', this.current);

    if (leveledUp && this.cfg.celebrateOnLevelUp) {
      this.bus.emit('milestone:reached', { score: level.fromScore, tier: index, label: level.label });
    }
  };
}
