import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Host sözleşmesi doğrulaması — `GametegraService`'i SAHTE bir host'a karşı uçtan uca sürer.
 *
 * Neden bu test var: `adResult.test.ts` sadece saf yorumlama fonksiyonlarını kapsıyor; bu dosya
 * asıl riskli kısmı ölçüyor — **host'a hangi parametrelerin gittiği** ve **gerçek yanıt şeklinin
 * doğru okunduğu**. SDK'nın `index.d.ts`'i sözleşmeyi yanlış anlattığı için typecheck yeşilken
 * reklam ölü olabiliyor (bkz. gametegra-ads skill, known-issues #7/#8) — tip kontrolü bu sınıfı
 * korumuyor, bu test koruyor.
 *
 * Buradaki yanıt gövdeleri uydurma değil: gerçek cihazdan/`gametegra-sdk-demo` panelinden
 * yakalanmış şekiller (skorlar `records[].score` alanında STRING gelir, karar `data.status`'ta).
 */

const host = vi.hoisted(() => ({
  superapp: {} as unknown,
  waitUntilReady: vi.fn(),
  showAd: vi.fn(),
  createLeaderboard: vi.fn(),
  updateLeaderboard: vi.fn(),
  getLeaderboard: vi.fn(),
  loadData: vi.fn(),
  saveData: vi.fn(),
  getUserInfo: vi.fn(),
  vibrate: vi.fn(),
  reportEvent: vi.fn(),
  devConsole: { show: vi.fn(), warn: vi.fn() }
}));

vi.mock('@gametegra/sdk', () => ({ gameTegra: host }));

/** Servis singleton state tuttuğu için her test taze bir modül örneği alır. */
async function freshService() {
  vi.resetModules();
  return (await import('./gametegra')).gametegra;
}

/** Host'un gerçek zarfı — `onHostSuccess` "çağrı ulaştı" demek, "reklam oynadı" DEĞİL. */
const envelope = (data: unknown, errorMessage: string | null = null) => ({
  onClientSuccess: true,
  onHostSuccess: true,
  errorMessage,
  data
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear(); // owner_id cache'i testler arasında sızmasın
  host.superapp = {};
  host.waitUntilReady.mockResolvedValue({ ready: true });
  host.getUserInfo.mockResolvedValue(envelope({ name: 'Mahmut', surname: 'Çiftçi', email: 'x@y.z', age: null }));
  host.vibrate.mockResolvedValue(envelope({}));
  host.reportEvent.mockResolvedValue(envelope({}));
});

describe('showAd — host\'a giden parametreler', () => {
  it('placement whitelist değeri gönderir, oyun içi slot etiketini metadata\'ya taşır', async () => {
    host.showAd.mockResolvedValue(envelope({ status: 'completed', reward: 1 }));
    const svc = await freshService();

    await svc.showRewardedAd('revive', 'game_over_revive');

    expect(host.showAd).toHaveBeenCalledTimes(1);
    expect(host.showAd).toHaveBeenCalledWith(
      expect.objectContaining({
        placement: 'miniapp_open', // host whitelist'i — slot adı buraya YAZILMAZ
        adType: 'rewarded', // .d.ts bu alanı bilmiyor ama host zorunlu tutuyor
        adKey: 'revive',
        showLoading: true,
        metadata: { placement: 'game_over_revive' }
      })
    );
  });

  it('interstitial doğru adType ile gider ve mini-app ID göndermez', async () => {
    host.showAd.mockResolvedValue(envelope({ status: 'completed' }));
    const svc = await freshService();

    await svc.showInterstitialAd('retry', 'game_over_retry');

    const params = host.showAd.mock.calls[0][0] as Record<string, unknown>;
    expect(params.adType).toBe('interstitial');
    expect(params.adKey).toBe('retry');
    expect(params).not.toHaveProperty('miniGameId'); // host session'dan çözüyor
    expect(params).not.toHaveProperty('miniAppId');
  });
});

describe('showAd — ödül kararı gerçek yanıt şekilleri üzerinden', () => {
  it('completed → ödül verilir', async () => {
    host.showAd.mockResolvedValue(envelope({ status: 'completed', reward: 1, adRequestId: 'r-1' }));
    const svc = await freshService();
    expect(await svc.showRewardedAd('revive', 'game_over_revive')).toBe(true);
  });

  // Cihazda yakalanan asıl tuzak: zarf "başarılı" görünür, reklam hiç oynamamıştır.
  it('invalid_placement reddi → zarf başarılı görünse bile ödül YOK', async () => {
    host.showAd.mockResolvedValue(
      envelope({ status: 'error', errorCode: 'invalid_placement', reward: null, adRequestId: 'r-2' })
    );
    const svc = await freshService();
    expect(await svc.showRewardedAd('revive', 'game_over_revive')).toBe(false);
    expect(host.devConsole.warn).toHaveBeenCalled(); // sebep cihazda görünür olmalı
  });

  it('noFill → ödül yok (kod hatası değil, akış devam eder)', async () => {
    host.showAd.mockResolvedValue(envelope({ status: 'noFill', errorCode: 'noFill' }));
    const svc = await freshService();
    expect(await svc.showRewardedAd('revive', 'game_over_revive')).toBe(false);
  });

  // Logun tek işi sebebi taşımak; `JSON.stringify(new Error(...))` bunu "{}" yapıyordu.
  it('timeout/exception logu hata metnini taşır', async () => {
    host.showAd.mockRejectedValue(new Error('gametegra: timeout'));
    const svc = await freshService();

    await svc.showRewardedAd('revive', 'game_over_revive');

    expect(host.devConsole.warn).toHaveBeenCalledWith(expect.stringContaining('timeout'));
  });
});

describe('reklam oyuncuyu asla kilitlemez', () => {
  it('host reject ederse fırlatmaz, false döner', async () => {
    host.showAd.mockRejectedValue(new Error('bridge down'));
    const svc = await freshService();
    await expect(svc.showRewardedAd('revive', 'game_over_revive')).resolves.toBe(false);
  });

  it('beklenmedik yanıt tipinde bile fırlatmaz', async () => {
    host.showAd.mockResolvedValue('beklenmedik');
    const svc = await freshService();
    await expect(svc.showRewardedAd('revive', 'game_over_revive')).resolves.toBe(false);
  });

  // Log katmanı fırlatırsa revive overlay'i "yükleniyor"da donuyor ve fizik duraklatılmış
  // kalıyordu — yani tanı kodu oyunu kilitliyordu.
  it('serileştirilemeyen yanıtta bile karar döner (overlay donmaz)', async () => {
    const data: Record<string, unknown> = { status: 'error', errorCode: 'weird' };
    data.self = data;
    host.showAd.mockResolvedValue(envelope(data));
    const svc = await freshService();

    await expect(svc.showRewardedAd('revive', 'game_over_revive')).resolves.toBe(false);
  });

  it('interstitial başarısız olsa da resolve eder (retry akışı akmaya devam eder)', async () => {
    host.showAd.mockRejectedValue(new Error('boom'));
    const svc = await freshService();
    await expect(svc.showInterstitialAd('retry', 'game_over_retry')).resolves.toBeUndefined();
  });

  it('bridge yokken (düz tarayıcı) beklemeden false döner, showAd hiç çağrılmaz', async () => {
    host.superapp = null;
    const svc = await freshService();
    expect(await svc.showRewardedAd('revive', 'game_over_revive')).toBe(false);
    expect(host.showAd).not.toHaveBeenCalled();
  });
});

// Tuzak #2: boot'taki tek deneme soğuk WebView'de timeout'a düşerse reklam tüm oturum boyunca
// ölü kalıyordu. Reklam anında tekrar denenmeli.
describe('host hazırlığı — soğuk WebView\'den kurtarma', () => {
  it('boot\'ta waitUntilReady başarısızsa reklam anında yeniden dener', async () => {
    host.waitUntilReady.mockRejectedValueOnce(new Error('cold webview')).mockResolvedValue({ ready: true });
    host.showAd.mockResolvedValue(envelope({ status: 'completed', reward: 1 }));
    const svc = await freshService();

    await svc.init(); // soğuk açılış — burada host'a bağlanamıyor

    expect(await svc.showRewardedAd('revive', 'game_over_revive')).toBe(true);
    expect(host.waitUntilReady).toHaveBeenCalledTimes(2); // ikinci şans kullanıldı
  });
});

describe('leaderboard — gerçek host kayıt şekli', () => {
  // Gerçek host `records[].score`'u STRING döndürüyor; owner eşleşmesi owner_id ile yapılır.
  // İsim host şemasında yok → kendi gönderdiğimiz metadata'dan geri okunur.
  const records = [
    { score: '1200', owner_id: 'u-9', rank: '1', metadata: { name: 'Zeynep' } },
    { score: '800', owner_id: 'u-42', rank: '2', metadata: { name: 'Mahmut Ç.' } }
  ];

  it('skoru adla birlikte gönderir ve zirvedeki kaydı sayıya çevirerek okur', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42', rank: 2 }));
    host.getLeaderboard.mockResolvedValue(envelope({ records }));
    const svc = await freshService();

    const top = await svc.submitAndReadLeaderboard(800);

    expect(host.updateLeaderboard).toHaveBeenCalledWith({
      id: 'highscore',
      score: 800,
      metadata: { name: 'Mahmut Ç.' } // ad + soyad baş harfi
    });
    expect(top).toEqual({ score: 1200, isMe: false, name: 'Zeynep' });
  });

  it('zirvedeki kayıt oyuncunun kendisiyse isMe true', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-9' }));
    host.getLeaderboard.mockResolvedValue(envelope({ records }));
    const svc = await freshService();

    expect(await svc.submitAndReadLeaderboard(1200)).toEqual({ score: 1200, isMe: true, name: 'Zeynep' });
  });

  it('leaderboard zaten varsa create hatası akışı durdurmaz ve sahte alarm üretmez', async () => {
    host.createLeaderboard.mockRejectedValue(new Error('already exists'));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope({ records }));
    const svc = await freshService();

    expect(await svc.submitAndReadLeaderboard(800)).toEqual({ score: 1200, isMe: false, name: 'Zeynep' });
    expect(host.devConsole.warn).not.toHaveBeenCalled(); // "zaten var" beklenen yol, hata değil
  });

  // Sessiz yutma bu akışta "skorum tabloya girmiyor" şikayetini teşhis edilemez yapıyordu.
  it('skor gönderimi patlarsa cihazda görünür şekilde loglanır', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockRejectedValue(new Error('rate limited'));
    const svc = await freshService();

    expect(await svc.submitAndReadLeaderboard(800)).toBeNull();
    expect(host.devConsole.warn).toHaveBeenCalledWith(expect.stringContaining('rate limited'));
  });

  it('bridge yokken host\'a hiç çağrı yapmaz (düz tarayıcıda 16sn boş bekleme yok)', async () => {
    host.superapp = null;
    const svc = await freshService();

    expect(await svc.submitAndReadLeaderboard(800)).toBeNull();
    expect(host.createLeaderboard).not.toHaveBeenCalled();
    expect(host.updateLeaderboard).not.toHaveBeenCalled();
  });

  // Tuzak #2 leaderboard tarafında da geçerli: boot'taki tek deneme yeterli değil.
  it('boot\'ta ready başarısızsa skor gönderiminde yeniden dener', async () => {
    host.waitUntilReady.mockRejectedValueOnce(new Error('cold')).mockResolvedValue({ ready: true });
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope({ records }));
    const svc = await freshService();
    await svc.init();

    expect(await svc.submitAndReadLeaderboard(800)).toEqual({ score: 1200, isMe: false, name: 'Zeynep' });
    expect(host.waitUntilReady).toHaveBeenCalledTimes(2);
  });
});

