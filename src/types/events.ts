import type { DifficultySnapshot, ElementType, PowerUpType } from './domain';

// Tipli event sözleşmesi. M1'de payload'lar domain tipleriyle sade tutuldu;
// FallingObject/Grinder sınıfları geldiğinde (M3/M4) obje referanslarıyla zenginleşecek.
export interface GameEvents {
  'match:correct': { element: ElementType; x: number; y: number; perfect: boolean };
  'match:wrong': { objectElement: ElementType; grinderElement: ElementType; x: number; y: number };
  'object:missed': { element: ElementType; x: number; y: number };
  'score:changed': { score: number; delta: number };
  'combo:changed': { combo: number; multiplier: number };
  'life:changed': { lives: number };
  'powerup:spawned': { type: PowerUpType };
  'powerup:activated': { type: PowerUpType; durationMs: number };
  'powerup:expired': { type: PowerUpType };
  'difficulty:tick': DifficultySnapshot;
  'difficulty:changed': DifficultySnapshot;
  'milestone:reached': { score: number; tier: number; label?: string };
  'game:over': { score: number; best: number; bestCombo: number };
  'game:paused': undefined;
  'game:resumed': undefined;
}
