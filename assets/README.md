# Assets — Element Grinder

Kaynak sanat varlıkları. Kod bunlara `src/constants/assetKeys.ts` üzerinden erişir.

## Klasör düzeni

```
assets/
├─ sprites/        # tekil şeffaf PNG'ler (öğe başına 1 dosya)
├─ atlases/        # paketlenmiş atlas + json (M11'de üretilir)
├─ audio/          # sfx audiosprite + müzik (M8)
└─ fonts/
```

## İsimlendirme kuralı (frame = dosya adı, uzantısız)

| Tür | Şablon | Örnek |
|---|---|---|
| Öğütücü | `grinder_<element>` | `grinder_fire`, `grinder_water`, `grinder_earth`, `grinder_air` |
| Obje | `obj_<element>_<isim>` | `obj_water_drop`, `obj_fire_lava`, `obj_earth_leaf` |
| UI | `ui_<isim>` | `ui_heart_full`, `ui_heart_empty`, `ui_pause` |
| Power-up | `pu_<isim>` | `pu_magnet`, `pu_double_score` |
| Efekt | `fx_<isim>` | `fx_ember`, `fx_smoke`, `fx_splash`, `fx_splat`, `fx_freeze_frame` |

## Üretim durumu (checklist)

- [x] Grinder × 4 (fire/water/earth/air) — her iki sheet'in alt sırasında
- [x] Fire objeleri (alev S/M/L, kütük, lav, kristal)
- [x] Water objeleri (damla S/M/L, buz, kar tanesi, balık, kabarcık, taş, kabuk, şişe)
- [x] UI (kalp dolu/boş, pause, +10, combo, 2x)
- [x] Power-up: magnet, double-score(2x), freeze çerçevesi
- [x] FX: ember, smoke, splash, splat
- [ ] **Earth objeleri** (yaprak, ağaç, taş, tohum, elma, mantar…) — aynı stilde üretilecek
- [ ] **Air objeleri** (tüy, balon, kuş, kelebek, kağıt uçak, uçurtma…) — aynı stilde üretilecek
- [ ] Ses (M8)

## Slicing / atlas

Birleşik sheet'ler `assets/sprites/` içine öğe başına tek şeffaf PNG olarak kesilir.
M11'de tek atlas'a paketlenir (TexturePacker → Phaser 3 export, veya `free-tex-packer`).
Prototip aşamasında (M2/M3) tekil PNG'ler doğrudan yüklenebilir; atlas optimizasyonu sona bırakılır.