describe('leaderboard — oyuncu adı', () => {
  const namedRecords = {
    records: [
      { score: '1200', owner_id: 'u-9', rank: '1', metadata: { name: 'Zeynep' } },
      { score: '800', owner_id: 'u-42', rank: '2', metadata: { name: 'Mahmut Ç.' } }
    ]
  };

  it('satırlarda isim döner', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.getLeaderboard.mockResolvedValue(envelope(namedRecords));
    const svc = await freshService();

    expect((await svc.fetchLeaderboard(10)).rows.map((r) => r.name)).toEqual(['Zeynep', 'Mahmut Ç.']);
  });

  it('e-posta ve tam soyadı asla gönderilmez (satırı diğer oyuncular görüyor)', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope(namedRecords));
    const svc = await freshService();

    await svc.submitAndReadLeaderboard(800);

    const sent = JSON.stringify(host.updateLeaderboard.mock.calls[0][0]);
    expect(sent).not.toContain('@');
    expect(sent).not.toContain('Çiftçi');
  });

  it('host isim vermezse boş döner (UI "Oyuncu" gösterir), akış kırılmaz', async () => {
    host.getUserInfo.mockRejectedValue(new Error('not supported'));
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-1' }));
    host.getLeaderboard.mockResolvedValue(envelope({ records: [{ score: '10', owner_id: 'u-1' }] }));
    const svc = await freshService();

    expect(await svc.submitAndReadLeaderboard(10)).toEqual({ score: 10, isMe: true, name: '' });
    expect(host.updateLeaderboard).toHaveBeenCalledWith({ id: 'highscore', score: 10 }); // boş metadata yok
  });

  it('çok uzun isim satıra sığacak şekilde kısaltılır', async () => {
    host.getUserInfo.mockResolvedValue(envelope({ name: 'Abdurrahmanoğlu Muhammed' }));
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-1' }));
    host.getLeaderboard.mockResolvedValue(envelope({ records: [{ score: '10', owner_id: 'u-1' }] }));
    const svc = await freshService();

    await svc.submitAndReadLeaderboard(10);

    const sentName = (host.updateLeaderboard.mock.calls[0][0] as { metadata: { name: string } }).metadata.name;
    expect(sentName).toBe('Abdurrahmanoğ…');
    expect(sentName.length).toBeLessThanOrEqual(14);
  });

  it('isim bir kez çözülür, sonraki oyunlarda getUserInfo tekrar çağrılmaz', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope(namedRecords));
    const svc = await freshService();

    await svc.submitAndReadLeaderboard(800);
    await svc.submitAndReadLeaderboard(900);

    expect(host.getUserInfo).toHaveBeenCalledTimes(1);
  });
});

