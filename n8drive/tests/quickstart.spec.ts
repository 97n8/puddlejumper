import { test, expect } from '@playwright/test';

test.describe('Quick Start guide page', () => {
  test('guide page loads with correct title', async ({ page }) => {
    await page.goto('/pj/guide');
    await expect(page).toHaveTitle(/Quick Start/);
  });

  test('guide page has main heading', async ({ page }) => {
    await page.goto('/pj/guide');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
  });

  test('guide page has nav links', async ({ page }) => {
    await page.goto('/pj/guide');
    const nav = page.locator('.nav-links');
    await expect(nav).toBeVisible();
  });

  test('guide page has systems map section', async ({ page }) => {
    await page.goto('/pj/guide');
    const body = page.locator('body');
    await expect(body).toContainText('Systems Map');
  });
});

test.describe('PJ landing page', () => {
  test('landing page loads with correct title', async ({ page }) => {
    await page.goto('/pj');
    await expect(page).toHaveTitle(/PuddleJumper/);
  });

  test('landing page shows Quick Commands section', async ({ page }) => {
    await page.goto('/pj');
    const panel = page.locator('.command-panel');
    await expect(panel).toBeVisible();
  });

  test('landing page has Summarize Dashboard command card', async ({ page }) => {
    await page.goto('/pj');
    const card = page.locator('.command-card');
    await expect(card).toContainText('Summarize Dashboard');
  });
});

test.describe('CSS loading', () => {
  test('pj.css is loaded on landing page', async ({ page }) => {
    await page.goto('/pj');
    const link = page.locator('link[href="/styles/pj.css"]');
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
});
