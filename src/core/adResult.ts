/**
 * showAd yanıt yorumlama — saf mantık (SDK'sız, Phaser'sız, test edilebilir).
 *
 * Gerçek host sözleşmesi (gametegra-sdk skill → `references/game-methods.md`) SDK 0.3.8'in
 * `index.d.ts`'inden FARKLI:
 * - Sözleşme: `showAd({ placement, adType, adKey })` — üçü de ZORUNLU, yanıt diğer
 *   `callGameMethod` çağrıları gibi `SuperAppResponse` zarfında (`res.data.status`).
 * - `.d.ts` ise `placement`i ad tipi sanıyor, `adType`ı hiç bilmiyor ve düz `ShowAdResult`
 *   vaat ediyor.
 * Eski kod `.d.ts`'e güvendiği için host reklamı hiç açmıyor (`adType` yok), açsa bile
 * `res.status` daima undefined kaldığından ödül asla verilmiyordu. Zarfın yanında düz şekli
 * de okuyoruz — `.d.ts`'i yakalayan bir host sürümü gelirse ödül yine doğru okunsun.
 */

/**
 * Host `placement`i sabit bir whitelist'e karşı doğruluyor — serbest metin DEĞİL.
 * Cihazda doğrulandı (2026-07-24): `placement: 'game_over_revive'` →
 * `{ status: 'error', errorCode: 'invalid_placement' }`, reklam hiç açılmıyor.
 * Dokümandaki `game-over-pattern.md` örneği (`placement: 'game_over_retry'`) bu host'ta
 * geçersiz; geçerli olan `game-methods.md`'nin kanonik örneği. Oyun içi slot ayrımı
 * (revive/retry) şemasız `metadata`'da taşınır.
 */
export const AD_PLACEMENT = 'miniapp_open';

export type AdType = 'rewarded' | 'interstitial';

export interface AdOutcome {
  /** Host çağrıyı kabul etti mi (zarf yoksa true varsayılır). */
  hostOk: boolean;
  status?: string;
  reward: number;
  errorMessage: string | null;
  /** Tanı logu için ham yanıt. */
  raw: unknown;
}

/** showAd yanıtını iki olası şekilden (SuperAppResponse zarfı / düz sonuç) normalize eder. */
export function unwrapAdResult(res: unknown): AdOutcome {
  const top = (res ?? {}) as Record<string, unknown>;
  const isEnvelope = 'onHostSuccess' in top || 'onClientSuccess' in top;
  const body = (isEnvelope ? top.data : top) as Record<string, unknown> | null | undefined;
  return {
    hostOk: isEnvelope ? top.onHostSuccess === true : true,
    status: typeof body?.status === 'string' ? body.status : undefined,
    reward: Number(body?.reward) || 0,
    errorMessage: typeof top.errorMessage === 'string' ? top.errorMessage : null,
    raw: res
  };
}

/** Ödüllü reklam sonuna kadar izlendi mi → ödül hak edildi mi? */
export function isRewardEarned(o: AdOutcome): boolean {
  return o.hostOk && o.errorMessage == null && (o.status === 'completed' || o.reward > 0);
}
