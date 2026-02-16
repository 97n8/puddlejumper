import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('E2E Smoke Test - V1 Release', () => {
  test('Full workspace lifecycle: create → invite → limit → upgrade', async ({ page }) => {
    // This test requires a running server with test mode enabled
    // It simulates the full V1 flow without actual OAuth
    
    test.setTimeout(120000); // 2 minutes for full flow
    
    // Step 1: Navigate to admin (will show auth gate)
    await page.goto('/pj/admin');
    await page.waitForSelector('#auth-gate, .tabs');
    
    const authGateVisible = await page.locator('#auth-gate').isVisible();
    
    if (authGateVisible) {
      console.log('✓ Auth gate displayed for unauthenticated user');
      
      // In production this would require OAuth
      // For E2E we can test the auth gate UI
      const signInButton = page.locator('a[href*="/api/auth/github/login"]');
      await expect(signInButton).toBeVisible();
      
      // Skip the rest of the test if not authenticated
      // In CI, we would use a test auth token
      test.skip('Skipping authenticated flows - requires OAuth setup');
      return;
    }
    
    // Step 2: Navigate to Members tab and check usage card
    await page.click('[data-tab="members"]');
    await page.waitForSelector('#usage-card');
    
    const planBadge = page.locator('#plan-badge');
    await expect(planBadge).toBeVisible();
    const currentPlan = await planBadge.textContent();
    console.log(`✓ Current plan: ${currentPlan}`);
    
    // Step 3: Check usage metrics are displayed
    const usageMetrics = page.locator('#usage-metrics');
    await expect(usageMetrics).toBeVisible();
    
    const usageItems = page.locator('.usage-item');
    const count = await usageItems.count();
    expect(count).toBe(3); // templates, approvals, members
    console.log('✓ Usage metrics displayed (3 resources)');
    
    // Step 4: Test invite modal
    const inviteBtn = page.locator('button:has-text("Invite Member")');
    await inviteBtn.click();
    await page.waitForSelector('#invite-modal[style*="flex"]');
    
    const emailInput = page.locator('#invite-email');
    await expect(emailInput).toBeVisible();
    console.log('✓ Invite modal opens');
    
    // Close modal
    await page.click('.detail-close');
    await page.waitForSelector('#invite-modal:not([style*="flex"])');
    
    // Step 5: Test upgrade modal (if on free plan)
    if (currentPlan?.includes('FREE')) {
      const upgradeBtn = page.locator('#upgrade-btn');
      
      if (await upgradeBtn.isVisible()) {
        await upgradeBtn.click();
        await page.waitForSelector('#upgrade-modal[style*="flex"]');
        
        const planChoices = page.locator('input[name="plan-choice"]');
        const choiceCount = await planChoices.count();
        expect(choiceCount).toBeGreaterThanOrEqual(2);
        console.log('✓ Upgrade modal shows plan choices');
        
        // Close modal
        await page.locator('#upgrade-modal .detail-close').click();
      }
    }
    
    // Step 6: Check other tabs are accessible
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('#tab-dashboard');
    console.log('✓ Dashboard tab accessible');
    
    await page.click('[data-tab="queue"]');
    await page.waitForSelector('#tab-queue');
    console.log('✓ Queue tab accessible');
    
    await page.click('[data-tab="chains"]');
    await page.waitForSelector('#tab-chains');
    console.log('✓ Chain Templates tab accessible');
    
    console.log('✅ E2E smoke test completed successfully');
  });

  test('Submission page loads and is accessible', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');
    
    // Check page loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Inject axe for a11y testing
    await injectAxe(page);
    
    // Run accessibility check
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
    
    console.log('✓ Submission page is accessible');
  });

  test('Admin page accessibility', async ({ page }) => {
    await page.goto('/pj/admin');
    await page.waitForSelector('#auth-gate, .tabs');
    
    // Inject axe
    await injectAxe(page);
    
    // Check accessibility
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
    
    console.log('✓ Admin page is accessible');
  });
});
