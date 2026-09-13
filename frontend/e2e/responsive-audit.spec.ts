import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Mobile 320px', width: 320, height: 568 },
  { name: 'Mobile 375px', width: 375, height: 667 },
  { name: 'Mobile 390px', width: 390, height: 844 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1024px', width: 1024, height: 768 },
  { name: 'Wide Desktop 1440px', width: 1440, height: 900 },
];

const ROUTES_TO_AUDIT = [
  '/store',
  '/store/products',
  '/store/checkout',
  '/login',
];

test.describe('Responsive System & Zero-Overflow Audit', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES_TO_AUDIT) {
        test(`zero horizontal overflow on ${route}`, async ({ page }) => {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(500);

          // Verify no horizontal overflow beyond viewport width
          const overflow = await page.evaluate(() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return {
              docWidth,
              winWidth,
              hasOverflow: docWidth > winWidth,
            };
          });

          expect(
            overflow.hasOverflow,
            `Expected ${route} at ${vp.width}px to have no horizontal overflow (docWidth=${overflow.docWidth}, winWidth=${overflow.winWidth})`
          ).toBe(false);
        });
      }
    });
  }
});
