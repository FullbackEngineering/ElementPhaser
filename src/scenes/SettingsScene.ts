import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { Button } from '../ui/Button';
import type { AudioManager } from '../managers/AudioManager';

/**
 * Ayarlar overlay'i (MenuScene üstünde `launch` ile açılır). Müzik ses seviyesi
 * (slider) + mute + kapat. Değerler AudioManager üzerinden anında uygulanır ve
 * SaveManager'da kalıcıdır. Açıkken menü input'u kapatılır (arka butonlara tıklanmasın).
 */
export class SettingsScene extends Phaser.Scene {
  private audio!: AudioManager;

  // slider geometrisi
  private readonly cx = GameConfig.designWidth / 2;
  private readonly trackY = 720;
  private readonly trackX0 = GameConfig.designWidth / 2 - 220;
  private readonly trackW = 440;

  private slider!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private muteIcon!: Phaser.GameObjects.Text;
  private dragging = false;

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    this.audio = this.registry.get('audioManager') as AudioManager;
    const menu = this.scene.get(SceneKeys.Menu);
    if (menu) menu.input.enabled = false; // overlay açıkken menü butonlarına tıklanmasın

    // Karartma — panel dışına tıklayınca kapat.
    this.add
      .rectangle(this.cx, GameConfig.designHeight / 2, GameConfig.designWidth, GameConfig.designHeight, 0x05060f, 0.62)
      .setInteractive()
      .on('pointerup', () => this.close());

    // Panel (tıklamayı yutar → panel içine dokununca kapanmaz).
    const panelH = 560;
    const panelY = GameConfig.designHeight / 2;
    const panel = this.add.graphics();
    panel.fillStyle(Palette.panel, 0.98);
    panel.fillRoundedRect(this.cx - 300, panelY - panelH / 2, 600, panelH, 28);
    this.add
      .rectangle(this.cx, panelY, 600, panelH, 0x000000, 0.001)
      .setInteractive(); // no-op yutucu

    this.add
      .text(this.cx, panelY - panelH / 2 + 60, 'AYARLAR', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '44px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    // --- Müzik / mute satırı ---
    this.add
      .text(this.cx - 240, 560, 'MÜZİK', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0, 0.5);

    this.muteIcon = this.add
      .text(this.cx + 240, 560, this.audio.muted ? '🔇' : '🔊', { fontSize: '48px' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.muteIcon.on('pointerup', () => {
      const muted = this.audio.toggleMuted();
      this.muteIcon.setText(muted ? '🔇' : '🔊');
      this.redrawSlider();
    });

    // --- Ses seviyesi slider ---
    this.add
      .text(this.cx - 240, 660, 'SES SEVİYESİ', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: Palette.textDim
      })
      .setOrigin(0, 0.5);

    this.percentText = this.add
      .text(this.cx + 240, 660, '', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#ffd166',
        fontStyle: 'bold'
      })
      .setOrigin(1, 0.5);

    this.slider = this.add.graphics();
    this.redrawSlider();

    // Slider hit-zone (geniş dokunma alanı) + drag.
    const zone = this.add
      .rectangle(this.cx, this.trackY, this.trackW + 80, 90, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setVolumeFromX(p.x);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.setVolumeFromX(p.x);
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
    });
    this.input.on('pointerupoutside', () => {
      this.dragging = false;
    });

    new Button(this, {
      x: this.cx,
      y: panelY + panelH / 2 - 70,
      width: 300,
      height: 88,
      label: 'KAPAT',
      onClick: () => this.close()
    });

    // ESC / geri ile de kapansın (masaüstü kolaylığı).
    this.input.keyboard?.once('keydown-ESC', () => this.close());
  }

  private setVolumeFromX(px: number): void {
    const v = Phaser.Math.Clamp((px - this.trackX0) / this.trackW, 0, 1);
    this.audio.setMusicVolume(v);
    // ses ayarlanınca mute'tan çık (kullanıcı sesi duymak istiyor demektir)
    if (this.audio.muted && v > 0) {
      this.audio.toggleMuted();
      this.muteIcon.setText('🔊');
    }
    this.redrawSlider();
  }

  private redrawSlider(): void {
    const v = this.audio.muted ? 0 : this.audio.musicVolume;
    const knobX = this.trackX0 + v * this.trackW;
    const y = this.trackY;

    this.slider.clear();
    // track
    this.slider.fillStyle(0x3a4166, 1);
    this.slider.fillRoundedRect(this.trackX0, y - 7, this.trackW, 14, 7);
    // fill
    this.slider.fillStyle(Palette.accent, 1);
    this.slider.fillRoundedRect(this.trackX0, y - 7, Math.max(14, knobX - this.trackX0), 14, 7);
    // knob
    this.slider.fillStyle(0xffffff, 1);
    this.slider.fillCircle(knobX, y, 20);
    this.slider.lineStyle(4, Palette.accent, 1);
    this.slider.strokeCircle(knobX, y, 20);

    this.percentText.setText(`${Math.round(this.audio.musicVolume * 100)}%`);
  }

  private close(): void {
    const menu = this.scene.get(SceneKeys.Menu);
    if (menu) menu.input.enabled = true;
    this.scene.stop();
  }
}
