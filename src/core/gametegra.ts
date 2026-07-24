import { gameTegra, type ShowAdResult, type SuperAppResponse } from '@gametegra/sdk';

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

export interface LeaderboardRow {
  rank: number;
  score: number;
  isMe: boolean;
}
export interface LeaderboardView {
  /** Host bridge (SuperApp) yoksa false → UI "SuperApp içinde görünür" mesajı gösterir. */
  available: boolean;
  rows: LeaderboardRow[];
  /** Oyuncunun kendi kaydı (top listede olmasa bile), yoksa null. */
  me: LeaderboardRow | null;
}

interface RawRecord {
  score: number | string;
  owner_id?: string | number;
  rank?: number | string;
}

class GametegraService {
  private initialized = false;
  private hostReady = false;
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
    try {
      await withTimeout(gameTegra.waitUntilReady(), CALL_TIMEOUT_MS);
      this.hostReady = true;
    } catch {
      this.hostReady = false; // host bridge yok — normal (dev/tarayıcı)
    }
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
    if (!this.hostReady) return this.mockAdReward;
    try {
      const res: ShowAdResult = await withTimeout(
        gameTegra.showAd({ placement: 'rewarded', adKey, metadata: { placement: placementKey } }),
        AD_TIMEOUT_MS
      );
      return res.status === 'completed' || (typeof res.reward === 'number' && res.reward > 0);
    } catch {
      return false;
    }
  }

  /** Geçiş reklamı (interstitial) gösterir, sonucu önemsemez — oyuncuyu asla kilitleme. */
  async showInterstitialAd(adKey: string, placementKey: string): Promise<void> {
    if (!this.hostReady) return; // host yok → reklam yok, bekletme
    try {
      await withTimeout(
        gameTegra.showAd({ placement: 'interstitial', adKey, metadata: { placement: placementKey } }),
        AD_TIMEOUT_MS
      );
    } catch {
      /* reklam gösterilemedi — sessizce devam */
    }
  }

  /** Kayıtlı en yüksek skoru okur (yoksa/host yoksa null). */
  async loadHighScore(): Promise<number | null> {
    try {
      const res = await withTimeout(gameTegra.loadData({ key: HIGHSCORE_KEY }), CALL_TIMEOUT_MS);
      const entry = extractLoadDataEntry(res);
      return entry ? parseStoredScore(entry.value) : null;
    } catch {
      return null;
    }
  }

  /** En yüksek skoru kalıcı olarak kaydeder (fire-and-forget güvenli). */
  async saveHighScore(score: number): Promise<void> {
    try {
      await withTimeout(
        gameTegra.saveData({ key: HIGHSCORE_KEY, value: { score, savedAt: new Date().toISOString() } }),
        CALL_TIMEOUT_MS
      );
    } catch {
      /* kaydedilemedi — bir sonraki oyunda tekrar denenir */
    }
  }

  /**
   * Skoru leaderboard'a gönderir; tabloyu okuyup en üstteki { score, isMe } döner.
   * Host yoksa null. createLeaderboard idempotent denenir (zaten varsa yoksayılır).
   */
  async submitAndReadLeaderboard(score: number): Promise<{ score: number; isMe: boolean } | null> {
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

    let myOwnerId: string | null = null;
    try {
      const updateRes = (await withTimeout(
        gameTegra.updateLeaderboard({ id: LEADERBOARD_ID, score }),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ owner_id?: string | number }>;
      myOwnerId = updateRes?.data?.owner_id != null ? String(updateRes.data.owner_id) : null;
    } catch {
      return null;
    }

    try {
      const lbRes = (await withTimeout(
        gameTegra.getLeaderboard({ id: LEADERBOARD_ID, limit: 10 }),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ records?: Array<{ score: number | string; owner_id?: string | number }> }>;
      const top = lbRes?.data?.records?.[0];
      if (!top) return null;
      const isMe = myOwnerId != null && String(top.owner_id) === myOwnerId;
      return { score: Number(top.score), isMe };
    } catch {
      return null;
    }
  }

  /**
   * Liderlik tablosunu okur (top `limit` + oyuncunun kendi kaydı). Host yoksa
   * `available:false` döner. Leaderboard idempotent oluşturulmaya çalışılır.
   */
  async fetchLeaderboard(limit = 10): Promise<LeaderboardView> {
    if (!this.hostReady) return { available: false, rows: [], me: null };

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
      /* muhtemelen zaten var */
    }

    try {
      const res = (await withTimeout(
        gameTegra.getLeaderboard({ id: LEADERBOARD_ID, limit }),
        CALL_TIMEOUT_MS
      )) as SuperAppResponse<{ records?: RawRecord[]; owner_records?: RawRecord[] }>;

      const records = res?.data?.records ?? [];
      const ownerRec = res?.data?.owner_records?.[0];
      const myOwnerId = ownerRec?.owner_id != null ? String(ownerRec.owner_id) : null;

      const rows: LeaderboardRow[] = records.map((r, i) => ({
        rank: r.rank != null ? Number(r.rank) : i + 1,
        score: Number(r.score),
        isMe: myOwnerId != null && String(r.owner_id) === myOwnerId
      }));

      const me: LeaderboardRow | null = ownerRec
        ? {
            rank: ownerRec.rank != null ? Number(ownerRec.rank) : 0,
            score: Number(ownerRec.score),
            isMe: true
          }
        : null;

      return { available: true, rows, me };
    } catch {
      return { available: true, rows: [], me: null };
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
