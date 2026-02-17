import { test, expect } from '@playwright/test';

test.describe('Visual Snapshots - Quick Start Guide', () => {
  test('Quick Start page renders with correct heading', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');

    // Verify the page loaded with correct title
    const heading = page.locator('header h1');
    await expect(heading).toHaveText('PuddleJumper');

    // Verify subtitle
    const subtitle = page.locator('.subtitle');
    await expect(subtitle).toContainText('Quick Start');

    // Verify skip link exists for accessibility
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeAttached();

    // Desktop snapshot
    await expect(page).toHaveScreenshot('quickstart-guide-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Quick Start page uses external stylesheet', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');

    // Verify no inline <style> tags (CSP compliance)
    const inlineStyles = await page.locator('style').count();
    expect(inlineStyles).toBe(0);

    // Verify external CSS link
    const cssLink = page.locator('link[rel="stylesheet"][href="/styles/pj-guide.css"]');
    await expect(cssLink).toBeAttached();
  });

  test('Quick Start page has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');

    // Verify banner landmark (header)
    const header = page.locator('header[role="banner"]');
    await expect(header).toBeVisible();

    // Verify main landmark
    const main = page.locator('main#main-content');
    await expect(main).toBeVisible();

    // Verify navigation with aria-label
    const nav = page.locator('nav[aria-label="Page navigation"]');
    await expect(nav).toBeVisible();

    // Verify sections have aria-labels
    const sections = page.locator('section[aria-label]');
    expect(await sections.count()).toBeGreaterThanOrEqual(4);
  });

  test('Quick Start cards grid renders all steps', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');

    const cards = page.locator('.qs-card');
    expect(await cards.count()).toBe(6);

    // Verify numbered steps
    const nums = page.locator('.qs-num');
    const texts = await nums.allTextContents();
    expect(texts).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

test.describe('Visual Snapshots - Quick Start Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Quick Start page mobile layout', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('quickstart-guide-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Snapshots - PL Launcher', () => {
  test('Launcher page renders with data-test attribute', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');

    // Verify launcher has data-test attribute
    const launcher = page.locator('[data-test="pl-launcher"]');
    await expect(launcher).toBeVisible();

    // Verify hero heading
    const heading = page.locator('h1');
    await expect(heading).toContainText('PuddleJumper');

    // Desktop snapshot
    await expect(page).toHaveScreenshot('pl-launcher-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Launcher feature cards are accessible', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');

    // Verify feature cards
    const featureCards = page.locator('.feature-card');
    expect(await featureCards.count()).toBe(3);

    // Verify icons are hidden from screen readers
    const icons = page.locator('.icon[aria-hidden="true"]');
    expect(await icons.count()).toBe(3);

    // Verify action links
    const actions = page.locator('.actions a');
    expect(await actions.count()).toBeGreaterThanOrEqual(2);
  });

  test('Launcher status section has live region', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');

    const status = page.locator('[role="status"][aria-live="polite"]');
    await expect(status).toBeVisible();
    await expect(status).toContainText('System operational');
  });
});

test.describe('Visual Snapshots - PL Launcher Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('Launcher page mobile layout', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');

    const launcher = page.locator('[data-test="pl-launcher"]');
    await expect(launcher).toBeVisible();

    await expect(page).toHaveScreenshot('pl-launcher-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
