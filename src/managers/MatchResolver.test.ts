import { describe, it, expect } from 'vitest';
import { resolveMatch } from './MatchResolver';

// Saf karar fonksiyonu — Phaser'sız, tek beceri kuralının kalbi (ARCHITECTURE §10).
describe('resolveMatch', () => {
  it('altında öğütücü yoksa missed', () => {
    expect(resolveMatch('fire', null)).toBe('missed');
    expect(resolveMatch('water', null)).toBe('missed');
  });

  it('element eşleşirse correct', () => {
    expect(resolveMatch('fire', 'fire')).toBe('correct');
    expect(resolveMatch('earth', 'earth')).toBe('correct');
  });

  it('element eşleşmezse wrong', () => {
    expect(resolveMatch('fire', 'water')).toBe('wrong');
    expect(resolveMatch('air', 'earth')).toBe('wrong');
  });
});
