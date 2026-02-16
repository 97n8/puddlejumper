import { test, expect } from '@playwright/test';

test.describe('Visual Snapshots - Admin UI', () => {
  test('Admin dashboard - Members tab with usage card', async ({ page }) => {
    await page.goto('/pj/admin');
    
    // Wait for auth gate or main content
    await page.waitForSelector('.tabs, #auth-gate', { timeout: 10000 });
    
    // If auth gate is shown, take snapshot of that state
    const authGate = await page.locator('#auth-gate').isVisible();
    if (authGate) {
      await expect(page).toHaveScreenshot('admin-auth-gate.png');
      return;
    }
    
    // Click Members tab
    await page.click('[data-tab="members"]');
    await page.waitForSelector('#usage-card', { timeout: 5000 });
    
    // Desktop snapshot
    await expect(page).toHaveScreenshot('admin-members-desktop.png', {
      fullPage: true,
    });
  });

  test('Admin dashboard - Upgrade modal', async ({ page }) => {
    await page.goto('/pj/admin');
    
    const authGate = await page.locator('#auth-gate').isVisible();
    if (authGate) {
      test.skip('Requires authentication');
      return;
    }
    
    // Navigate to Members tab
    await page.click('[data-tab="members"]');
    await page.waitForSelector('#usage-card');
    
    // Open upgrade modal
    const upgradeBtn = page.locator('#upgrade-btn');
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await page.waitForSelector('#upgrade-modal[style*="flex"]');
      
      await expect(page).toHaveScreenshot('admin-upgrade-modal.png');
    }
  });

  test('Admin dashboard - Invite modal', async ({ page }) => {
    await page.goto('/pj/admin');
    
    const authGate = await page.locator('#auth-gate').isVisible();
    if (authGate) {
      test.skip('Requires authentication');
      return;
    }
    
    // Navigate to Members tab
    await page.click('[data-tab="members"]');
    
    // Click invite button
    await page.click('button:has-text("Invite Member")');
    await page.waitForSelector('#invite-modal[style*="flex"]');
    
    await expect(page).toHaveScreenshot('admin-invite-modal.png');
  });

  test('Submission page', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('submission-page-desktop.png', {
      fullPage: true,
    });
  });
});

test.describe('Visual Snapshots - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Admin mobile - Members tab', async ({ page }) => {
    await page.goto('/pj/admin');
    
    const authGate = await page.locator('#auth-gate').isVisible();
    if (authGate) {
      await expect(page).toHaveScreenshot('admin-auth-gate-mobile.png');
      return;
    }
    
    await page.click('[data-tab="members"]');
    await page.waitForSelector('#usage-card');
    
    await expect(page).toHaveScreenshot('admin-members-mobile.png', {
      fullPage: true,
    });
  });

  test('Submission page mobile', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('submission-page-mobile.png', {
      fullPage: true,
    });
  });
});
