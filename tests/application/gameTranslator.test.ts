import { describe, expect, it } from 'vitest';
import {
  createTranslator,
  farmActionLabel,
  farmStepCopy,
  localeForLanguage,
  resolveItemLabel,
} from '../../src/application/i18n/gameTranslator.js';

describe('game translator', () => {
  it('formats Vietnamese and English strings from the same typed keys', () => {
    const vi = createTranslator('vi');
    const en = createTranslator('en');

    expect(vi('common.day', { day: 4 })).toBe('Ngày 4');
    expect(en('common.day', { day: 4 })).toBe('Day 4');
    expect(vi('shop.feedback.sold', { item: 'Củ cải', coins: 35 })).toBe(
      'Đã bán Củ cải · +35 xu',
    );
    expect(en('shop.feedback.sold', { item: 'Turnip', coins: 35 })).toBe(
      'Sold Turnip · +35 coins',
    );
  });

  it('localizes tutorial actions, objectives and catalog item identities', () => {
    const vi = createTranslator('vi');
    const en = createTranslator('en');

    expect(farmActionLabel(vi, 'next_day')).toBe('Ngủ qua ngày');
    expect(farmActionLabel(en, 'next_day')).toBe('Sleep');
    expect(farmStepCopy(vi, 'harvest').title).toBe(
      'Thu hoạch củ cải đã chín',
    );
    expect(farmStepCopy(en, 'harvest').title).toBe(
      'Harvest the mature turnip',
    );
    expect(resolveItemLabel('vi', 'tool.watering-can', 'Watering Can')).toBe(
      'Bình tưới',
    );
    expect(resolveItemLabel('en', 'tool.watering-can', 'Watering Can')).toBe(
      'Watering Can',
    );
  });

  it('uses stable browser locales for number formatting', () => {
    expect(localeForLanguage('vi')).toBe('vi-VN');
    expect(localeForLanguage('en')).toBe('en-US');
  });
});
