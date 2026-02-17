import { test, expect } from '@playwright/test';

test.describe('Quick Start smoke', () => {
  test('Quick Start guide loads and shows heading', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveTitle(/Quick Start/);
    await expect(page.locator('h2', { hasText: 'Quick Start' }).first()).toBeVisible();
  });

  test('Quick Start has navigation links and systems map', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page.locator('.nav-links a').first()).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Systems Map' })).toBeVisible();
  });
});
