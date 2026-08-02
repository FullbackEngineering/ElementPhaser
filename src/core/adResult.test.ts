import { describe, it, expect } from 'vitest';
import { unwrapAdResult, isRewardEarned } from './adResult';

describe('unwrapAdResult', () => {
  it('SuperAppResponse zarfını açar (gerçek host şekli)', () => {
    const o = unwrapAdResult({
      onClientSuccess: true,
      onHostSuccess: true,
      errorMessage: null,
      data: { status: 'completed', reward: 1, adRequestId: 'req-1' }
    });
    expect(o).toMatchObject({ hostOk: true, status: 'completed', reward: 1, errorMessage: null });
  });

  it('düz ShowAdResult şeklini de okur (.d.ts şekli)', () => {
    const o = unwrapAdResult({ status: 'completed', reward: 2, adRequestId: 'req-2' });
    expect(o).toMatchObject({ hostOk: true, status: 'completed', reward: 2 });
  });

  it('host hatasını zarftan taşır', () => {
    const o = unwrapAdResult({ onHostSuccess: false, errorMessage: 'invalid_ad_key', data: null });
    expect(o).toMatchObject({ hostOk: false, status: undefined, reward: 0, errorMessage: 'invalid_ad_key' });
  });

  it('null/boş yanıtta patlamaz', () => {
    expect(unwrapAdResult(null)).toMatchObject({ hostOk: true, status: undefined, reward: 0 });
    expect(unwrapAdResult(undefined).reward).toBe(0);
  });

  it('string reward değerini sayıya çevirir', () => {
    expect(unwrapAdResult({ data: { reward: '5' }, onHostSuccess: true }).reward).toBe(5);
  });
});

describe('isRewardEarned', () => {
  const base = { hostOk: true, errorMessage: null, reward: 0, raw: null };

  it('completed → ödül', () => {
    expect(isRewardEarned({ ...base, status: 'completed' })).toBe(true);
  });

  it('reward > 0 → ödül (status farklı olsa bile)', () => {
    expect(isRewardEarned({ ...base, status: 'shown', reward: 1 })).toBe(true);
  });

  it('kapatıldı / doldurulamadı → ödül yok', () => {
    expect(isRewardEarned({ ...base, status: 'closed' })).toBe(false);
    expect(isRewardEarned({ ...base, status: 'noFill' })).toBe(false);
  });

  it('host hatası varsa ödül yok', () => {
    expect(isRewardEarned({ ...base, status: 'completed', hostOk: false })).toBe(false);
    expect(isRewardEarned({ ...base, status: 'completed', errorMessage: 'boom' })).toBe(false);
  });

  it('invalid_ad_key reddi → ödül yok', () => {
    const o = unwrapAdResult({ onHostSuccess: false, errorMessage: 'invalid_ad_key', data: null });
    expect(isRewardEarned(o)).toBe(false);
  });

  // Cihazda gözlemlenen gerçek yanıt (2026-07-24): host çağrıyı KABUL ediyor
  // (onHostSuccess:true, errorMessage:null) ama reklamı `invalid_placement` ile reddediyor.
  // Zarf "başarılı" göründüğü için ödül kararı yalnızca `data.status`'a bakmalı.
  it('host kabul etse de data.status=error ise ödül yok (invalid_placement)', () => {
    const o = unwrapAdResult({
      onClientSuccess: true,
      onHostSuccess: true,
      errorMessage: null,
      data: {
        status: 'error',
        adRequestId: '019f959d-b737-7d34-88a8-29cc4c4cce72',
        reward: null,
        viewDurationSeconds: null,
        errorCode: 'invalid_placement',
        debugInfo: { placement: 'game_over_revive' }
      }
    });
    expect(o).toMatchObject({ hostOk: true, status: 'error', reward: 0 });
    expect(isRewardEarned(o)).toBe(false);
  });
});
