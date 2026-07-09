import Phaser from 'phaser';
import { Audio } from '../constants/assetKeys';
import type { SaveManager } from './SaveManager';

/**
 * App-seviyesi ses servisi (registry'de yaşar, sahne değişiminde müzik kesilmez).
 * Phaser'ın GLOBAL `game.sound` yöneticisi tek olduğundan, menüde başlatılan döngü
 * müziği Game/GameOver boyunca çalmaya devam eder. Ses/mute değeri SaveManager'da
 * kalıcıdır → sonraki açılışta korunur.
 *
 * Basitlik: tek müzik olduğu için ses seviyesi/mute doğrudan MASTER (`game.sound`)
 * üzerinden uygulanır (renderer'dan bağımsız, garantili). SFX (M8) gelince müzik/sfx
 * ayrı bus'lara ayrılır.
 */
export class AudioManager {
  private music?: Phaser.Sound.BaseSound;

  constructor(
    private readonly game: Phaser.Game,
    private readonly save: SaveManager
  ) {}

  get musicVolume(): number {
    return this.save.musicVolume;
  }

  get muted(): boolean {
    return this.save.muted;
  }

  /**
   * Döngü müziğini başlatır (idempotent — zaten çalıyorsa tekrar başlatmaz, bu yüzden
   * menüye her dönüşte yeniden tetiklenmesi sorun değil). Tarayıcı autoplay kilidi
   * varsa Phaser ilk kullanıcı dokunuşunda otomatik açar ve müziği o an başlatır.
   */
  startMusic(): void {
    if (this.music) return;
    if (!this.game.cache.audio.exists(Audio.musicMain)) return; // asset yüklenmediyse sessizce geç
    this.apply();
    this.music = this.game.sound.add(Audio.musicMain, { loop: true, volume: 1 });
    this.music.play();
  }

  setMusicVolume(volume: number): void {
    this.save.setMusicVolume(volume);
    this.apply();
  }

  /** Mute'u ters çevirir ve yeni durumu döndürür. */
  toggleMuted(): boolean {
    this.save.setMuted(!this.save.muted);
    this.apply();
    return this.save.muted;
  }

  /** SaveManager'daki ses/mute'u master çıkışa uygular. */
  private apply(): void {
    this.game.sound.mute = this.save.muted;
    this.game.sound.volume = this.save.musicVolume;
  }
}
