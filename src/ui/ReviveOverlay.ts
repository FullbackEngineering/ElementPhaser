import Phaser from 'phaser';
import { GameConfig, Palette } from '../config/GameConfig';
import { Button } from './Button';

export interface ReviveOverlayConfig {
  /** Bu revive dahil kalan hak sayısı (başlık altında gösterilir). */
  remaining: number;
  countdownSec: number;
  onWatch: () => void;
  onDecline: () => void;
}

/**
 * "Bir şans daha?" revive teklifi overlay'i — oyun donmuşken üstte belirir.
 * Geri sayım biterse otomatik `onDecline` çağrılır. "Reklam İzle" → `onWatch`,
 * ardından çağıran taraf `showLoading()` gösterip reklamı başlatır. Reklam
 * ödüllenirse `showGrace()` ile "HAZIR OL" oynatılır, sonra oyun devam eder.
 */
export class ReviveOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly watchBtn: Button;
  private countdownEvent?: Phaser.Time.TimerEvent;
  private secondsLeft: number;
  private settled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: ReviveOverlayConfig
  ) {
    const w = GameConfig.designWidth;
    const h = GameConfig.designHeight;
    const cx = w / 2;
    this.secondsLeft = cfg.countdownSec;

    this.container = scene.add.container(0, 0).setDepth(200);

    const dim = scene.add.rectangle(cx, h / 2, w, h, 0x05060f, 0.78);
    dim.setInteractive(); // arkadaki oyun alanına tıklamayı engelle

    const title = scene.add
      .text(cx, h / 2 - 200, 'Bir şans daha?', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '76px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const sub = scene.add
      .text(cx, h / 2 - 110, `Reklam izle, oyuna 1 canla devam et\nKalan hak: ${cfg.remaining}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        color: Palette.textDim,
        align: 'center'
      })
      .setOrigin(0.5);

    this.watchBtn = new Button(scene, {
      x: cx,
      y: h / 2 + 40,
      width: 460,
      height: 118,
      label: this.watchLabel(),
      fill: Palette.accent,
      onClick: () => this.onWatchTapped()
    });

    const declineBtn = new Button(scene, {
      x: cx,
      y: h / 2 + 190,
      width: 320,
      height: 88,
      label: 'Vazgeç',
      fill: Palette.panel,
      textColor: Palette.textLight,
      onClick: () => this.settle(cfg.onDecline)
    });

    this.container.add([dim, title, sub, this.watchBtn, declineBtn]);

    this.countdownEvent = scene.time.addEvent({
      delay: 1000,
      repeat: cfg.countdownSec - 1,
      callback: this.tick,
      callbackScope: this
    });
  }

  /** Reklam yüklenirken: butonları gizle, geri sayımı durdur, "yükleniyor" göster. */
  showLoading(): void {
    this.countdownEvent?.remove();
    this.container.each((child: Phaser.GameObjects.GameObject) => {
      if (child instanceof Button) child.setVisible(false);
    });
    const { width, height } = { width: GameConfig.designWidth, height: GameConfig.designHeight };
    const loading = this.scene.add
      .text(width / 2, height / 2 + 60, 'Reklam yükleniyor…', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '36px',
        color: Palette.textLight
      })
      .setOrigin(0.5);
    this.container.add(loading);
  }

  /** Revive başarılı → "HAZIR OL" geri sayımı, ardından `onDone` (oyun devam eder). */
  showGrace(ms: number, onDone: () => void): void {
    this.container.removeAll(true);
    const cx = GameConfig.designWidth / 2;
    const cy = GameConfig.designHeight / 2;

    const dim = this.scene.add.rectangle(cx, cy, GameConfig.designWidth, GameConfig.designHeight, 0x05060f, 0.5);
    const ready = this.scene.add
      .text(cx, cy, 'HAZIR OL', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '90px',
        color: Palette.accent === 0xffd166 ? '#ffd166' : '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setScale(0);
    this.container.add([dim, ready]);

    this.scene.tweens.add({ targets: ready, scale: 1, duration: 300, ease: 'Back.out' });
    this.scene.tweens.add({ targets: ready, alpha: 0.3, yoyo: true, repeat: -1, duration: 400, delay: 300 });

    this.scene.time.delayedCall(ms, () => {
      this.destroy();
      onDone();
    });
  }

  destroy(): void {
    this.countdownEvent?.remove();
    this.container.destroy(true);
  }

  private readonly tick = (): void => {
    this.secondsLeft--;
    if (this.secondsLeft <= 0) {
      this.settle(this.cfg.onDecline);
      return;
    }
    this.watchBtn.setLabel(this.watchLabel());
  };

  private onWatchTapped(): void {
    if (this.settled) return;
    this.settled = true;
    this.countdownEvent?.remove();
    this.cfg.onWatch();
  }

  private settle(fn: () => void): void {
    if (this.settled) return;
    this.settled = true;
    this.countdownEvent?.remove();
    fn();
  }

  private watchLabel(): string {
    return `📺  Reklam İzle  (${this.secondsLeft})`;
  }
}
