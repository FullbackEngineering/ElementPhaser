import type { ElementType } from '../types';

export interface ObjectDef {
  key: string;
  element: ElementType;
  emoji: string; // placeholder görsel; gerçek sanat gelince atlas frame'i ile değişir
  size: number; // temel ölçek çarpanı
}

// GDD obje listelerinin bir alt kümesi (placeholder emojilerle).
// Gerçek sanat geldikçe genişler; mantık burayı VERİ olarak okur.
export const OBJECTS_BY_ELEMENT: Record<ElementType, ObjectDef[]> = {
  fire: [
    { key: 'flame', element: 'fire', emoji: '🔥', size: 1.0 },
    { key: 'volcano', element: 'fire', emoji: '🌋', size: 1.15 },
    { key: 'log', element: 'fire', emoji: '🪵', size: 1.05 },
    { key: 'meteor', element: 'fire', emoji: '☄️', size: 1.1 }
  ],
  water: [
    { key: 'drop', element: 'water', emoji: '💧', size: 1.0 },
    { key: 'snow', element: 'water', emoji: '❄️', size: 0.95 },
    { key: 'fish', element: 'water', emoji: '🐟', size: 1.05 },
    { key: 'bubble', element: 'water', emoji: '🫧', size: 0.95 }
  ],
  earth: [
    { key: 'sprout', element: 'earth', emoji: '🌱', size: 1.0 },
    { key: 'leaf', element: 'earth', emoji: '🍃', size: 0.95 },
    { key: 'rock', element: 'earth', emoji: '🪨', size: 1.1 },
    { key: 'apple', element: 'earth', emoji: '🍎', size: 1.0 },
    { key: 'mushroom', element: 'earth', emoji: '🍄', size: 1.0 }
  ],
  air: [
    { key: 'tornado', element: 'air', emoji: '🌪️', size: 1.1 }, // gerçek sprite: obj_air_tornado.png
    { key: 'feather', element: 'air', emoji: '🪶', size: 1.0 },
    { key: 'balloon', element: 'air', emoji: '🎈', size: 1.1 },
    { key: 'bird', element: 'air', emoji: '🐦', size: 1.05 },
    { key: 'butterfly', element: 'air', emoji: '🦋', size: 1.0 },
    { key: 'wind', element: 'air', emoji: '💨', size: 1.0 }
  ]
};

export const ELEMENTS: ElementType[] = ['fire', 'water', 'earth', 'air'];
