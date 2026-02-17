import { test, expect } from '@playwright/test';

test.describe('Quick Start Guide Smoke Test', () => {
  test('Quick Start guide page loads and displays heading', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');

    // Page title should contain Quick Start
    await expect(page).toHaveTitle(/Quick Start/);

    // Main heading should be visible
    const heading = page.locator('h2', { hasText: 'Quick Start' });
    await expect(heading.first()).toBeVisible();
  });

  test('Quick Start guide has navigation links', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');

    // Guide page should have nav links section
    const navLinks = page.locator('.nav-links');
    await expect(navLinks).toBeVisible();
  });

  test('Quick Start guide has systems map section', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');

    // Systems Map heading should exist
    const systemsMap = page.locator('h2', { hasText: 'Systems Map' });
    await expect(systemsMap).toBeVisible();
  });
});
