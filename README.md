# Element Grinder

Phaser 3 · TypeScript · Vite · PWA ile geliştirilen mobile-first hypercasual refleks oyunu.

Mimari ve yol haritası için → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Kurulum

```bash
npm install
npm run gen:icons   # PWA placeholder ikonlarını üret (bir kez)
npm run dev         # http://localhost:5173
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (HMR) |
| `npm run build` | Tip kontrolü + prod build (`dist/`) |
| `npm run preview` | Prod build önizleme (PWA/SW test) |
| `npm run typecheck` | Sadece TypeScript tip kontrolü |
| `npm run smoke` | Headless runtime smoke-test (önce `npm run dev` açık olmalı) |

## Durum

**M1 — Proje kurulumu** ✅ Vite+TS+Phaser+PWA iskeleti, sahne zinciri
(Boot→Preload→Menu→Game+UI→GameOver), responsive Scale, tipli EventBus.

**M2 — Öğütücü satırı + kontrol** ✅ `GrinderRow` + iki kontrol stratejisi
(kilitli-satır swipe / bağımsız **slot-drag** reorder), çalışma anında değiştirilebilir.

**M3 — Spawner + düşen objeler** ✅ `SpawnManager` + `FallingObject` (Arcade Physics
velocity) + `ObjectPool` (GC yok). Rastgele element/X/hız/boyut; dibi geçince havuza
döner. Smoke-test: doğuyor + düşüyor + recycle, 60 FPS.

Sıradaki: **M4 — Eşleşme (MatchResolver): obje öğütücü ağzına ulaşınca correct/wrong/missed.**
