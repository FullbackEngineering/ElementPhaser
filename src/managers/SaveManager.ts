interface SaveData {
  version: number;
  bestScore: number;
  bestCombo: number;
  muted: boolean;
  musicVolume: number; // 0..1
}

const STORAGE_KEY = 'element-grinder-save';
const DEFAULT_DATA: SaveData = { version: 1, bestScore: 0, bestCombo: 0, muted: false, musicVolume: 0.6 };

/**
 * Kalıcı kayıt (localStorage). App-seviyesi servis (registry). Sürümlü şema →
 * ileride güvenli migration. İleride CloudSave, aynı arayüzün ikinci implementasyonu.
 */
export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  get bestScore(): number {
    return this.data.bestScore;
  }

  get bestCombo(): number {
    return this.data.bestCombo;
  }

  get muted(): boolean {
    return this.data.muted;
  }

  get musicVolume(): number {
    return this.data.musicVolume;
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.persist();
  }

  setMusicVolume(volume: number): void {
    // 0..1 aralığına sıkıştır (UI hatalı değer gönderse bile güvenli).
    this.data.musicVolume = Math.min(1, Math.max(0, volume));
    this.persist();
  }

  submitRun(score: number, combo: number): void {
    this.data.bestScore = Math.max(this.data.bestScore, score);
    this.data.bestCombo = Math.max(this.data.bestCombo, combo);
    this.persist();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : { ...DEFAULT_DATA };
    } catch {
      return { ...DEFAULT_DATA };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage yoksa sessizce geç */
    }
  }
}
