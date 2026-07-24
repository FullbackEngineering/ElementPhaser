import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { Button } from '../ui/Button';
import { gametegra, type LeaderboardView } from '../core/gametegra';

/**
 * Liderlik tablosu — Gametegra `getLeaderboard`'tan top skorları gösterir.
 * Host bridge (SuperApp) yoksa bilgilendirici mesaj gösterir; oyun tarayıcıda
 * standalone çalışırken tablo boştur, gerçek veriler SuperApp içinde gelir.
 */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Leaderboard);
  }

  create(): void {
    drawGradientBackground(this);
    const cx = GameConfig.designWidth / 2;

    this.add
      .text(cx, 180, '🏆  LİDERLİK', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '68px',
        color: Palette.textLight,
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const status = this.add
      .text(cx, 380, 'Yükleniyor…', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: Palette.textDim,
        align: 'center',
        wordWrap: { width: GameConfig.designWidth - 120 }
      })
      .setOrigin(0.5);

    new Button(this, {
      x: cx,
      y: GameConfig.designHeight - 140,
      width: 320,
      height: 92,
      label: '←  GERİ',
      fill: Palette.panel,
      textColor: Palette.textLight,
      onClick: () => this.scene.start(SceneKeys.Menu)
    });

    void this.fetchAndRender(status);
  }

  private async fetchAndRender(status: Phaser.GameObjects.Text): Promise<void> {
    const view = await gametegra.fetchLeaderboard(10);
    if (!this.scene.isActive()) return;

    if (!view.available) {
      status.setText('Liderlik tablosu Gametegra\nSuperApp içinde görünür.');
      return;
    }
    if (view.rows.length === 0) {
      status.setText('Henüz skor yok.\nİlk rekoru sen kır! 🔥');
      return;
    }

    status.destroy();
    this.renderRows(view);
  }

  private renderRows(view: LeaderboardView): void {
    const cx = GameConfig.designWidth / 2;
    const left = 90;
    const right = GameConfig.designWidth - 90;
    const startY = 320;
    const rowH = 74;

    view.rows.forEach((row, i) => {
      const y = startY + i * rowH;
      const isMe = row.isMe;
      const color = isMe ? '#ffd166' : Palette.textLight;

      // Sıralama madalyası (ilk 3) veya numara
      const badge = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}.`;

      if (isMe) {
        const hl = this.add.graphics();
        hl.fillStyle(Palette.accent, 0.14);
        hl.fillRoundedRect(left - 20, y - rowH / 2 + 6, right - left + 40, rowH - 12, 16);
      }

      this.add
        .text(left, y, badge, { fontFamily: 'Arial, sans-serif', fontSize: '38px', color })
        .setOrigin(0, 0.5);

      this.add
        .text(right, y, `${row.score}${isMe ? '  (sen)' : ''}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '38px',
          color,
          fontStyle: 'bold'
        })
        .setOrigin(1, 0.5);
    });

    // Oyuncu top-10 dışındaysa kendi sırasını en altta göster.
    if (view.me && !view.rows.some((r) => r.isMe)) {
      const y = startY + view.rows.length * rowH + 24;
      this.add
        .text(cx, y, `Senin sıran:  ${view.me.rank}.  ·  ${view.me.score}`, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '32px',
          color: '#ffd166',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);
    }
  }
}
