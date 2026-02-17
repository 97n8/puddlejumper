import { test, expect } from '@playwright/test';

test.describe('Quick Start guide page', () => {
  test('loads the guide page with correct heading', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page.locator('h1')).toContainText('PuddleJumper');
  });

  test('has navigation links to Admin and Workspace', async ({ page }) => {
    await page.goto('/pj/guide');
    const nav = page.locator('.nav-links');
    await expect(nav.locator('a[href="/pj/admin"]')).toBeVisible();
    await expect(nav.locator('a[href="/pj"]')).toBeVisible();
  });

  test('displays the Quick Start section', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page.locator('text=Quick Start')).toBeVisible();
  });

  test('displays the Systems Map section', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page.locator('.sys-map')).toBeVisible();
    await expect(page.locator('.sys-layer')).toHaveCount(5);
  });
});

test.describe('PJ landing page', () => {
  test('loads the landing page', async ({ page }) => {
    await page.goto('/pj');
    await expect(page.locator('h1')).toContainText('PuddleJumper');
  });

  test('has links to Admin, Guide, and Health', async ({ page }) => {
    await page.goto('/pj');
    await expect(page.locator('a[href="/pj/admin"]')).toBeVisible();
    await expect(page.locator('a[href="/pj/guide"]')).toBeVisible();
    await expect(page.locator('a[href="/health"]')).toBeVisible();
  });

  test('loads external CSS without inline styles on landing page', async ({ page }) => {
    await page.goto('/pj');
    const link = page.locator('link[rel="stylesheet"][href="/styles/pj.css"]');
    await expect(link).toHaveCount(1);
  });
});

test.describe('Health endpoint', () => {
  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('health response includes service name', async ({ request }) => {
    const res = await request.get('/health');
    const body = await res.json();
    expect(body.service).toBeDefined();
  });
});
