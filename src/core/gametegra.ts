import { gameTegra, type ShowAdParams, type SuperAppResponse } from '@gametegra/sdk';
import { AD_PLACEMENT, isRewardEarned, unwrapAdResult, type AdOutcome, type AdType } from './adResult';

/**
 * Gametegra SDK için motor-bağımsız (Phaser'sız) ince sarmalayıcı.
 * Tüm çağrılar timeout ile korunur ve host bridge yokken (düz tarayıcı / dev)
 * sessizce güvenli varsayılana düşer — hiçbir metod exception fırlatmaz, oyunu asla kilitlemez.
 *
 * SuperApp içinde `window.gameTegra` host'a bağlıdır; dışarıda (dev/test) her çağrı
 * kendi timeout'una düşer. Reklam çağrıları uzun sürebileceğinden (rewarded video 15-30sn)
 * ayrı, daha uzun bir timeout kullanır.
 */

const CALL_TIMEOUT_MS = 8000;
const AD_TIMEOUT_MS = 120000; // rewarded video izlenirken kesilmesin
const READY_RETRY_MS = 4000; // reklam anında host'a verilen "son şans" süresi

/** `.d.ts` `placement`i daralttığı ve `adType`ı hiç bilmediği için kendi param tipimiz (bkz. `adResult.ts`). */
interface HostShowAdParams extends Omit<ShowAdParams, 'placement'> {
  placement: string;
  adType: AdType;
}

