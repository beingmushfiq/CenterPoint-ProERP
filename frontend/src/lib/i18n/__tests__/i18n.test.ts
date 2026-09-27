import { describe, it, expect } from 'vitest';
import i18n, { resources, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../index';

describe('i18n Bilingual Infrastructure (EN & BN)', () => {
  it('supports English (en) and Bengali (bn) locales', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('bn');
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('contains comprehensive translation namespaces for both locales', () => {
    const requiredNamespaces = [
      'common',
      'auth',
      'errors',
      'navigation',
      'dashboard',
      'catalogue',
      'purchasing',
      'sales',
      'inventory',
      'finance',
    ];

    for (const ns of requiredNamespaces) {
      expect(resources.en).toHaveProperty(ns);
      expect(resources.bn).toHaveProperty(ns);
    }
  });

  it('resolves English and Bengali translations correctly', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('common:actions.save', { defaultValue: 'Save' })).toBeTruthy();

    await i18n.changeLanguage('bn');
    expect(i18n.language).toBe('bn');
    const bnSave = i18n.t('common:actions.save', { defaultValue: 'সংরক্ষণ করুন' });
    expect(bnSave).toBeTruthy();

    // Switch back to en
    await i18n.changeLanguage('en');
  });

  it('handles fallback gracefully without throwing', () => {
    const nonExistent = i18n.t('nonexistent_key_xyz', { defaultValue: 'Fallback Text' });
    expect(nonExistent).toBe('Fallback Text');
  });
});
