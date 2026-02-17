import { test, expect } from '@playwright/test';

test.describe('Quick Start guide page', () => {
  test('guide page loads with correct title', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page).toHaveTitle(/Quick Start/);
  });

  test('guide page has Quick Start heading', async ({ page }) => {
    await page.goto('/pj/guide');
    const heading = page.locator('h2', { hasText: 'Quick Start' });
    await expect(heading).toBeVisible();
  });

  test('guide page has Systems Map heading', async ({ page }) => {
    await page.goto('/pj/guide');
    const heading = page.locator('h2', { hasText: 'Systems Map' });
    await expect(heading).toBeVisible();
  });

  test('guide page has nav links to Admin and Workspace', async ({ page }) => {
    await page.goto('/pj/guide');
    const adminLink = page.locator('.nav-links a', { hasText: 'Admin' });
    const workspaceLink = page.locator('.nav-links a', { hasText: 'Workspace' });
    await expect(adminLink).toBeVisible();
    await expect(workspaceLink).toBeVisible();
  });

  test('guide page renders systems map layers', async ({ page }) => {
    await page.goto('/pj/guide');
    const layers = page.locator('.sys-layer');
    await expect(layers).toHaveCount(5);
  });

  test('guide page loads external CSS (no inline style block)', async ({ page }) => {
    await page.goto('/pj/guide');
    const styleTag = await page.locator('head style').count();
    expect(styleTag).toBe(0);
    const cssLink = page.locator('link[href="/styles/pj-guide.css"]');
    await expect(cssLink).toHaveCount(1);
  });
});

test.describe('PJ landing page', () => {
  test('landing page loads with PuddleJumper heading', async ({ page }) => {
    await page.goto('/pj');
    const heading = page.locator('h1', { hasText: 'PuddleJumper' });
    await expect(heading).toBeVisible();
  });

  test('landing page links to Quick Start guide', async ({ page }) => {
    await page.goto('/pj');
    const guideLink = page.locator('a[href="/pj/guide"]');
    await expect(guideLink.first()).toBeVisible();
  });
});

test.describe('Health endpoint (quick)', () => {
  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
