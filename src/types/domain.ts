export type ElementType = 'fire' | 'water' | 'earth' | 'air';

export type PowerUpType =
  | 'magnet'
  | 'freeze'
  | 'slowmo'
  | 'doubleScore'
  | 'extraLife'
  | 'rainbow'
  | 'bomb';

export interface DifficultySnapshot {
  spawnIntervalMs: number;
  speedMin: number;
  speedMax: number;
  maxConcurrent: number;
}

/** Tek bir zorluk kademesi (seviye tablosu satırı) — tüm değerler config'ten elle atanır. */
export interface DifficultyLevel extends DifficultySnapshot {
  fromScore: number; // oyuncu bu skora ulaşınca bu kademe devreye girer
  label?: string; // kutlamada gösterilen kademe adı (opsiyonel)
}

/** Skora bağlı zorluk sistemi config sözleşmesi. */
export interface DifficultyConfig {
  celebrateOnLevelUp: boolean; // yeni kademeye geçince kutlama animasyonu oynasın mı
  firstSpawnMs: number; // oyun başında ilk objenin gelme gecikmesi (ms)
  levels: DifficultyLevel[]; // fromScore'a göre ARTAN sıralı kademeler; ilk satır fromScore:0
}

export interface RunState {
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  elapsedMs: number;
}
