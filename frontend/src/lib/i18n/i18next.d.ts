// ═══════════════════════════════════════════════════════════════════════════
// i18next TYPE AUGMENTATION
// ───────────────────────────────────────────────────────────────────────────
// Makes `t('auth.signInTitle')` a compile-checked key rather than a stringly
// typed guess. The English module is the canonical shape; `bn.ts` already
// `satisfies` it, so both locales stay structurally identical and a typo in a
// call site fails `tsc` instead of rendering the raw key.
// ═══════════════════════════════════════════════════════════════════════════

import type en from './locales/en';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: (typeof en)['common'];
      auth: (typeof en)['auth'];
      errors: (typeof en)['errors'];
      navigation: (typeof en)['navigation'];
      reports: (typeof en)['reports'];
      dashboard: (typeof en)['dashboard'];
      validation: (typeof en)['validation'];
      notifications: (typeof en)['notifications'];
      printing: (typeof en)['printing'];
      platform: (typeof en)['platform'];
      storefront: (typeof en)['storefront'];
      catalogue: (typeof en)['catalogue'];
      production: (typeof en)['production'];
      inventory: (typeof en)['inventory'];
      purchasing: (typeof en)['purchasing'];
      sales: (typeof en)['sales'];
      pos: (typeof en)['pos'];
      logistics: (typeof en)['logistics'];
      finance: (typeof en)['finance'];
      hr: (typeof en)['hr'];
      qc: (typeof en)['qc'];
      assets: (typeof en)['assets'];
      settings: (typeof en)['settings'];
      documents: (typeof en)['documents'];
    };
  }
}
