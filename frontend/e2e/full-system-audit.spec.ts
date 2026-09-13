import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'Mobile 320px', width: 320, height: 600 },
  { name: 'Mobile 375px', width: 375, height: 667 },
  { name: 'Tablet 768px', width: 768, height: 1024 },
  { name: 'Desktop 1024px', width: 1024, height: 768 },
  { name: 'Wide Desktop 1440px', width: 1440, height: 900 },
];

const TENANT_ROUTES = [
  '/dashboard',
  '/catalogue',
  '/production',
  '/qc',
  '/inventory',
  '/purchasing',
  '/sales',
  '/pos',
  '/logistics',
  '/finance',
  '/assets',
  '/hr',
  '/reports',
  '/settings',
  '/settings/bin',
  '/storefront/builder',
];

const PLATFORM_ROUTES = [
  '/platform',
  '/platform/tenants',
  '/platform/plans',
  '/platform/payments',
  '/platform/audit-logs',
  '/platform/errors',
  '/platform/feature-flags',
  '/platform/announcements',
  '/platform/support',
  '/platform/admins',
  '/platform/settings',
];

const PUBLIC_STOREFRONT_ROUTES = [
  '/store',
  '/store/products',
  '/store/checkout',
  '/store/track',
  '/store/account',
  '/login',
  '/platform/login',
];

test.describe('Comprehensive Full System Responsive Audit', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test.describe('Public & Storefront Routes', () => {
        for (const route of PUBLIC_STOREFRONT_ROUTES) {
          test(`zero overflow on ${route}`, async ({ page }) => {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);

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
              `Route ${route} overflowed at ${vp.width}px: scrollWidth=${overflow.docWidth}, innerWidth=${overflow.winWidth}`
            ).toBe(false);
          });
        }
      });

      test.describe('Tenant ERP Routes', () => {
        test.beforeEach(async ({ page }) => {
          // Seed localStorage with mock authenticated tenant session
          await page.addInitScript(() => {
            localStorage.setItem('access_token', 'mock_jwt_token');
            localStorage.setItem(
              'auth_user',
              JSON.stringify({
                id: 'usr_test_1',
                email: 'admin@slicemart.test',
                name: 'Test Administrator',
                role: 'admin',
              })
            );
            localStorage.setItem(
              'auth_tenant',
              JSON.stringify({
                id: 'ten_test_1',
                name: 'SliceMart Test Co',
                slug: 'slicemart',
              })
            );
            localStorage.setItem('auth_permissions', JSON.stringify(['*']));
            localStorage.setItem(
              'auth_branches',
              JSON.stringify([
                { id: 1, name: 'Main Plant', is_headquarters: true },
              ])
            );
            localStorage.setItem(
              'auth_active_branch',
              JSON.stringify({ id: 1, name: 'Main Plant', is_headquarters: true })
            );
          });
        });

        for (const route of TENANT_ROUTES) {
          test(`zero overflow on ${route}`, async ({ page }) => {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);

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
              `Tenant route ${route} overflowed at ${vp.width}px: scrollWidth=${overflow.docWidth}, innerWidth=${overflow.winWidth}`
            ).toBe(false);
          });
        }
      });

      test.describe('Platform Master SaaS Routes', () => {
        test.beforeEach(async ({ page }) => {
          // Seed localStorage with mock platform super admin session
          await page.addInitScript(() => {
            localStorage.setItem('platform_access_token', 'mock_platform_token');
          });
        });

        for (const route of PLATFORM_ROUTES) {
          test(`zero overflow on ${route}`, async ({ page }) => {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);

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
              `Platform route ${route} overflowed at ${vp.width}px: scrollWidth=${overflow.docWidth}, innerWidth=${overflow.winWidth}`
            ).toBe(false);
          });
        }
      });
    });
  }
});
