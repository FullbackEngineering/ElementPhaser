import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { SaveManager } from '../managers/SaveManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    // App-seviyesi servisler registry'de yaşar. EventBus tur-başına GameScene'de
    // oluşturulur (eski tur listener'ları sızmasın). İleride AudioManager de burada.
    this.registry.set('saveManager', new SaveManager());
    this.scene.start(SceneKeys.Preload);
  }
}