describe('leaderboard — tablo görünümü', () => {
  it('satırları sıralar, owner_records ile kendi kaydını işaretler', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.getLeaderboard.mockResolvedValue(
      envelope({
        records: [
          { score: '1200', owner_id: 'u-9', rank: '1' },
          { score: '800', owner_id: 'u-42', rank: '2' }
        ],
        owner_records: [{ score: '800', owner_id: 'u-42', rank: '2' }]
      })
    );
    const svc = await freshService();

    const view = await svc.fetchLeaderboard(10);

    expect(view.available).toBe(true);
    expect(view.rows).toEqual([
      { rank: 1, score: 1200, isMe: false, name: '' },
      { rank: 2, score: 800, isMe: true, name: '' }
    ]);
    expect(view.me).toEqual({ rank: 2, score: 800, isMe: true, name: '' });
  });

  it('rank alanı gelmezse liste sırasına düşer', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.getLeaderboard.mockResolvedValue(envelope({ records: [{ score: '50', owner_id: 'u-1' }] }));
    const svc = await freshService();

    expect((await svc.fetchLeaderboard(10)).rows[0]).toEqual({ rank: 1, score: 50, isMe: false, name: '' });
  });

  it('bridge yoksa available:false (UI "SuperApp içinde görünür" der)', async () => {
    host.superapp = null;
    const svc = await freshService();

    expect(await svc.fetchLeaderboard(10)).toEqual({ available: false, error: false, rows: [], me: null });
    expect(host.getLeaderboard).not.toHaveBeenCalled();
  });

  // Hata "boş tablo" gibi görünürse oyuncuya "ilk rekoru sen kır" denir — yanlış bilgi.
  it('okuma patlarsa error:true döner ve cihazda loglanır', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.getLeaderboard.mockRejectedValue(new Error('server error'));
    const svc = await freshService();

    expect(await svc.fetchLeaderboard(10)).toEqual({ available: true, error: true, rows: [], me: null });
    expect(host.devConsole.warn).toHaveBeenCalled();
  });
});

