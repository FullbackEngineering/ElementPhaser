import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { SaveManager } from '../managers/SaveManager';
import { AudioManager } from '../managers/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    // App-seviyesi servisler registry'de yaşar. EventBus tur-başına GameScene'de
    // oluşturulur (eski tur listener'ları sızmasın).
    const save = new SaveManager();
    this.registry.set('saveManager', save);
    // AudioManager global game.sound'u sarar; müzik Menu'de başlatılır (asset Preload'da yüklenir).
    this.registry.set('audioManager', new AudioManager(this.game, save));
    this.scene.start(SceneKeys.Preload);
  }
}
