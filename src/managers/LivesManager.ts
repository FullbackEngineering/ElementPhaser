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

  /** Revive: can ekler ve `life:changed` yayınlar (HUD kalpleri geri dolar). */
  grant(amount = 1): void {
    this.livesLeft += amount;
    this.bus.emit('life:changed', { lives: this.livesLeft });
  }

  private readonly onLoseLife = (): void => {
    if (this.livesLeft <= 0) return;
    this.livesLeft--;
    this.bus.emit('life:changed', { lives: this.livesLeft });
  };
}
