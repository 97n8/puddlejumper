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

test.describe("PRR Visual Snapshots", () => {
  test("PRR submission form", async ({ page }) => {
    await page.goto("/prr");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveScreenshot("prr-submission-form.png");
  });

  test("PRR submission success", async ({ page }) => {
    await page.goto("/prr");
    
    // Fill and submit
    await page.fill('input[name="submitter_name"]', "Visual Test");
    await page.fill('input[name="submitter_email"]', "visual@test.com");
    await page.fill('input[name="summary"]', "Visual regression test");
    await page.fill('textarea[name="details"]', "Testing snapshot capture");
    await page.click('button[type="submit"]');
    
    // Wait for success state
    await expect(page.locator("#success-message")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveScreenshot("prr-submission-success.png");
  });

  test("PRR status page", async ({ page }) => {
    // Mock PRR token in URL
    await page.goto("/prr-status");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveScreenshot("prr-status-page.png");
  });

  test("Admin PRR queue", async ({ page }) => {
    await page.goto("/pj/admin");
    
    // Mock session
    await page.evaluate(() => {
      localStorage.setItem("pj_session", JSON.stringify({
        user_id: "snapshot-user",
        workspace_id: "snapshot-workspace",
        role: "admin"
      }));
    });
    await page.reload();
    
    // Switch to PRR tab
    await page.click('[data-tab="prr"]');
    await expect(page.locator("#tab-prr")).toBeVisible();
    await page.waitForTimeout(1000); // Allow queue to load
    
    await expect(page).toHaveScreenshot("admin-prr-queue.png");
  });

  test("Admin PRR detail modal", async ({ page }) => {
    await page.goto("/pj/admin");
    
    await page.evaluate(() => {
      localStorage.setItem("pj_session", JSON.stringify({
        user_id: "snapshot-user",
        workspace_id: "snapshot-workspace",
        role: "admin"
      }));
    });
    await page.reload();
    
    await page.click('[data-tab="prr"]');
    await page.waitForTimeout(1000);
    
    // Open detail if PRR exists
    const viewButton = page.locator('button:has-text("View")').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await expect(page.locator("#prr-detail-overlay")).toBeVisible();
      await expect(page).toHaveScreenshot("admin-prr-detail.png");
    }
  });
});
