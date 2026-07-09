import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { GameConfig, Palette } from '../config/GameConfig';
import { drawGradientBackground } from '../ui/background';
import { GrinderRow, type ControlMode } from '../objects/GrinderRow';
import type { GrinderControlStrategy } from '../controls/GrinderControlStrategy';
import { LockedRowSwipeStrategy } from '../controls/LockedRowSwipeStrategy';
import { IndependentDragStrategy } from '../controls/IndependentDragStrategy';
import { SpawnManager } from '../managers/SpawnManager';
import { MatchResolver } from '../managers/MatchResolver';
import { ScoreManager } from '../managers/ScoreManager';
import { LivesManager } from '../managers/LivesManager';
import { DifficultyManager } from '../managers/DifficultyManager';
import type { SaveManager } from '../managers/SaveManager';
import { EventBus } from '../core/EventBus';

export class GameScene extends Phaser.Scene {
  private bus!: EventBus;
  private row!: GrinderRow;
  private strategy!: GrinderControlStrategy;
  private spawner!: SpawnManager;
  private matchResolver!: MatchResolver;
  private scoreManager!: ScoreManager;
  private livesManager!: LivesManager;
  private difficulty!: DifficultyManager;

  private mode: ControlMode = GameConfig.controlScheme;
  private over = false;
  private lastMatchXY: { x: number; y: number } | null = null;

  private fpsText?: Phaser.GameObjects.Text;
  private schemeText?: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.over = false;
    this.lastMatchXY = null;

    // Tur-başına taze EventBus → eski turun listener'ları sızmaz.
    this.bus = new EventBus();
    this.registry.set('eventBus', this.bus);

    drawGradientBackground(this);
    this.scene.launch(SceneKeys.UI); // HUD paralel; camera shake HUD'u etkilemez
    this.drawMatchLine();

    // Efekt dinleyicileri ÖNCE (match:correct'te pozisyon saklanır, sonra ScoreManager).
    this.registerEffects();
    this.scoreManager = new ScoreManager(this.bus);
    this.livesManager = new LivesManager(this.bus, GameConfig.startingLives);
    this.difficulty = new DifficultyManager(this.bus);

    this.row = new GrinderRow(this, GameConfig.designWidth, GameConfig.layout.grinderRowY, this.mode);
    this.spawner = new SpawnManager(this, GameConfig.designHeight, this.row.laneCenters);
    this.spawner.applyDifficulty(this.difficulty.snapshot); // skor 0 → kolay tanıtım
    this.strategy = this.makeStrategy(this.mode);
    this.strategy.attach();

    const catchLineY = GameConfig.layout.grinderRowY - GameConfig.layout.catchLineOffset;
    this.matchResolver = new MatchResolver(this.bus, this.row, this.spawner, catchLineY);

    this.bus.on('life:changed', this.onLifeChanged);
    this.bus.on('difficulty:changed', (s) => this.spawner.applyDifficulty(s));
    this.bus.on('milestone:reached', (p) => this.celebrate(p.tier, p.label));

