# Element Grinder — Mimari Dokümanı

> **Durum:** Phase 2 (Mimari Tasarım) — kod yazımından önce onay içindir.
> **Teknoloji:** Phaser 3 · TypeScript (strict) · Vite · PWA · Mobile-first
> **Hedef:** 60 FPS, düşük donanımlı Android'de akıcı, ticari kalitede HTML5 oyunu.
> Bu doküman `GamePlanDoc/` altındaki iki tasarım dokümanının (GDD + Development Plan) teknik karşılığıdır.

---

## İçindekiler
1. [Tasarım İlkeleri](#1-tasarım-i̇lkeleri)
2. [Teknoloji Yığını ve Araçlar](#2-teknoloji-yığını-ve-araçlar)
3. [Klasör Yapısı](#3-klasör-yapısı)
4. [Sahne (Scene) Mimarisi](#4-sahne-scene-mimarisi)
5. [Manager Katmanı](#5-manager-katmanı)
6. [Event Sistemi (EventBus)](#6-event-sistemi-eventbus)
7. [Durum Yönetimi (State Machine)](#7-durum-yönetimi-state-machine)
8. [Config / Veri-Odaklı Tasarım](#8-config--veri-odaklı-tasarım)
9. [Kontrol Şeması — Strategy Deseni](#9-kontrol-şeması--strategy-deseni)
10. [Çarpışma / Eşleşme Çözümü](#10-çarpışma--eşleşme-çözümü)
11. [Object Pooling ve Performans](#11-object-pooling-ve-performans)
12. [Asset Pipeline](#12-asset-pipeline)
13. [Responsive Ölçekleme](#13-responsive-ölçekleme)
14. [Ses Mimarisi](#14-ses-mimarisi)
15. [Kayıt (Save) Sistemi](#15-kayıt-save-sistemi)
16. [Juice / Efekt Sistemi](#16-juice--efekt-sistemi)
17. [PWA](#17-pwa)
18. [Gelecek Özellikler İçin Uzatılabilirlik](#18-gelecek-özellikler-i̇çin-uzatılabilirlik)
19. [Test Stratejisi](#19-test-stratejisi)
20. [Milestone Yol Haritası](#20-milestone-yol-haritası)

---

## 1. Tasarım İlkeleri

Tüm mimari kararlar şu beş ilkeye dayanır:

1. **Event-driven (olay tabanlı) gevşek bağlılık.** Gameplay mantığı ("obje doğru öğütücüye girdi") ile sonuçları (skor, ses, parçacık, analytics) birbirini *bilmez*. Aralarında tek bir tipli `EventBus` vardır. Böylece ileride reklam/analytics/achievement eklerken gameplay koduna dokunmayız.
2. **Veri-odaklı (data-driven).** 100+ obje, zorluk eğrisi, combo eşikleri, power-up'lar — hepsi `config/` altında **veri** olarak durur, mantıkta gömülü değildir. Tasarımcı kod bilmeden dengeleme yapabilir.
3. **Sıfır çöp (GC) hedefi.** Sıcak döngüde (falling objects, particles, popups) `new` yok — her şey **object pool**'dan gelir. 60 FPS'in düşük donanımda korunmasının anahtarı budur.
4. **Test edilebilir saf mantık.** Skor, combo, zorluk, eşleşme kuralları Phaser'a bağımlı olmayan saf sınıflardır → Vitest ile birim test edilir. Phaser'a bağlı kısım sadece render/input'tur.
5. **Bağımsız test edilebilir milestone'lar.** Her milestone kendi başına çalışıp oynanabilir olmalı; "yarım özellik" merge edilmez.

---

## 2. Teknoloji Yığını ve Araçlar

| Katman | Seçim | Neden |
|---|---|---|
| Dil | **TypeScript** (`strict: true`) | Tip güvenliği, 100+ obje/config'te refactor güveni |
| Motor | **Phaser 3** (WebGL, Canvas fallback) | Olgun HTML5 oyun motoru, atlas/particle/tween built-in |
| Build | **Vite** | Anlık HMR, hızlı prod build, kolay PWA entegrasyonu |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest + service worker + offline cache otomasyonu |
| Test | **Vitest** | Saf mantık birim testleri (Vite ile aynı config) |
| Lint/Format | **ESLint + Prettier** | Tutarlı stil, "readable naming" ilkesi |

**Kritik karar — Arcade Physics (kısıtlı / hibrit kullanım).**
Objeler **Arcade dynamic body** olarak düşer (`body.velocity.y`, gerekirse `acceleration`).
Öğütücü ağzına ulaşma tespiti `this.physics.overlap(objectsGroup, grinderZone, cb)` ile yapılır.
Ama **oyun kuralı (correct/wrong/missed)** motordan bağımsız, saf bir `MatchResolver` fonksiyonundadır — overlap callback'i yalnızca "ulaştı" der, kararı saf fonksiyon verir. Böylece:
- GDD'nin "farklı hız + rastgele ivmelenme" isteği `velocity`/`acceleration` ile bedavaya gelir,
- power-up'lar temizlenir (Magnet = hedefe ivme, Freeze/SlowMotion = `physics.world.timeScale`, Bomb = grubu temizle),
- physics group `get()` ile **built-in recycling** sağlar (özel pool kodunu azaltır),
- kural saf fonksiyonda kaldığından **birim test edilebilirlik korunur**.

> Not: Bu game **object-to-object collision** gerektirmez (objeler birbirine çarpmaz); Arcade yalnızca *hareket + overlap tespiti* için kullanılır, separation/collider için değil. `main.ts`'e `physics: { default: 'arcade', arcade: { debug: false } }` M3'te eklenecek (M1'de düşen obje olmadığı için henüz yok).

---

## 3. Klasör Yapısı

```
ElementPhaser/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ ARCHITECTURE.md
├─ public/                      # kopyalanan statik varlıklar
│  ├─ manifest.webmanifest
│  └─ icons/                    # PWA ikonları
├─ assets/                      # kaynak varlıklar (atlas kaynakları, ses)
│  ├─ atlases/
│  ├─ audio/
│  └─ fonts/
└─ src/
   ├─ main.ts                   # Phaser.Game oluşturma noktası
   ├─ scenes/
   │  ├─ BootScene.ts           # config yükle, ölçekleme kur
   │  ├─ PreloadScene.ts        # atlas/audio yükle + progress bar
   │  ├─ MenuScene.ts           # ana menü
   │  ├─ GameScene.ts           # asıl oyun (grinder + falling objects)
   │  ├─ UIScene.ts             # HUD overlay (GameScene üstünde paralel)
   │  └─ GameOverScene.ts       # sonuç ekranı
   ├─ managers/
   │  ├─ GameManager.ts         # tur (run) orkestrasyonu + state machine
   │  ├─ SpawnManager.ts        # ne/ne zaman spawn edilir
   │  ├─ MatchResolver.ts       # obje ↔ öğütücü eşleşme kuralı
   │  ├─ ScoreManager.ts        # skor + combo + multiplier
   │  ├─ LivesManager.ts        # can yönetimi
   │  ├─ DifficultyManager.ts   # zaman içinde zorluk eğrisi
   │  ├─ PowerUpManager.ts      # aktif power-up'lar + süreleri
   │  ├─ AudioManager.ts        # sfx/müzik/mute (app seviyesi servis)
   │  └─ SaveManager.ts         # localStorage kalıcılık (app seviyesi)
   ├─ objects/
   │  ├─ Grinder.ts             # tek bir öğütücü/kase
   │  ├─ GrinderRow.ts          # 4 öğütücünün container'ı
   │  └─ FallingObject.ts       # havuzlanabilir düşen obje
   ├─ controls/
   │  ├─ GrinderControlStrategy.ts       # arayüz
   │  ├─ LockedRowSwipeStrategy.ts        # kilitli satır + swipe
   │  └─ IndependentDragStrategy.ts       # bağımsız sürükleme
   ├─ effects/
   │  ├─ EffectsManager.ts      # event'lere abone; juice tetikler
   │  ├─ ParticleFactory.ts     # element-özel parçacıklar
   │  └─ FloatingText.ts        # havuzlanmış skor/combo popup'ı
   ├─ ui/
   │  ├─ Hud.ts                 # skor/best/combo/can/pause
   │  └─ Button.ts              # yeniden kullanılabilir buton
   ├─ config/
   │  ├─ GameConfig.ts          # merkezi ayarlanabilir sabitler
   │  ├─ elements.ts            # 4 element tanımı (renk, ikon, ses)
   │  ├─ objectCatalog.ts       # 100+ obje → element eşlemesi
   │  ├─ difficultyCurve.ts     # zaman → zorluk parametreleri
   │  └─ powerups.ts            # power-up tanımları
   ├─ core/
   │  ├─ EventBus.ts            # tipli event emitter
   │  ├─ ObjectPool.ts          # generic havuz
   │  └─ StateMachine.ts        # basit FSM yardımcı
   ├─ types/
   │  ├─ events.ts              # GameEvents tip haritası
   │  ├─ domain.ts              # ElementType, PowerUpType, RunState...
   │  └─ index.ts
   └─ constants/
      ├─ assetKeys.ts           # atlas/ses anahtar sabitleri
      └─ sceneKeys.ts           # sahne anahtar sabitleri
```

**Neden bu ayrım?** Doküman "Scenes / Managers / Game Objects / Components / Audio / Animations / UI / Utilities / Config / Constants / Types" ayrımını istiyor. Yukarısı bunun birebir uygulamasıdır; ek olarak `controls/` (strategy deseni) ve `core/` (motor-bağımsız altyapı) eklendi.

---

## 4. Sahne (Scene) Mimarisi

```
BootScene → PreloadScene → MenuScene ⇄ GameScene (+ UIScene paralel) → GameOverScene → MenuScene
```

| Sahne | Sorumluluk |
|---|---|
| **BootScene** | Minimum ayar: Scale Manager modu, `SaveManager`/`AudioManager` gibi app servislerini başlat, PreloadScene'e geç. |
| **PreloadScene** | Atlas + audiosprite + font yükle; progress bar göster. Yükleme bittiğinde MenuScene. |
| **MenuScene** | Başlık, Play, ayarlar (mute), best score. |
| **GameScene** | Asıl oyun döngüsü: GrinderRow, FallingObject'ler, SpawnManager, MatchResolver, DifficultyManager. **Camera shake burada olur.** |
| **UIScene** | HUD (skor/best/combo/can/pause). GameScene'in **üstünde paralel** çalışır. |
| **GameOverScene** | Final skor, best, en yüksek combo, Play Again. |

**Kritik karar — HUD ayrı bir `UIScene`.**
Juice için GameScene kamerasını sarsıyoruz (screen shake). Eğer HUD aynı sahnedeyse skor/can da sarsılır ve okunmaz olur. HUD'u paralel bir `UIScene`'e alırsak gameplay sarsılırken HUD sabit ve net kalır. İki sahne yalnızca `EventBus` üzerinden konuşur (UIScene, GameScene'in iç objelerine erişmez).

---

## 5. Manager Katmanı

Manager'lar **düz TypeScript sınıflarıdır** (Phaser Scene değil). İki kategori:

- **App-seviyesi servisler** (uygulama boyu tek örnek): `SaveManager`, `AudioManager`. `main.ts`'te oluşturulur, sahneler arası yaşar.
- **Tur-seviyesi manager'lar** (her oyun turunda yeniden kurulur): `GameManager`, `SpawnManager`, `MatchResolver`, `ScoreManager`, `LivesManager`, `DifficultyManager`, `PowerUpManager`. `GameScene.create()` içinde `GameManager` tarafından kurulur, `EventBus`'a bağlanır.

Her manager'ın **açık bir sözleşmesi (interface)** olur ve dış dünyaya yalnızca event yayar / event dinler. Örnek sözleşmeler:

```ts
// ScoreManager — saf mantık, Phaser bağımsız → birim test edilebilir
class ScoreManager {
  get score(): number;
  get combo(): number;
  get multiplier(): number;       // combo eşiklerinden türetilir
  onCorrect(timingBonus: boolean): void;  // skor + combo artır, event yay
  onWrong(): void;                         // combo sıfırla, event yay
  onMissed(): void;                        // combo sıfırla, event yay
  reset(): void;
}

// DifficultyManager — geçen süreye göre spawn parametrelerini üretir
class DifficultyManager {
  update(elapsedMs: number): void;
  get snapshot(): DifficultySnapshot;   // { spawnIntervalMs, fallSpeed, maxConcurrent, rareChance }
}
```

**Manager'lar birbirini import etmez.** `MatchResolver` `match:correct` yayınlar; `ScoreManager`, `AudioManager`, `EffectsManager`, `LivesManager` bunu bağımsızca dinler. Bu, doküman "no duplicated logic / SOLID" isteğinin somut karşılığıdır.

---

## 6. Event Sistemi (EventBus)

**Motor-bağımsız, tipli** bir event emitter (core/ = engine-independent, §3). Yanlış event adı/payload compile-time'da yakalanır. Phaser'a bağlı olmadığından skor/combo/can gibi tüketiciler Phaser'sız node/jsdom'da birim test edilir (gerçek bus ile).

```ts
// types/events.ts
export interface GameEvents {
  'match:correct':    { object: FallingObject; grinder: Grinder; perfect: boolean };
  'match:wrong':      { object: FallingObject; grinder: Grinder };
  'object:missed':    { object: FallingObject };
  'score:changed':    { score: number; delta: number };
  'combo:changed':    { combo: number; multiplier: number };
  'life:changed':     { lives: number };
  'powerup:spawned':  { type: PowerUpType };
  'powerup:activated':{ type: PowerUpType; durationMs: number };
  'powerup:expired':  { type: PowerUpType };
  'difficulty:tick':  DifficultySnapshot;
  'game:over':        { score: number; best: number; bestCombo: number };
  'game:paused':      void;
  'game:resumed':     void;
}
```

**Event kataloğu — kim yayar / kim dinler:**

| Event | Yayan | Dinleyenler |
|---|---|---|
| `match:correct` | MatchResolver | Score, Lives(–), Audio, Effects, (ileride) Achievements, Analytics |
| `match:wrong` | MatchResolver | Score, Lives, Audio, Effects (shake) |
| `object:missed` | MatchResolver | Score, Lives, Audio |
| `score:changed` / `combo:changed` | ScoreManager | UIScene (HUD) |
| `life:changed` | LivesManager | UIScene, GameManager (0 ise game:over) |
| `game:over` | GameManager | SaveManager (best kaydet), GameOverScene, Audio |

Yeni bir tüketici (ör. `AnalyticsManager`) eklemek = yalnızca ilgili event'lere `on()` ile abone olmak. Gameplay kodu değişmez.

---

## 7. Durum Yönetimi (State Machine)

`GameManager` küçük bir FSM içerir:

```
BOOT → MENU → PLAYING ⇄ PAUSED
                 │
                 └──→ GAME_OVER → MENU
```

- `PLAYING`: update döngüsü aktif (spawn, düşme, çarpışma).
- `PAUSED`: tween/timer'lar duraklatılır, input pause dışında yok sayılır.
- `GAME_OVER`: `RunState` dondurulur, sonuç event'i yayılır.

**Tur verisi (`RunState`)** merkezi ve düz bir nesnedir: `{ score, combo, bestCombo, lives, elapsedMs, activePowerUps }`. Manager'lar bunu değiştirir, UIScene event üzerinden okur. Kalıcı ayarlar (`mute`, seçilen kontrol şeması, unlock'lar) ise `SaveManager` üzerinden `SettingsState`'te tutulur.

---

## 8. Config / Veri-Odaklı Tasarım

Denge ve içerik **koddan ayrıdır**. Örnekler:

```ts
// config/elements.ts
export const ELEMENTS = {
  fire:  { color: 0xff7043, particle: 'ember',  sfx: 'burn'  },
  water: { color: 0x42a5f5, particle: 'splash', sfx: 'splash'},
  earth: { color: 0x8bc34a, particle: 'dust',   sfx: 'crush' },
  air:   { color: 0xb0bec5, particle: 'gust',   sfx: 'whoosh'},
} as const;

// config/objectCatalog.ts — 100+ obje, sadece VERİ
export const OBJECT_CATALOG: ObjectDef[] = [
  { key: 'water_drop', element: 'water', size: 1.0, weight: 10 },
  { key: 'ice_cube',   element: 'water', size: 1.1, weight: 6  },
  { key: 'meteor',     element: 'fire',  size: 1.3, weight: 2  },
  // ...GDD'deki Water/Fire/Earth/Air listeleri buraya
];

// config/difficultyCurve.ts — zaman → parametre
export const DIFFICULTY_STEPS = [
  { atMs: 0,      spawnIntervalMs: 1400, fallSpeed: 180, maxConcurrent: 1, rareChance: 0.00 },
  { atMs: 20_000, spawnIntervalMs: 1100, fallSpeed: 220, maxConcurrent: 2, rareChance: 0.05 },
  { atMs: 45_000, spawnIntervalMs: 850,  fallSpeed: 270, maxConcurrent: 3, rareChance: 0.10 },
  // ...aralar interpolasyonla yumuşatılır
];

// config/GameConfig.ts — tek noktadan ayar
export const GameConfig = {
  designWidth: 720,
  designHeight: 1280,
  startingLives: 3,
  comboThresholds: [ {combo:5,mult:2}, {combo:10,mult:3}, {combo:20,mult:5}, {combo:50,mult:10} ],
  baseScorePerHit: 10,
  controlScheme: 'lockedRow' as 'lockedRow' | 'independent',  // ← M2'de prototip anahtarı
};
```

Bu sayede GDD'nin "combo 5→x2, 10→x3, 20→x5, 50→x10", "3 can", "+10 puan" gibi tüm değerleri **tek yerden** ayarlanır.

---

## 9. Kontrol Şeması — Strategy Deseni

> Kararınız (güncel): **her iki şema da kalıcı oyun modu olarak kalıyor** — oyunun iki farklı oynanış modu olacak (birini seçip diğerini atmıyoruz). Strategy deseni; `GameConfig.controlScheme` başlangıç değeri, oyuncu menüden seçer ve seçim `SaveManager` ile kalıcı olur.

```ts
// controls/GrinderControlStrategy.ts
export interface GrinderControlStrategy {
  attach(scene: GameScene, row: GrinderRow): void;  // input listener kur
  update(dt: number): void;                          // smoothing/lerp
  detach(): void;                                    // temizle
}
```

- **`LockedRowSwipeStrategy`** — 4 öğütücü tek satır; `pointermove`/swipe ile tüm satır yatayda lerp'lenerek kayar. Tek başparmak dostu; sabit aralık → doğal "öncelik seçme" zorluğu. (GDD'nin *tercih edilen* yöntemi.)
- **`IndependentDragStrategy`** — her öğütücü ayrı sürüklenir; daha çok kontrol, daha az gerilim.

`GameScene` doğru stratejiyi config/kayıttan seçip `attach()` eder — gameplay mantığının geri kalanı ikisinden de habersizdir. **İki mod da üründe kalır**; oyuncu menüden seçer (mode-select UI M6'da eklenir), seçim `SaveManager`'da saklanır. Şu an geçici debug toggle ile değiştiriliyor.

**İki mod (kalıcı):**
- **Kilitli Satır · Swipe** — 4 öğütücü tek parça, sürekli yatay kayar.
- **Bağımsız · Slot Drag** — 4 sabit slot; sürüklenen öğütücü en yakın slota oturur ve komşuyla yer değiştirir (canlı reorder).

---

## 10. Çarpışma / Eşleşme Çözümü

**Arcade overlap ile tespit + saf fonksiyon ile karar** (hibrit).

1. **Tespit (Arcade):** `this.physics.overlap(objectsGroup, grinderMouthZone, onReach)` — bir obje öğütücü ağzına (alt bölge) değdiğinde `onReach(object, zone)` tetiklenir. Çok sayıda eşzamanlı obje broadphase ile verimli işlenir.
2. **Karar (saf fonksiyon):** `onReach` içinde objenin X'i hangi öğütücünün X-aralığına düşüyor bulunur ve karar **motordan bağımsız** verilir:

```ts
type MatchOutcome = 'correct' | 'wrong' | 'missed';
// Phaser'sız, sadece veriyle → birim test edilebilir
function resolveMatch(objectEl: ElementType, grinderElUnderX: ElementType | null): MatchOutcome {
  if (grinderElUnderX === null) return 'missed';     // altında öğütücü yok
  return grinderElUnderX === objectEl ? 'correct' : 'wrong';
}
```

3. **Sonuç:** `correct` → `match:correct` (ezme animasyonu, obje group'a geri döner), `perfect` bayrağı merkeze yakınlıktan; `wrong` → `match:wrong` (can –1, combo reset); `missed` (dünya alt sınırını geçen obje) → `object:missed` (can –1).

Bu, GDD'deki belirsizliği kapatan **tek beceri kaynağı** kuralıdır: "doğru öğütücüyü doğru zamanda doğru yere koymak." Karar mantığı `MatchResolver` içinde izole ve Phaser'sız olduğundan birim testi kolaydır.

---

## 11. Object Pooling ve Performans

```ts
// core/ObjectPool.ts
class ObjectPool<T> {
  constructor(factory: () => T, reset: (t: T) => void, initialSize: number);
  acquire(): T;      // pool boşsa factory ile büyür
  release(t: T): void;
}
```

Havuzlanan her şey: **FallingObject**, **FloatingText** (skor/combo popup), **particle emitter**'lar. Sıcak döngüde `new` yok → GC spike yok.

**FallingObject** için Arcade **Physics Group** kullanılır: `group.get()` ölü bir body'yi geri döndürür (recycling built-in), `killAndHide()` ile havuza iade edilir. Böylece ayrı `ObjectPool` kodu yalnızca **non-fizik** nesneler (FloatingText, bazı efektler) için gerekir.

Ek performans kuralları (GDD "60 FPS / low-end Android"):
- Tek **texture atlas** → minimum draw call.
- `renderer: AUTO` (WebGL, gerekirse Canvas fallback), `roundPixels: true`, `powerPreference: 'high-performance'`.
- `update()` döngülerinde allocation ve gereksiz `forEach` closure'larından kaçın.
- Parçacık sayısı config ile sınırlanır; düşük donanımda otomatik kısılabilir (ileride "quality" ayarı).

---

## 12. Asset Pipeline

- **Görseller:** kaynaklar `assets/atlases/`; build'de tek/az sayıda atlas (TexturePacker veya benzeri) → `PreloadScene` yükler. Kod atlas'a **string sabitlerle** erişir (`constants/assetKeys.ts`), sihirli string yok.
- **Ses:** tek bir **audiosprite** (tüm sfx tek dosya + JSON marker) → daha az HTTP isteği, mobilde daha güvenilir. Müzik ayrı stream.
- **Font:** bitmap font veya web font; `assets/fonts/`.
- **Anahtar disiplini:** `assetKeys.ts` / `sceneKeys.ts` tüm anahtarları merkezileştirir → yeniden adlandırma güvenli.

---

## 13. Responsive Ölçekleme

- **Tasarım çözünürlüğü:** 720×1280 (9:16 portre) — tüm layout değerleri buna göre.
- **M1 için:** `Scale.FIT` + `autoCenter` → her ekranda tutarlı, letterbox'lı. En hızlı yol.
- **Cila aşamasında (M11) yükseltme yolu:** `Scale.RESIZE` + basit bir `LayoutManager` (HUD üste, grinder satırı alta anchor) → tablet 4:3'ten uzun 20:9 telefona kadar tam ekran, letterbox'sız. Layout değerleri baştan sahne boyutuna göreli yazıldığı için bu geçiş düşük maliyetlidir.
- **Safe-area:** CSS `env(safe-area-inset-*)` çentik/gesture bar için hesaba katılır.

---

## 14. Ses Mimarisi

`AudioManager` (app servisi) tüm sesi soyutlar; gameplay `EventBus` üzerinden dolaylı tetikler (`match:correct` → Audio dinler → `elements[el].sfx` çalar). GDD sesleri: su=splash, ateş=burn, toprak=crush, hava=whoosh, combo ödül sesi, game over impact, menü sesleri, ambient müzik. Özellikler: kanal başına ses, mute toggle (SaveManager'da kalıcı), mobil autoplay kısıtı için ilk kullanıcı etkileşiminde audio context unlock, (varsa) `navigator.vibrate` ile hafif titreşim.

---

## 15. Kayıt (Save) Sistemi

`SaveManager` (app servisi) `localStorage`'ı sürümlü bir şema ile sarar:

```ts
interface SaveData {
  version: number;          // migration için
  bestScore: number;
  bestCombo: number;
  settings: { muted: boolean; controlScheme: string };
  unlocks: string[];        // skin/tema (ileride)
}
```

Yalnızca `SaveManager` `localStorage`'a dokunur; `version` alanı ileride şema değişince güvenli migration sağlar. **Cloud save** ileride aynı arayüzün ikinci implementasyonu olarak eklenebilir (kod: `SaveProvider` arayüzü → Local / Cloud).

---

## 16. Juice / Efekt Sistemi

`EffectsManager` gameplay'i hiç bilmez; sadece event dinler ve GDD "JUICE" bölümünü uygular: camera shake (yanlış/miss), element-özel parçacık patlaması (`ParticleFactory`), floating score/combo popup (havuzlu), glow, squash & stretch tween, öğütücü dişli animasyonu, ezme animasyonu. İlke: **hiçbir etkileşim boş hissettirmez.** Efektler saf tüketici olduğundan performans için tek yerden kısılabilir.

---

## 17. PWA

- `vite-plugin-pwa` → `manifest.webmanifest` (isim, ikonlar, `display: standalone`, portre) + Workbox service worker.
- Atlas/ses/JS **precache** → ikinci açılışta ve offline'da çalışır.
- "Ana ekrana ekle" desteği; ikon setleri `public/icons/`.

---

## 18. Gelecek Özellikler İçin Uzatılabilirlik

GDD'nin gelecek listesi, mevcut dikişlere (seam) takılır — **büyük yeniden yazım gerektirmez**:

| Özellik | Nasıl eklenir |
|---|---|
| Leaderboard | `game:over` event'ini dinleyen yeni servis + API çağrısı |
| Cloud Save | `SaveProvider` arayüzünün ikinci implementasyonu |
| Rewarded Ads | `PowerUpManager` / `LivesManager`'ı tetikleyen `AdManager`, event üzerinden |
| Localization | `config/` metinleri + `i18n` anahtar sistemi (UI zaten sabitlerden okur) |
| Achievements / Daily | `match:*`, `game:over` event'lerini dinleyen bağımsız izleyici |
| Shop / Skins | `SaveData.unlocks` + `config`'te skin tanımları; render anahtarı config'ten |
| Analytics | Tüm `GameEvents`'e abone tek `AnalyticsManager` |

Ortak nokta: **event kataloğu + config + Save arayüzü** genişleme yüzeyidir; gameplay çekirdeği sabit kalır.

---

## 19. Test Stratejisi

- **Birim test (Vitest):** `ScoreManager`, `DifficultyManager`, `MatchResolver`, `ObjectPool` — hepsi Phaser'sız saf mantık. Ör: "20 combo → x5 multiplier", "yanlış eşleşme combo'yu sıfırlar", "hattı geçen obje yanlış öğütücü altındaysa `match:wrong`".
- **Manuel milestone checklist:** her milestone'un altında (bkz. §20) "his" ve entegrasyon kontrolleri.
- **Performans:** Chrome DevTools + `game.loop.actualFps` ile 60 FPS doğrulama; düşük donanım profili.

---

## 20. Milestone Yol Haritası

Her milestone **bağımsız test edilebilir**. Sıra, GDD Development Plan'daki 12 adımı takip eder.

| # | Milestone | Çıktı | Test checklist (özet) |
|---|---|---|---|
| **M1** | Proje kurulumu | Vite+TS+Phaser+PWA iskeleti, sahne zinciri, responsive Scale, boş GameScene | Boş sahne 60 FPS açılır; mobil/masaüstü ölçeklenir; PWA install edilebilir |
| **M2** | Öğütücü + kontrol | GrinderRow + **iki strateji** (swipe/drag), config anahtarı | İki şema da akıcı; tek başparmakla oynanır; A/B karşılaştırma |
| **M3** | Spawner + objeler | SpawnManager + havuzlu FallingObject, config'ten katalog | Objeler rastgele X'ten, farklı hız/boyutta düşer; GC spike yok |
| **M4** | Eşleşme | MatchResolver hat-tabanlı kural + event'ler | correct/wrong/missed doğru tetiklenir (birim test yeşil) |
| **M5** | Skor + can | Score/Combo/Lives/GameOver akışı | Combo eşikleri doğru; 0 can → GameOver; best kaydedilir |
| **M6** | UI/HUD | UIScene HUD + Menu + GameOver ekranı | HUD event'lerle güncellenir; shake HUD'u etkilemez |
| **M7** | Juice | Particle/shake/popup/squash | Her aksiyon tatmin edici; boş etkileşim yok |
| **M8** | Ses | AudioManager + audiosprite + mute | Element sesleri, combo/gameover sesi, mute kalıcı |
| **M9** | Power-up'lar | PowerUpManager + GDD'deki 7 power-up | Magnet/Freeze/Slow/DoubleScore/ExtraLife/Rainbow/Bomb çalışır |
| **M10** | Zorluk ayarı | difficultyCurve dengeleme | "Adil ama giderek kaotik" his; playtest |
| **M11** | Optimizasyon | Pooling denetimi, RESIZE layout, 60 FPS low-end | Düşük donanımda 60 FPS; memory leak yok |
| **M12** | Release | PWA cila, ikonlar, meta, build | Prod build; offline çalışır; store/Poki'ye hazır |

**Çalışma kuralı (GDD gereği):** Her milestone için önce *amaç → tasarım kararı → dosya listesi → kod → test → gözden geçirme → iyileştirme önerisi* sunulur; mevcut milestone stabilleşmeden bir sonrakine geçilmez.
