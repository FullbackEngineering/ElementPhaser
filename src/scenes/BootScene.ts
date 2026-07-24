import Phaser from 'phaser';
import { SceneKeys } from '../constants/sceneKeys';
import { SaveManager } from '../managers/SaveManager';
import { AudioManager } from '../managers/AudioManager';
import { gametegra } from '../core/gametegra';

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
    const audio = new AudioManager(this.game, save);
    this.registry.set('audioManager', audio);

    // Gametegra host'a bağlan; hazır olunca arka/ön plan müzik yaşam döngüsünü bağla.
    void gametegra.init().then(async () => {
      await gametegra.onBackground(() => audio.pauseAll());
      await gametegra.onForeground(() => audio.resumeAll());
    });

    this.scene.start(SceneKeys.Preload);
  }
}
