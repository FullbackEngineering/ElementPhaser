import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../core/EventBus';
import { LivesManager } from './LivesManager';

function wrong(bus: EventBus): void {
  bus.emit('match:wrong', { objectElement: 'fire', grinderElement: 'water', x: 0, y: 0 });
}
function missed(bus: EventBus): void {
  bus.emit('object:missed', { element: 'fire', x: 0, y: 0 });
}

describe('LivesManager', () => {
  let bus: EventBus;
  let lives: LivesManager;

  beforeEach(() => {
    bus = new EventBus();
    lives = new LivesManager(bus, 3);
  });

  it('wrong ve missed can eksiltir', () => {
    wrong(bus);
    missed(bus);
    expect(lives.remaining).toBe(1);
  });

  it('0\'ın altına inmez', () => {
    for (let i = 0; i < 5; i++) wrong(bus);
    expect(lives.remaining).toBe(0);
  });

  it('0 canda artık life:changed yayınlamaz', () => {
    let emits = 0;
    bus.on('life:changed', () => emits++);
    for (let i = 0; i < 5; i++) wrong(bus);
    expect(emits).toBe(3); // yalnızca 3→2→1→0 geçişleri
  });
});
