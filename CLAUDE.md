# CLAUDE.md — Element Grinder

Claude Code için proje rehberi. **Detaylı mimari:** `ARCHITECTURE.md`. **Kaynak tasarım:** `GamePlanDoc/` (GDD + Development Plan + görsel/video).

## Proje
Mobile-first HTML5 **hypercasual refleks** oyunu. Düşen elementleri (🔥 ateş / 💧 su / 🌱 toprak / 💨 hava) doğru öğütücüye denk getir → skor + combo; yanlış/kaçan → can kaybı; 3 can bitince Game Over.
**Stack:** Phaser 3 · TypeScript (strict) · Vite · PWA · 60 FPS · düşük donanım Android.

## Komutlar
| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (HMR) → http://localhost:5173 |
| `npm run build` | typecheck + prod build (`dist/`) |
| `npm run typecheck` | Sadece TS tip kontrolü |
| `npm run gen:icons` | PWA placeholder ikonları |
| `npm run smoke` | Headless runtime smoke-test (önce `npm run dev` açık olmalı) |

## İş akışı (ZORUNLU)
- **Milestone-by-milestone.** Aynı anda birden fazla milestone yazma; mevcut stabilleşmeden ilerleme.
- Her milestone: **amaç → tasarım kararı → dosya listesi → kod → test → gözden geçirme → iyileştirme.**
- Her anlamlı değişiklikten sonra **doğrula:** `npm run typecheck` + `npm run build` + runtime için `npm run smoke`.
- GDD felsefesi: her karar "oyunu daha eğlenceli/tatmin edici/tekrar oynanabilir yapar mı?" sorusuna cevap vermeli. Değilse daha iyi çözüm öner.

## Mimari (özet — detay `ARCHITECTURE.md`)
- **Sahneler:** Boot → Preload → Menu → **Game (+ paralel UIScene)** → GameOver. HUD ayrı `UIScene`'de (camera shake HUD'u sarsmasın).
- **İletişim:** tipli `EventBus` (`core/`). Gameplay ↔ sonuç (skor/ses/parçacık/analytics) gevşek bağlı → yeni tüketici = yeni dinleyici.
- **Veri-odaklı:** tüm sayılar/içerik `config/`'te (`GameConfig`, `objectCatalog`, `difficultyCurve`, `powerups`). Mantıkta gömülü değer yok.
- **Havuzlama:** `core/ObjectPool`; `FallingObject` Arcade body ile. Sıcak döngüde `new` yok.
- **Kontrol:** Strategy deseni (`controls/`), **iki kalıcı mod**.
- **Fizik:** Arcade (hareket + overlap tespiti); kural **saf `MatchResolver` fonksiyonu** (Phaser'sız, test edilebilir). Object-to-object collision YOK.

## Kod standartları (skill: clean-code)
- TS **strict**; SRP / DRY / KISS / YAGNI. Anlamlı isim (`isActive`, `getGrinderUnderX`).
- Yorum sadece **"neden"** için; adı açıklamak için yorum gerekiyorsa adı düzelt.
- Sihirli string yok → `constants/` (`sceneKeys`, `assetKeys`). Renk/ayar tek kaynak: `Palette`/`GameConfig`.
- Küçük dosya, tek sorumluluk.

## Sabit kararlar (yalnızca kullanıcı onayıyla değiştir)
- **İki kontrol modu KALICI:** `Kilitli Satır · Swipe` + `Bağımsız · Slot-Drag` (sabit 4 slot, sürükleyince en yakın slota oturur + komşuyla reorder). Oyuncu menüden seçecek (M6), seçim `SaveManager`'da saklanacak.
- **Arcade hibrit** (fizik hareket + saf karar).
- Tasarım çözünürlüğü **720×1280**, `Scale.FIT`, dark tema (`Palette`).

## Test / doğrulama
- `scripts/smoke.mjs` (Playwright) tüm akışı + iki kontrol modu + spawn/recycle'ı gerçek pointer'la sürer.
- Headless Chromium WebGL framebuffer'ı desteklemez → **`?canvas`** ile Canvas renderer'a düşülür (sadece test; normalde WebGL). Debug'ta `window.__game` açık.

## Durum / Roadmap
✅ **M1** kurulum · ✅ **M2** grinder + 2 kontrol modu · ✅ **M3** spawner + düşen objeler · ✅ **M4** eşleşme (MatchResolver, saf karar + Vitest) · ✅ **M5** skor/combo/can/GameOver (HUD bağlı, 21 birim test yeşil)
⏭️ **M6** UI/HUD cila + mode-select menü (seçim SaveManager'da) → **M7** juice → **M8** ses → **M9** power-up → **M10** zorluk → **M11** optimizasyon → **M12** release.

## Sanat / asset
Şu an **placeholder** (obje = renkli disk + emoji; grinder = şekil + emoji). Kullanıcı Gemini/Nano-Banana ile şeffaf sheet'ler üretiyor: **fire + water + 4 grinder + UI/power-up hazır; EARTH + AIR obje setleri EKSİK.** Kesim → `assets/sprites/` (isimlendirme: `assets/README.md`); `sharp` kurulu. Placeholder → gerçek sanat geçişi API'yi bozmadan yapılmalı.

## Araçlar (`.claude/`) — ne zaman kullan
Kullanıcı bu agent/skill/komutları kurdu; ilgili işte **kullan**:
- **agent `game-designer`** → mekanik/denge/zorluk eğrisi/oyuncu psikolojisi kararları (M4, M9, M10).
- **agent `game-developer` / `typescript-pro` / `javascript-pro`** → implementasyon, refactor, tip mimarisi.
- **agent `3d-artist`** → görsel yön / asset stil kararları.
- **agent `postgres-pro`** → (ileride) leaderboard/cloud-save backend.
- **skill `clean-code`** → her kod yazımında (zorunlu standart).
- **skill `mobile-design`** → UI/HUD/menü (M6), dokunma hedefleri, tipografi, touch psikolojisi.
- **skill `senior-architect` / `senior-fullstack`** → büyük yapısal kararlar.
- **skill `brainstorming`** → yeni özellik/mekanik keşfi.
- **command `game-asset-pipeline`** → asset kesim/atlas (sanat gelince, M11).
- **command `game-performance-profiler`** → 60 FPS/optimizasyon (M11).
- **command `game-testing-framework`** → test altyapısını genişletme.
- **command `game-analytics-integration`** → analytics (ileride).

> Not: `.claude/`'a yeni eklenen agent/skill'ler Claude Code'un bir sonraki yüklemesinde invoke edilebilir hale gelir; o ana kadar tanımları okunup prensipleri uygulanır.

## Dil
Kullanıcı **Türkçe** iletişim kuruyor → yanıtlar Türkçe; kod, dosya adı, tanımlayıcı ve teknik terimler İngilizce.
