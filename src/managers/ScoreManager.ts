import type { EventBus } from '../core/EventBus';
import { GameConfig } from '../config/GameConfig';

/**
 * Skor + combo. EventBus'tan beslenir (Phaser bağımsız → birim test edilebilir).
 * correct: combo++ ve skor += base × çarpan × (perfect ? 2 : 1).
 * wrong/missed: combo sıfırlanır.
 */
export class ScoreManager {
  private currentScore = 0;
  private currentCombo = 0;
  private bestComboReached = 0;

  constructor(private readonly bus: EventBus) {
    bus.on('match:correct', this.onCorrect);
    bus.on('match:wrong', this.onBreak);
    bus.on('object:missed', this.onBreak);
  }

  get score(): number {
    return this.currentScore;
  }

  get combo(): number {
    return this.currentCombo;
  }

  get bestCombo(): number {
    return this.bestComboReached;
  }

  private multiplierFor(combo: number): number {
    let mult = 1;
    for (const t of GameConfig.comboThresholds) {
      if (combo >= t.combo) mult = t.mult;
    }
    return mult;
  }

  private readonly onCorrect = (p: { perfect: boolean }): void => {
    this.currentCombo++;
    this.bestComboReached = Math.max(this.bestComboReached, this.currentCombo);
    const mult = this.multiplierFor(this.currentCombo);
    const delta = GameConfig.baseScorePerHit * mult * (p.perfect ? 2 : 1);
    this.currentScore += delta;
    this.bus.emit('score:changed', { score: this.currentScore, delta });
    this.bus.emit('combo:changed', { combo: this.currentCombo, multiplier: mult });
  };

  private readonly onBreak = (): void => {
    if (this.currentCombo === 0) return;
    this.currentCombo = 0;
    this.bus.emit('combo:changed', { combo: 0, multiplier: 1 });
  };
}
