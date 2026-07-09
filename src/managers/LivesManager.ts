import type { EventBus } from '../core/EventBus';

/**
 * Can yönetimi. wrong/missed → can –1, `life:changed` yayınlar.
 * 0'a düşünce yayınlanan `life:changed` GameScene tarafından GameOver'a çevrilir.
 */
export class LivesManager {
  private livesLeft: number;

  constructor(
    private readonly bus: EventBus,
    startingLives: number
  ) {
    this.livesLeft = startingLives;
    bus.on('match:wrong', this.onLoseLife);
    bus.on('object:missed', this.onLoseLife);
  }

  get remaining(): number {
    return this.livesLeft;
  }

  private readonly onLoseLife = (): void => {
    if (this.livesLeft <= 0) return;
    this.livesLeft--;
    this.bus.emit('life:changed', { lives: this.livesLeft });
  };
}