    if (GameConfig.debug) this.drawDebugControls();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.strategy.detach());
  }

  update(_time: number, delta: number): void {
    if (this.over) return;
    this.spawner.update(delta);
    this.matchResolver.update();
    this.row.update(delta);
    if (this.fpsText) {
      this.fpsText.setText(
        `FPS: ${Math.round(this.game.loop.actualFps)}  ·  obj: ${this.spawner.activeCount}  ·  ♥ ${this.livesManager.remaining}`
      );
    }
  }

  // --- oyun akışı ---
  private readonly onLifeChanged = (p: { lives: number }): void => {
    if (p.lives <= 0) this.gameOver();
  };

  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    const save = this.registry.get('saveManager') as SaveManager;
    save.submitRun(this.scoreManager.score, this.scoreManager.bestCombo);
    this.scene.stop(SceneKeys.UI);
    this.scene.start(SceneKeys.GameOver, {
      score: this.scoreManager.score,
      best: save.bestScore,
      bestCombo: this.scoreManager.bestCombo
    });
  }

  private makeStrategy(mode: ControlMode): GrinderControlStrategy {
    return mode === 'lockedRow'
      ? new LockedRowSwipeStrategy(this, this.row)
      : new IndependentDragStrategy(this, this.row);
  }

  private toggleScheme(): void {
    this.strategy.detach();
    this.mode = this.mode === 'lockedRow' ? 'independent' : 'lockedRow';
    this.row.setMode(this.mode);
    this.strategy = this.makeStrategy(this.mode);
    this.strategy.attach();
    this.schemeText?.setText(`Kontrol: ${this.strategy.label}  (değiştir)`);
  }

  // --- efektler (temel juice; tam parçacık sistemi M7) ---
  private registerEffects(): void {
    this.bus.on('match:correct', (p) => {
      this.lastMatchXY = { x: p.x, y: p.y };
      this.popAt(p.x, p.y, 0x7fffa0);
    });
    this.bus.on('score:changed', (p) => {
      if (p.delta > 0 && this.lastMatchXY) {
        this.floatText(this.lastMatchXY.x, this.lastMatchXY.y, `+${p.delta}`, '#7fffa0');
      }
    });
    this.bus.on('match:wrong', () => {
      this.cameras.main.shake(180, 0.008);
      this.flash(0xff3b3b);
    });
    this.bus.on('object:missed', () => this.cameras.main.shake(120, 0.005));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: 'Arial, sans-serif', fontSize: '40px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 650, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private popAt(x: number, y: number, color: number): void {
    const ring = this.add.circle(x, y, 14, color, 0.5).setDepth(40);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 380, ease: 'Cubic.out', onComplete: () => ring.destroy() });
  }

  private flash(color: number): void {
    const r = this.add
      .rectangle(GameConfig.designWidth / 2, GameConfig.designHeight / 2, GameConfig.designWidth, GameConfig.designHeight, color, 0.22)
      .setDepth(30);
    this.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
  }

  /** Kademe atlama kutlaması (seviye tablosundaki her üst geçişte). Oynanışı durdurmaz. */
  private celebrate(tier: number, label?: string): void {
    const cx = GameConfig.designWidth / 2;
    const cy = GameConfig.designHeight / 2 - 80;

    this.flash(Palette.accent); // altın parlama

    // ışın patlaması
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10;
      const dot = this.add.circle(cx, cy, 9, 0xffe08a, 1).setDepth(60);
      this.tweens.add({
        targets: dot,
        x: cx + Math.cos(ang) * 280,
        y: cy + Math.sin(ang) * 280,
        alpha: 0,
        scale: 0.2,
        duration: 720,
        ease: 'Cubic.out',
        onComplete: () => dot.destroy()
      });
    }

    const title = tier === 1 ? 'WOW! 🎉' : 'SÜPER! 🔥';
    const sub = label ?? `Kademe ${tier}`;

    const big = this.add
      .text(cx, cy, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '86px',
        color: '#ffd166',
        fontStyle: 'bold',
        stroke: '#3a2c00',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(61)
      .setScale(0);

    const small = this.add
      .text(cx, cy + 74, sub, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        color: '#f5f7ff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setDepth(61)
      .setAlpha(0);

    this.tweens.add({ targets: big, scale: 1, duration: 380, ease: 'Back.out' });
    this.tweens.add({ targets: small, alpha: 1, duration: 360, delay: 140, ease: 'Cubic.out' });
    this.tweens.add({
      targets: [big, small],
      alpha: 0,
      y: '-=40',
      delay: 950,
      duration: 420,
      ease: 'Cubic.in',
      onComplete: () => {
        big.destroy();
        small.destroy();
      }
    });
  }

  private drawMatchLine(): void {
    const y = GameConfig.layout.grinderRowY - GameConfig.layout.matchLineOffset;
    const line = this.add.graphics();
    line.lineStyle(2, Palette.accent, 0.25);
    line.lineBetween(0, y, GameConfig.designWidth, y);
  }

  private drawDebugControls(): void {
    this.fpsText = this.add.text(16, 190, '', { fontFamily: 'monospace', fontSize: '22px', color: '#7fffa0' });

    this.schemeText = this.add
      .text(GameConfig.designWidth / 2, 250, `Kontrol: ${this.strategy.label}  (değiştir)`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '26px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.schemeText.on('pointerup', () => this.toggleScheme());
  }
}
