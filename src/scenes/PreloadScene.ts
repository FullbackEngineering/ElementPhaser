import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { OBJECT_SPRITES, Audio } from '../constants/assetKeys';

/**
 * Splash + gerçek asset yüklemesi. Düşen obje sprite'ları `public/sprites/`'ten
 * yüklenir; bar `load.on('progress')` ile beslenir; yükleme bitince Menu başlar.
 * Grinder'lar placeholder olduğu için burada grinder yüklemesi YOK.
 * Eksik/başarısız yükleme oyunu bozmaz — FallingObject placeholder'a düşer.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  preload(): void {
    drawGradientBackground(this);
    const cx = GameConfig.designWidth / 2;
    const cy = GameConfig.designHeight / 2;

    this.add
      .text(cx, cy - 90, 'ELEMENT GRINDER', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '46px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const barW = 420;
    const barH = 18;
    const track = this.add.graphics();
    track.fillStyle(Palette.panel, 1);
    track.fillRoundedRect(cx - barW / 2, cy, barW, barH, barH / 2);

    const fill = this.add.graphics();
    const drawFill = (v: number): void => {
      fill.clear();
      fill.fillStyle(Palette.accent, 1);
      fill.fillRoundedRect(cx - barW / 2, cy, Math.max(barH, barW * v), barH, barH / 2);
    };
    drawFill(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, drawFill);

    // Gerçek obje sprite yüklemeleri (frame anahtarı = dosya adı).
    for (const key of OBJECT_SPRITES) this.load.image(key, `sprites/${key}.png`);

    // Arka plan müziği (döngü). Yüklenemezse oyun sessiz devam eder (AudioManager guard'lı).
    this.load.audio(Audio.musicMain, `audio/${Audio.musicMain}.mp3`);
  }

  create(): void {
    // Yükleme bitti → bar dolu görünür; kısa bir splash sonrası Menu.
    this.time.delayedCall(250, () => this.scene.start(SceneKeys.Menu));
  }
}