// SDK 0.3.8 tip tanımında olmayan ama runtime'da var olan host metodları
// (dokümante — bkz. api-methods.md: getSafeAreaInsets/onBackground/onForeground).
interface HostExtras {
  getSafeAreaInsets?: () => { top: number; bottom: number; left: number; right: number };
  onBackground?: (cb: () => void) => Promise<() => void>;
  onForeground?: (cb: () => void) => Promise<() => void>;
}
const extras = gameTegra as unknown as HostExtras;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('gametegra: timeout')), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Tanı logu için güvenli metne çevirme. Düz `JSON.stringify` iki şekilde bozuluyordu:
 * `Error` nesnesini `{}`'a indirgiyor (yani timeout'ta log hiçbir şey söylemiyor) ve
 * serileştirilemeyen yanıtta fırlatıp çağıran akışı kırıyordu (revive overlay'i donduruyordu).
 */
function safeStringify(value: unknown): string {
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// loadData yanıtı: docs `data.data`'yı array gösterir ama gerçek host tek obje döndürebilir
// (bkz. known-issues #0) — ikisini de destekle.
function extractLoadDataEntry(res: unknown): { value?: unknown } | undefined {
  const d = (res as SuperAppResponse<{ data?: unknown }>)?.data?.data;
  if (Array.isArray(d)) return d[0] as { value?: unknown } | undefined;
  if (d && typeof d === 'object') return d as { value?: unknown };
  return undefined;
}

function parseStoredScore(rawValue: unknown): number | null {
  const v =
    rawValue && typeof rawValue === 'object'
      ? (rawValue as { score?: unknown }).score
      : typeof rawValue === 'string'
        ? (() => {
            try {
              return (JSON.parse(rawValue) as { score?: unknown }).score;
            } catch {
              return undefined;
            }
          })()
        : undefined;
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

const HIGHSCORE_KEY = 'highscore';
const LEADERBOARD_ID = 'highscore';
/** Kendi `owner_id`'miz yalnızca `updateLeaderboard` yanıtından öğrenilebiliyor → oturumlar arası sakla. */
const OWNER_ID_STORAGE_KEY = 'element-grinder-gt-owner';
const DISPLAY_NAME_STORAGE_KEY = 'element-grinder-gt-name';
/** Tablo satırı 720px'e sığmalı — uzun isimler kısaltılır. */
const MAX_NAME_LENGTH = 14;

export interface LeaderboardRow {
  /** Host sıralamayı vermediyse 0 → UI sıra numarası yerine sadece skoru gösterir. */
  rank: number;
  score: number;
  isMe: boolean;
  /** Oyuncu adı; kayıtta yoksa boş (UI "Oyuncu" gösterir). */
  name: string;
}
export interface LeaderboardView {
  /** Host bridge (SuperApp) yoksa false → UI "SuperApp içinde görünür" mesajı gösterir. */
  available: boolean;
  /** Bridge var ama çağrı başarısız → UI "boş tablo" yerine hata mesajı gösterir. */
  error: boolean;
  rows: LeaderboardRow[];
  /** Oyuncunun kendi kaydı (top listede olmasa bile), yoksa null. */
  me: LeaderboardRow | null;
}

interface RawRecord {
  score: number | string;
  owner_id?: string | number;
  rank?: number | string;
  metadata?: { name?: unknown } | null;
  username?: unknown;
  display_name?: unknown;
  owner_name?: unknown;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage yoksa cache'siz çalış
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage yoksa sessizce geç */
  }
}

function trimName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > MAX_NAME_LENGTH ? `${trimmed.slice(0, MAX_NAME_LENGTH - 1)}…` : trimmed;
}

/**
 * Kayıttan oyuncu adını çıkarır. Host'un leaderboard kayıt şemasında isim alanı **dokümante
 * değil**, o yüzden isim gönderirken `updateLeaderboard` metadata'sına yazıyoruz ve okurken
 * önce oradan alıyoruz; host ileride kendi alanını eklerse diye bilinen adaylar da denenir.
 */
function pickRecordName(record: RawRecord): string {
  const candidates = [record.metadata?.name, record.username, record.display_name, record.owner_name];
  for (const candidate of candidates) {
    const name = trimName(candidate);
    if (name !== '') return name;
  }
  return '';
}

class GametegraService {
  private initialized = false;
  private hostReady = false;
  /**
   * Oyuncunun leaderboard kimliği. Host bunu yalnızca kendi `updateLeaderboard` yanıtımızda
   * veriyor (`getUserInfo()` kullanıcı ID'si döndürmüyor) → "bu skor bana mı ait" tespitinin
   * `getLeaderboard`'ın doğrulanmamış `owner_records` alanına tek başına bağlı kalmaması için
   * yakalandığı anda saklanır.
   */
  private myOwnerId: string | null = readStored(OWNER_ID_STORAGE_KEY);
  /** Tabloda görünecek kendi adımız — `getUserInfo()` her açılışta çağrılmasın diye saklanır. */
  private myDisplayName: string | null = readStored(DISPLAY_NAME_STORAGE_KEY);
  /** Test/dev için: host yokken reklamı "izlendi" say (URL ?mockad veya elle set). */
  mockAdReward = new URLSearchParams(window.location.search).has('mockad');

  get ready(): boolean {
    return this.hostReady;
  }

  /** Uygulama açılışında bir kere çağrılır. Host'a bağlanmayı bekler (timeout'lu). */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.applySafeArea();
    // `?adlog` → gerçek cihazda DevTools olmadan host yanıtlarını görebilmek için
    // SDK'nın kendi log katmanını aç (reklam tanısı için tek yol).
    if (new URLSearchParams(window.location.search).has('adlog')) {
      try {
        gameTegra.devConsole.show({ interceptConsole: true });
      } catch {
        /* devConsole yoksa yoksay */
      }
    }
    await this.ensureHostReady(CALL_TIMEOUT_MS, false);
  }

  /** Host bridge'i sayfaya hiç enjekte edilmiş mi (düz tarayıcıda hiçbir zaman olmaz). */
  private get bridgePresent(): boolean {
    return gameTegra.superapp != null || (window as { superapp?: unknown }).superapp != null;
  }

  /**
   * Host bağlantısını (yeniden) dener. Boot'taki tek deneme yavaş cihazda/soğuk WebView'de
   * timeout'a düşerse tüm oturum boyunca reklam ölü kalıyordu; her reklam çağrısı öncesi
   * son bir şans daha veriyoruz.
   *
   * `skipIfNoBridge`: bridge hiç yoksa (dev/tarayıcı) beklemeden dön — reklam butonu
   * boşuna donmasın. Boot'ta kapalı, çünkü bridge sayfadan biraz sonra enjekte edilebilir.
   */
  private async ensureHostReady(timeoutMs = READY_RETRY_MS, skipIfNoBridge = true): Promise<boolean> {
    if (this.hostReady) return true;
    if (skipIfNoBridge && !this.bridgePresent) return false;
    try {
      await withTimeout(gameTegra.waitUntilReady(), timeoutMs);
      this.hostReady = true;
    } catch {
      this.hostReady = false; // host bridge yok — normal (dev/tarayıcı)
    }
    return this.hostReady;
  }

  /** Safe-area insetlerini CSS custom property'lere yazar (host olmadan da senkron çalışır). */
  applySafeArea(): void {
    let insets = { top: 0, bottom: 0, left: 0, right: 0 };
    try {
      insets = extras.getSafeAreaInsets?.() ?? insets;
    } catch {
      /* host yok — 0 kalır */
    }
    const root = document.documentElement.style;
    root.setProperty('--sa-top', `${insets.top}px`);
    root.setProperty('--sa-bottom', `${insets.bottom}px`);
    root.setProperty('--sa-left', `${insets.left}px`);
    root.setProperty('--sa-right', `${insets.right}px`);
  }

  /** Haptic titreşim (fire-and-forget). */
  vibrate(): void {
    withTimeout(gameTegra.vibrate(), CALL_TIMEOUT_MS).catch(() => {});
  }

  /** Analytics — fire-and-forget, oyunu asla bekletmez. */
  report(eventType: string, data: Record<string, unknown>): void {
    withTimeout(gameTegra.reportEvent({ eventType, data }), CALL_TIMEOUT_MS).catch(() => {});
  }

  /**
   * Ödüllü reklam gösterir. `true` → oyuncu reklamı sonuna kadar izledi (ödül hak edildi).
   * Host yoksa ve mockAdReward açıksa (dev) hemen `true` döner ki revive akışı test edilebilsin.
   */
  async showRewardedAd(adKey: string, placementKey: string): Promise<boolean> {
    // Host bridge yoksa (düz tarayıcı) gerçek reklam oynamaz — dev'de test için mock, aksi
    // halde hemen false (120sn'lik askıda kalmayı önler; gerçek reklam sadece SuperApp'te).
    if (!(await this.ensureHostReady())) return this.mockAdReward;

    const outcome = await this.requestAd('rewarded', adKey, placementKey);
    if (!outcome) return false;

    const watched = isRewardEarned(outcome);
    if (!watched) this.logSdkFailure('rewarded reklam', adKey, outcome.raw);
    return watched;
  }

  /** Geçiş reklamı (interstitial) gösterir, sonucu önemsemez — oyuncuyu asla kilitleme. */
  async showInterstitialAd(adKey: string, placementKey: string): Promise<void> {
    if (!(await this.ensureHostReady())) return; // host yok → reklam yok, bekletme

    const outcome = await this.requestAd('interstitial', adKey, placementKey);
    if (outcome && (!outcome.hostOk || outcome.status === 'error' || outcome.status === 'noFill')) {
      this.logSdkFailure('interstitial reklam', adKey, outcome.raw);
    }
  }

  /** Tek showAd çağrısı; hata/timeout'ta null (reklam oyuncuyu asla kilitlemez). */
  private async requestAd(adType: AdType, adKey: string, placementKey: string): Promise<AdOutcome | null> {
    const params: HostShowAdParams = {
      placement: AD_PLACEMENT, // host whitelist'i — oyun içi slot metadata'da
      adType,
      adKey,
      // Oyuncu ödüllü reklamı bilerek istedi → host'un yükleniyor katmanı beklemeyi açıklar.
      // Interstitial'da kapalı: retry akışını gereksiz yere yavaşlatmasın.
      showLoading: adType === 'rewarded',
      metadata: { placement: placementKey }
    };
    try {
      const res = await withTimeout(gameTegra.showAd(params as unknown as ShowAdParams), AD_TIMEOUT_MS);
      return unwrapAdResult(res);
    } catch (err) {
      this.logSdkFailure(`${adType} reklam`, adKey, err);
      return null;
    }
  }

  /**
   * Başarısız bir host çağrısının tanı bilgisini görünür kılar (status/errorCode/exception).
   * Önceden bu bilgi tamamen yutuluyordu — "reklam açılmıyor"/"skorum tabloya girmiyor"
   * şikayetinde kök nedeni teşhis etmek imkansızdı. `devConsole`'a da yazar ki gerçek cihazda
   * (DevTools yokken, `?adlog` ile) görülebilsin.
   */
  private logSdkFailure(kind: string, key: string, detail: unknown): void {
    const message = `gametegra: ${kind} başarısız (${key}) → ${safeStringify(detail)}`;
    console.warn(message);
    try {
      (gameTegra as unknown as { devConsole?: { warn?: (msg: string) => void } }).devConsole?.warn?.(message);
    } catch {
      /* devConsole yoksa yoksay */
    }
  }

  /** Kayıtlı en yüksek skoru okur (yoksa/host yoksa null). */
  async loadHighScore(): Promise<number | null> {
    if (!(await this.ensureHostReady())) return null;
    try {
      const res = await withTimeout(gameTegra.loadData({ key: HIGHSCORE_KEY }), CALL_TIMEOUT_MS);
      const entry = extractLoadDataEntry(res);
      return entry ? parseStoredScore(entry.value) : null;
    } catch (err) {
      this.logSdkFailure('loadData', HIGHSCORE_KEY, err);
      return null;
    }
  }

  /** En yüksek skoru kalıcı olarak kaydeder (fire-and-forget güvenli). */
  async saveHighScore(score: number): Promise<void> {
    if (!(await this.ensureHostReady())) return;
    try {
      await withTimeout(
        gameTegra.saveData({ key: HIGHSCORE_KEY, value: { score, savedAt: new Date().toISOString() } }),
        CALL_TIMEOUT_MS
      );
    } catch (err) {
      this.logSdkFailure('saveData', HIGHSCORE_KEY, err); // bir sonraki oyunda tekrar denenir
    }
  }

  /**
   * Leaderboard tanımını oluşturmayı dener. Host "zaten var" derse bu **beklenen** yol —
   * loglanmaz, aksi halde her game over'da sahte bir hata satırı üretirdi. Önce okuyup
   * "var mı" diye bakmak yanlış: host olmayan tabloda da sessizce resolve ediyor.
   */
  private async ensureLeaderboardExists(): Promise<void> {
    try {
      await withTimeout(
        gameTegra.createLeaderboard({
          id: LEADERBOARD_ID,
          sortOrder: 'desc',
          operator: 'best',
          metadata: { title: 'Element Grinder High Scores' }
        }),
        CALL_TIMEOUT_MS
      );
    } catch {
      /* muhtemelen zaten var — devam */
    }
  }

  /**
   * Skoru leaderboard'a gönderir; tabloyu okuyup en üstteki { score, isMe } döner.
   * Host yoksa null.
   */
  async submitAndReadLeaderboard(score: number): Promise<{ score: number; isMe: boolean; name: string } | null> {
    if (!(await this.ensureHostReady())) return null;
    await this.ensureLeaderboardExists();

    // Adı skorla birlikte gönderiyoruz: host kayıtlarında isim alanı yok, tabloda isim
    // görünmesinin tek yolu bu metadata'yı yazıp okurken geri almak.
    const myName = await this.resolveDisplayName();
    try {
      const updateRes = (await withTimeout(
        gameTegra.updateLeaderboard(
          myName ? { id: LEADERBOARD_ID, score, metadata: { name: myName } } : { id: LEADERBOARD_ID, score }
        ),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ owner_id?: string | number }>;
      const ownerId = updateRes?.data?.owner_id;
      if (ownerId != null) this.rememberOwnerId(String(ownerId));
    } catch (err) {
      this.logSdkFailure('updateLeaderboard', LEADERBOARD_ID, err);
      return null; // skor gönderilemedi — tabloyu okumanın anlamı yok
    }

    try {
      const lbRes = (await withTimeout(
        gameTegra.getLeaderboard({ id: LEADERBOARD_ID, limit: 10 }),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ records?: RawRecord[] }>;
      const top = lbRes?.data?.records?.[0];
      if (!top) return null;
      const isMe = this.isOwnRecord(top);
      return { score: Number(top.score), isMe, name: pickRecordName(top) || (isMe ? myName : '') };
    } catch (err) {
      this.logSdkFailure('getLeaderboard', LEADERBOARD_ID, err);
      return null;
    }
  }

  private rememberOwnerId(ownerId: string): void {
    this.myOwnerId = ownerId;
    writeStored(OWNER_ID_STORAGE_KEY, ownerId);
  }

  /**
   * Tabloda görünecek ad: ad + soyad baş harfi. Tam soyadı ve e-posta **asla** gönderilmez —
   * bu satırı diğer oyuncular görüyor. Host bilgi vermezse boş döner (UI "Oyuncu" gösterir).
   */
  private async resolveDisplayName(): Promise<string> {
    if (this.myDisplayName != null) return this.myDisplayName;
    let label = '';
    try {
      const res = (await withTimeout(gameTegra.getUserInfo(), CALL_TIMEOUT_MS)) as SuperAppResponse<{
        name?: string;
        surname?: string;
      }>;
      const name = res?.data?.name?.trim() ?? '';
      const surname = res?.data?.surname?.trim() ?? '';
      label = trimName(name && surname ? `${name} ${surname[0]}.` : name);
    } catch (err) {
      this.logSdkFailure('getUserInfo', 'displayName', err);
    }
    this.myDisplayName = label;
    if (label !== '') writeStored(DISPLAY_NAME_STORAGE_KEY, label);
    return label;
  }

  private isOwnRecord(record: RawRecord): boolean {
    return this.myOwnerId != null && String(record.owner_id) === this.myOwnerId;
  }

  /**
   * Liderlik tablosunu okur (top `limit` + oyuncunun kendi kaydı). Host yoksa
   * `available:false` döner. Leaderboard idempotent oluşturulmaya çalışılır.
   */
  async fetchLeaderboard(limit = 10): Promise<LeaderboardView> {
    if (!(await this.ensureHostReady())) return { available: false, error: false, rows: [], me: null };
    await this.ensureLeaderboardExists();

    try {
      const res = (await withTimeout(
        gameTegra.getLeaderboard({ id: LEADERBOARD_ID, limit }),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ records?: RawRecord[]; owner_records?: RawRecord[] }>;

      const records = res?.data?.records ?? [];
      const ownerRec = res?.data?.owner_records?.[0];
      // `owner_records` dokümante ama cihazda doğrulanmadı → gelirse kimliği oradan tazele,
      // gelmezse `updateLeaderboard`'dan saklanan kimliğe düş (tek doğrulanmış kaynak).
      if (ownerRec?.owner_id != null) this.rememberOwnerId(String(ownerRec.owner_id));

      const rows: LeaderboardRow[] = records.map((r, i) => {
        const isMe = this.isOwnRecord(r);
        return {
          rank: r.rank != null ? Number(r.rank) : i + 1,
          score: Number(r.score),
          isMe,
          name: pickRecordName(r) || (isMe ? (this.myDisplayName ?? '') : '')
        };
      });

      const me: LeaderboardRow | null = ownerRec
        ? {
            rank: ownerRec.rank != null ? Number(ownerRec.rank) : 0,
            score: Number(ownerRec.score),
            isMe: true,
            name: pickRecordName(ownerRec) || (this.myDisplayName ?? '')
          }
        : (rows.find((r) => r.isMe) ?? null);

      return { available: true, error: false, rows, me };
    } catch (err) {
      this.logSdkFailure('getLeaderboard', LEADERBOARD_ID, err);
      return { available: true, error: true, rows: [], me: null };
    }
  }

  /** Arka plan/ön plan yaşam döngüsü. Dönen unsubscribe fonksiyonlarını cleanup'ta çağır. */
  async onBackground(cb: () => void): Promise<() => void> {
    try {
      return (await extras.onBackground?.(cb)) ?? (() => {});
    } catch {
      return () => {};
    }
  }

  async onForeground(cb: () => void): Promise<() => void> {
    try {
      return (await extras.onForeground?.(cb)) ?? (() => {});
    } catch {
      return () => {};
    }
  }
}

/** Paylaşılan tekil servis. */
export const gametegra = new GametegraService();
