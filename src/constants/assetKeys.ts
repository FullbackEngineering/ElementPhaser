// Tüm texture/atlas anahtarları burada merkezileşir (sihirli string yok).
// Frame adları `public/sprites/` dosya adlarıyla birebir eşleşir.
// Obje frame anahtarları objectCatalog'dan türetilir (ör. 'obj_water_drop').

import type { ElementType } from '../types';

/** Paketlenmiş atlas anahtarı (M11). M2/M3'te tekil PNG'ler de yüklenebilir. */
export const Atlas = {
  Main: 'atlas_main'
} as const;

/** Obje frame anahtarı = dosya adı. Texture yoksa çağıran placeholder'a düşer. */
export const objTex = (element: ElementType, key: string): string => `obj_${element}_${key}`;

export const Tex = {
  grinder: {
    fire: 'grinder_fire',
    water: 'grinder_water',
    earth: 'grinder_earth',
    air: 'grinder_air'
  },
  ui: {
    heartFull: 'ui_heart_full',
    heartEmpty: 'ui_heart_empty',
    pause: 'ui_pause'
  },
  powerup: {
    magnet: 'pu_magnet',
    doubleScore: 'pu_double_score',
    freezeFrame: 'fx_freeze_frame'
  },
  fx: {
    ember: 'fx_ember',
    smoke: 'fx_smoke',
    splash: 'fx_splash',
    splat: 'fx_splat'
  }
} as const;

/**
 * PreloadScene'in yükleyeceği tekil obje sprite frame'leri (= `public/sprites/<ad>.png`).
 * Sadece GERÇEKTEN üretilmiş obje dosyaları burada. Eksik olanlar (earth/air objeleri,
 * fire meteor) listede yok → FallingObject placeholder'da (disk + emoji) kalır.
 * Not: grinder'lar bilinçli olarak placeholder'da; burada grinder frame'i yok.
 */
export const OBJECT_SPRITES: readonly string[] = [
  objTex('fire', 'flame'),
  objTex('fire', 'volcano'),
  objTex('fire', 'log'),
  objTex('water', 'drop'),
  objTex('water', 'ice'),
  objTex('water', 'snow'),
  objTex('water', 'fish'),
  objTex('water', 'bubble'),
  objTex('air', 'tornado')
];