// `owner_records` dokümante ama cihazda doğrulanmadı. Kendi kimliğimizin tek doğrulanmış
// kaynağı `updateLeaderboard` yanıtı — host bu alanı hiç döndürmese de tablo doğru işaretlenmeli.
describe('leaderboard — kimlik tespiti owner_records olmadan da çalışır', () => {
  const recordsWithoutOwnerBlock = {
    records: [
      { score: '1200', owner_id: 'u-9', rank: '1' },
      { score: '800', owner_id: 'u-42', rank: '2' }
    ]
  };

  it('skor gönderiminde yakalanan owner_id ile kendi satırını işaretler', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope(recordsWithoutOwnerBlock));
    const svc = await freshService();

    await svc.submitAndReadLeaderboard(800);
    const view = await svc.fetchLeaderboard(10);

    expect(view.rows.map((r) => r.isMe)).toEqual([false, true]);
    expect(view.me).toEqual({ rank: 2, score: 800, isMe: true, name: 'Mahmut Ç.' });
  });

  it('kimlik oturumlar arası saklanır (menüden doğrudan açılan tabloda da doğru)', async () => {
    host.createLeaderboard.mockResolvedValue(envelope({ success: true }));
    host.updateLeaderboard.mockResolvedValue(envelope({ owner_id: 'u-42' }));
    host.getLeaderboard.mockResolvedValue(envelope(recordsWithoutOwnerBlock));
    await (await freshService()).submitAndReadLeaderboard(800);

    const nextSession = await freshService(); // uygulama yeniden açıldı

    expect((await nextSession.fetchLeaderboard(10)).rows[1].isMe).toBe(true);
  });
});

describe('highscore — loadData yanıtı array ya da tek obje olabilir (known-issues #0)', () => {
  it('array şeklini okur', async () => {
    host.loadData.mockResolvedValue(envelope({ data: [{ key: 'highscore', value: { score: 1500 } }] }));
    const svc = await freshService();
    expect(await svc.loadHighScore()).toBe(1500);
  });

  it('tek obje şeklini de okur (gerçek host bunu döndürüyor)', async () => {
    host.loadData.mockResolvedValue(envelope({ data: { key: 'highscore', value: { score: 1500 } } }));
    const svc = await freshService();
    expect(await svc.loadHighScore()).toBe(1500);
  });

  it('kayıt yoksa null döner', async () => {
    host.loadData.mockResolvedValue(envelope({ data: null }));
    const svc = await freshService();
    expect(await svc.loadHighScore()).toBeNull();
  });
});
