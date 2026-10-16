import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@slicemart.com';

test.describe('AI Copilot Demonstration & Artifact Generation', () => {
  test('copilot demo walkthrough', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes timeout for complete walkthrough

    // 1. Authenticate with seeded demo credentials
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input#email, input[name="email"], input[type="text"]').first();
    const passwordInput = page.locator('input#password, input[name="password"], input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await submitBtn.click();

    // Wait for redirect to dashboard or workspace
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // 2. Navigate directly to Finance AI Copilot Workspace
    await page.goto('/finance?tab=copilot');
    await page.waitForLoadState('networkidle');

    // Verify Copilot header is visible
    await expect(page.locator('text=WeBank AI SME Finance Copilot').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // 3. Sequential Walkthrough of 6 Financial Decision Workflows
    const prompts = [
      'What is our current liquid cash position and runway days?',
      'List our top overdue customer invoices and aging buckets.',
      'Show our current profit and loss summary and operating margins.',
      'Analyze our cash flow deficit risk for the next 30 days.',
      'What is our current inventory valuation and holding cost?',
      'Match WeBank SME financing options to bridge working capital.',
    ];

    const textarea = page.locator('textarea[placeholder*="Ask financial question"], textarea').first();

    for (const prompt of prompts) {
      await textarea.fill(prompt);
      await page.keyboard.press('Enter');

      // Wait for assistant response bubble or interactive financial card
      await page.waitForTimeout(2200);
      await expect(
        page.locator('div.whitespace-pre-wrap').last()
      ).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1200);
    }

    // 4. Supervised Operational Mutation (Tier 2 Action)
    await textarea.fill('Create a cash flow alert for low liquidity');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);

    // Trigger Supervisor Authorization Modal
    const reviewBtn = page.locator('button:has-text("Review & Authorize Action")').first();
    if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reviewBtn.click();
      await page.waitForTimeout(1000);
    }

    const authorizeBtn = page.locator('button:has-text("Authorize & Execute")').first();
    if (await authorizeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorizeBtn.click();
      await page.waitForTimeout(2000);
    }

    // 5. Intelligent SME Financing Matcher & Instant Pre-Qualification
    const financingSubTab = page.locator('button:has-text("WeBank SME Financing")').first();
    await financingSubTab.click();
    await page.waitForTimeout(1500);

    const reEvaluateBtn = page.locator('button:has-text("Re-Evaluate Financing")').first();
    if (await reEvaluateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reEvaluateBtn.click();
      await page.waitForTimeout(2000);
    }

    const preQualifyBtn = page.locator('button:has-text("Instant Pre-Qualification")').first();
    if (await preQualifyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await preQualifyBtn.click();
      await page.waitForTimeout(1200);

      const confirmTransmitBtn = page.locator('button:has-text("Confirm & Transmit")').first();
      if (await confirmTransmitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmTransmitBtn.click();
        await page.waitForTimeout(2500);
      }
    }

    // 6. Showcase Liquidity Monitoring & Security Audit Trail
    const alertsSubTab = page.locator('button:has-text("Liquidity Alerts")').first();
    await alertsSubTab.click();
    await page.waitForTimeout(1500);

    const auditSubTab = page.locator('button:has-text("Security & Audit")').first();
    await auditSubTab.click();
    await page.waitForTimeout(1800);

    // Capture final summary screenshot
    await page.screenshot({ path: 'test-results/demo-final.png', fullPage: true });
  });

  test('export presentation deck and documentation to pdf', async ({ page }) => {
    const submissionDir = path.resolve(__dirname, '../../docs/submission');

    // 1. Presentation Deck
    const deckPath = path.resolve(__dirname, '../../docs/presentation/index.html');
    const deckPdf = path.join(submissionDir, 'presentation_deck.pdf');
    await page.goto(`file://${deckPath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.pdf({
      path: deckPdf,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    });

    // 2. Technical Documentation
    const techHtmlPath = path.join(submissionDir, 'technical_documentation.html');
    const techPdf = path.join(submissionDir, 'technical_documentation.pdf');
    await page.goto(`file://${techHtmlPath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.pdf({
      path: techPdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });

    // 3. Security Self-Assessment
    const secHtmlPath = path.join(submissionDir, 'security_self_assessment.html');
    const secPdf = path.join(submissionDir, 'security_self_assessment.pdf');
    await page.goto(`file://${secHtmlPath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.pdf({
      path: secPdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });
  });
});
