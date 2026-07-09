import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';

describe('SaveManager', () => {
  beforeEach(() => localStorage.clear());

  it('boş kayıtta varsayılanlar', () => {
    const save = new SaveManager();
    expect(save.bestScore).toBe(0);
    expect(save.bestCombo).toBe(0);
    expect(save.muted).toBe(false);
  });

  it('submitRun best değerleri bağımsız yükseltir', () => {
    const save = new SaveManager();
    save.submitRun(100, 5);
    expect(save.bestScore).toBe(100);
    expect(save.bestCombo).toBe(5);

    save.submitRun(50, 8); // skor düşük ama combo yüksek
    expect(save.bestScore).toBe(100);
    expect(save.bestCombo).toBe(8);
  });

  it('kayıt localStorage\'da kalıcı', () => {
    const first = new SaveManager();
    first.submitRun(250, 12);
    first.setMuted(true);

    const reloaded = new SaveManager();
    expect(reloaded.bestScore).toBe(250);
    expect(reloaded.bestCombo).toBe(12);
    expect(reloaded.muted).toBe(true);
  });

  it('bozuk JSON varsayılana düşer', () => {
    localStorage.setItem('element-grinder-save', '{bozuk');
    const save = new SaveManager();
    expect(save.bestScore).toBe(0);
  });
});
