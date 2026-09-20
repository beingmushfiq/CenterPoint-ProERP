// ═══════════════════════════════════════════════════════════════════════════
// VITEST SETUP — global test environment
// ───────────────────────────────────────────────────────────────────────────
// Loaded once per test file via `vitest.config.ts` → `test.setupFiles`.
//
// Only genuinely global concerns belong here. Per-suite fakes stay in the
// suite that needs them, so a test never depends on a mock it cannot see.
// ═══════════════════════════════════════════════════════════════════════════

import '@testing-library/jest-dom';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import '../lib/i18n';

expect.extend(matchers);

/* jsdom does not reset the document between test files in the same worker.
   Without this, a component left mounted by one test is still in the DOM for
   the next, and `getByRole` starts matching the wrong element. */
afterEach(() => {
  cleanup();
});

/* jsdom implements neither `matchMedia` nor `ResizeObserver`. Both are read at
   module scope by the motion layer (`prefersReducedMotion`) and by virtualised
   tables, so an absent stub is a `TypeError` at import time rather than a
   failed assertion — which makes the real failure very hard to find.

   `matches: false` is the deliberate default: it means tests exercise the
   full-motion path, which is the one with animations, timers and exit
   transitions that can actually break. */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
