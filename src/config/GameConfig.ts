import type { DifficultyConfig } from '../types/domain';

// Merkezi, veri-odaklı ayarlar. GDD'deki tüm sayısal değerler burada toplanır.
export const GameConfig = {
  designWidth: 720, // tasarım referans genişliği (px); tüm layout buna göre, Scale.FIT ölçekler
  designHeight: 1280, // tasarım referans yüksekliği (px), 9:16 portre
  startingLives: 3, // oyuncunun başlangıç canı; 0'a inince Game Over
  baseScorePerHit: 10, // bir doğru eşleşmenin taban puanı (combo çarpanı + perfect ile katlanır)
  comboThresholds: [
    // combo sayısı bu eşiğe ulaşınca skor çarpanı 'mult' olur (kademeli ödül)
    { combo: 5, mult: 2 }, // 5 comboda çarpan ×2
    { combo: 10, mult: 3 }, // 10 comboda ×3
    { combo: 20, mult: 5 }, // 20 comboda ×5
    { combo: 50, mult: 10 } // 50 comboda ×10
  ],
  // Başlangıç kontrol modu: 'lockedRow' = kilitli satır swipe · 'independent' = bağımsız slot drag + tap-swap.
  // (Oyuncu menüden seçecek — M6; şu an debug toggle ile değişiyor.)
  controlScheme: 'lockedRow' as 'lockedRow' | 'independent',
  debug: true, // debug katmanı (FPS/obje sayacı + çalışma anında mod değiştirme metni); yayında false yap

  // Ekran yerleşimi (tasarım px, 720×1280 referans). Öğütücü satırını yukarı çekmek
  // telefonda alt tarayıcı çubuğu/güvenli-alan altında kalmasını önler.
  layout: {
    grinderRowY: 1060, // öğütücü satırının Y merkezi — KÜÇÜLT = yukarı taşı (daha görünür), BÜYÜT = aşağı
    catchLineOffset: 50, // eşleşme, öğütücü merkezinin bu kadar üstünde tetiklenir (px)
    matchLineOffset: 80 // görsel eşleşme çizgisi, öğütücü merkezinin bu kadar üstünde (px)
  },

  // Skora bağlı ZORLUK / SEVİYE tablosu — TAMAMEN elle ayarlanır (formül yok).
  // Her satır bir kademe: oyuncunun skoru 'fromScore'a ulaşınca o satır devreye girer.
  // Satır ekle/çıkar, tüm sayıları özgürce değiştir. maxConcurrent'ı DÜŞÜK tut:
  //   1 = tek tek (en kolay) · 2 = orta · 3 çok zor (elle test ederek artır).
  // İlk satır fromScore:0 olmalı (başlangıç kademesi). Üst kademeye geçince kutlama oynar.
  difficulty: {
    celebrateOnLevelUp: true, // yeni kademeye çıkınca "WOW/SÜPER" kutlaması oynasın mı
    firstSpawnMs: 700, // oyun başında ilk objenin gelme gecikmesi (ms) — boş ekran hissini önler
    levels: [
      // fromScore: bu skordan itibaren geçerli | spawnIntervalMs: objeler arası süre ms (küçük=sık)
      // speedMin/Max: düşüş hız aralığı px/sn | maxConcurrent: aynı anda MAX obje | label: kutlamada görünen ad
      { fromScore: 0, spawnIntervalMs: 1575, speedMin: 300, speedMax: 320, maxConcurrent: 1, label: 'Isınma' },
      { fromScore: 250, spawnIntervalMs: 1650, speedMin: 320, speedMax: 355, maxConcurrent: 1, label: 'Kademe 1' },
      { fromScore: 500, spawnIntervalMs: 1500, speedMin: 355, speedMax: 400, maxConcurrent: 2, label: 'Kademe 2' },
      { fromScore: 800, spawnIntervalMs: 1350, speedMin: 400, speedMax: 450, maxConcurrent: 2, label: 'Kademe 3' },
      { fromScore: 1200, spawnIntervalMs: 1200, speedMin: 450, speedMax: 470, maxConcurrent: 2, label: 'Kademe 4' },
      { fromScore: 1500, spawnIntervalMs: 1000, speedMin: 450, speedMax: 470, maxConcurrent: 3, label: 'Kademe 5' }
    ]
  } satisfies DifficultyConfig
};

// Premium/dark tema paleti (GDD "Dark Mode by default").
export const Palette = {
  bgTop: 0x1a1f3d, // arka plan gradyanının üst rengi
  bgBottom: 0x0f1226, // arka plan gradyanının alt (koyu) rengi
  panel: 0x232a4d, // HUD / panel arka plan rengi
  fire: 0xff7043, // ateş elementi rengi (🔥 grinder + obje)
  water: 0x42a5f5, // su elementi rengi (💧)
  earth: 0x8bc34a, // toprak elementi rengi (🌱)
  air: 0xb0bec5, // hava elementi rengi (💨)
  accent: 0xffd166, // vurgu/altın rengi (combo, kutlama, çizgiler)
  heart: '#ff5a7a', // dolu can (kalp) rengi
  heartEmpty: '#3a4166', // boş can (kaybedilmiş kalp) rengi
  textLight: '#f5f7ff', // birincil açık metin rengi
  textDim: '#9aa3c7' // ikincil / soluk metin rengi
};
