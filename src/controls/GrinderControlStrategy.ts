/**
 * Kontrol şeması stratejisi. GameConfig.controlScheme ile seçilir; M2'de iki
 * implementasyon prototiplenir ve çalışma anında değiştirilerek A/B test edilir.
 * Gameplay'in geri kalanı stratejiden habersizdir.
 */
export interface GrinderControlStrategy {
  readonly label: string;
  attach(): void;
  detach(): void;
}
