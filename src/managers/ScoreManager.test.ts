import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../core/EventBus';
import { ScoreManager } from './ScoreManager';

// GDD: base=10, combo eşikleri 5→x2, 10→x3, 20→x5, 50→x10; perfect skoru 2 katlar.
function correct(bus: EventBus, perfect = false): void {
  bus.emit('match:correct', { element: 'fire', x: 0, y: 0, perfect });
}

describe('ScoreManager', () => {
  let bus: EventBus;
  let score: ScoreManager;

  beforeEach(() => {
    bus = new EventBus();
    score = new ScoreManager(bus);
  });

  it('tek doğru: combo 1, çarpan 1, +10', () => {
    correct(bus);
    expect(score.combo).toBe(1);
    expect(score.score).toBe(10);
  });

  it('perfect skoru 2 katlar', () => {
    correct(bus, true);
    expect(score.score).toBe(20);
  });

  it('5. doğruda çarpan x2 devreye girer (toplam 60)', () => {
    for (let i = 0; i < 5; i++) correct(bus);
    // 4×(10×1) + 1×(10×2) = 60
    expect(score.combo).toBe(5);
    expect(score.score).toBe(60);
  });

  it('10. doğruda çarpan x3 (toplam 170)', () => {
    for (let i = 0; i < 10; i++) correct(bus);
    expect(score.combo).toBe(10);
    expect(score.score).toBe(170);
  });

  it('wrong combo\'yu sıfırlar, skoru korur', () => {
    correct(bus);
    correct(bus);
    bus.emit('match:wrong', { objectElement: 'fire', grinderElement: 'water', x: 0, y: 0 });
    expect(score.combo).toBe(0);
    expect(score.score).toBe(20);
  });

  it('missed combo\'yu sıfırlar', () => {
    correct(bus);
    bus.emit('object:missed', { element: 'fire', x: 0, y: 0 });
    expect(score.combo).toBe(0);
  });

  it('bestCombo en yüksek zinciri hatırlar', () => {
    for (let i = 0; i < 7; i++) correct(bus);
    bus.emit('object:missed', { element: 'fire', x: 0, y: 0 });
    correct(bus);
    expect(score.combo).toBe(1);
    expect(score.bestCombo).toBe(7);
  });

  it('combo:changed çarpanı doğru yayınlar', () => {
    let lastMult = 0;
    bus.on('combo:changed', (p) => (lastMult = p.multiplier));
    for (let i = 0; i < 20; i++) correct(bus);
    expect(lastMult).toBe(5);
  });
});
