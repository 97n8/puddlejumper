import { test, expect } from '@playwright/test';

test.describe('Quick Start guide page', () => {
  test('renders heading and navigation links', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('PuddleJumper');

    // Nav links to /pj and /pj/admin should be present
    const homeLink = page.locator('a[href="/pj"]');
    await expect(homeLink.first()).toBeVisible();

    const adminLink = page.locator('a[href="/pj/admin"]');
    await expect(adminLink.first()).toBeVisible();
  });

  test('loads external stylesheet (CSP-compliant)', async ({ page }) => {
    const styleResponses: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('pj-guide.css')) {
        styleResponses.push(res.status());
      }
    });
    await page.goto('/pj/guide');
    await page.waitForLoadState('networkidle');
    expect(styleResponses.length).toBeGreaterThan(0);
    expect(styleResponses[0]).toBe(200);
  });

  test('systems map section is present', async ({ page }) => {
    await page.goto('/pj/guide');
    await page.waitForLoadState('domcontentloaded');

    const systemsMap = page.getByRole('heading', { name: 'Systems Map' });
    await expect(systemsMap).toBeVisible();
  });
});

test.describe('PJ landing page', () => {
  test('renders hero with version badge', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('domcontentloaded');

    // The page has a main .container and an #auth-gate; target the main container
    const heading = page.locator('.container > .hero h1').first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('PuddleJumper');

    const versionBadge = page.locator('.container > .hero .version-badge').first();
    await expect(versionBadge).toBeVisible();
    await expect(versionBadge).toContainText('v1.0');
  });

  test('feature cards are displayed in main container', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('domcontentloaded');

    // Scope to main .container (not #auth-gate which also has feature cards)
    const cards = page.locator('body > .container .feature-card');
    await expect(cards).toHaveCount(3);
  });

  test('action buttons link to admin and guide', async ({ page }) => {
    await page.goto('/pj');
    await page.waitForLoadState('domcontentloaded');

    // Scope to main .container actions section
    const adminLink = page.locator('body > .container .actions a[href="/pj/admin"]');
    await expect(adminLink).toBeVisible();

    const guideLink = page.locator('body > .container .actions a[href="/pj/guide"]');
    await expect(guideLink).toBeVisible();
  });

  test('external CSS loads (no inline styles for CSP)', async ({ page }) => {
    const styleResponses: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('pj.css')) {
        styleResponses.push(res.status());
      }
    });
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');
    expect(styleResponses.length).toBeGreaterThan(0);
    expect(styleResponses[0]).toBe(200);
  });

  test('mock command script loads', async ({ page }) => {
    const scriptResponses: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('pj-commands.js')) {
        scriptResponses.push(res.status());
      }
    });
    await page.goto('/pj');
    await page.waitForLoadState('networkidle');
    expect(scriptResponses.length).toBeGreaterThan(0);
    expect(scriptResponses[0]).toBe(200);
  });
});

test.describe('Health endpoint', () => {
  test('returns JSON with status field', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.service).toBe('puddle-jumper-deploy-remote');
  });
});
