import { test, expect } from '@playwright/test';

test.describe('PJ smoke', () => {
  const PJ_SELECTOR = '#pj';
  const PANEL_SELECTOR = '#panel.open';

  test.beforeEach(async ({ page }) => {
    // The Playwright config points baseURL to http://localhost:3002
    // which is the PJ Express server serving static assets.
    // The Next.js web app (with PJ assistant) would be on a different port.
    // Use PREVIEW_URL env var if set, otherwise fall back to baseURL.
    const url = process.env.PREVIEW_URL || '/';
    await page.goto(url);
  });

  test('PJ shows and opens panel on click', async ({ page }) => {
    await page.waitForSelector(PJ_SELECTOR, { state: 'visible' });
    await page.focus(PJ_SELECTOR);
    await page.keyboard.press('Enter');
    await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
    const header = await page.locator('#command-header').textContent();
    expect(header).toContain('PJ Command Center');
    await page.keyboard.press('Escape');
    await expect(page.locator(PANEL_SELECTOR)).toHaveCount(0);
  });

  test('dragging moves PJ and persists position', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('pj_pos_v3'));
    await page.reload();
    const pj = page.locator(PJ_SELECTOR);
    await pj.waitFor();
    const box = await pj.boundingBox();
    if (!box) throw new Error('PJ bounding box not available');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 80,
      box.y + box.height / 2 + 60,
      { steps: 10 }
    );
    await page.mouse.up();
    // Wait for position to be saved to localStorage
    await page.waitForFunction(
      () => localStorage.getItem('pj_pos_v3') !== null,
      { timeout: 5000 }
    );
    const saved = await page.evaluate(() =>
      localStorage.getItem('pj_pos_v3')
    );
    expect(saved).not.toBeNull();
    const pos = JSON.parse(saved as string);
    expect(typeof pos.left).toBe('number');
    expect(typeof pos.top).toBe('number');
  });

  test('edge snap near right edge', async ({ page }) => {
    const pj = page.locator(PJ_SELECTOR);
    await pj.waitFor();
    const box = await pj.boundingBox();
    if (!box) throw new Error('PJ bounding box not available');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const targetX =
      (await page.evaluate(() => window.innerWidth)) - 10;
    await page.mouse.move(targetX, box.y + box.height / 2, { steps: 15 });
    await page.mouse.up();
    // Wait for position to be saved to localStorage
    await page.waitForFunction(
      () => localStorage.getItem('pj_pos_v3') !== null,
      { timeout: 5000 }
    );
    const saved = JSON.parse(
      (await page.evaluate(() =>
        localStorage.getItem('pj_pos_v3')
      )) || '{}'
    );
    const rightPad = 12;
    expect(saved.left).toBeGreaterThanOrEqual(0);
    expect(saved.left).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerWidth)) -
        box.width -
        rightPad +
        1
    );
  });

  test('Summarize Dashboard mock command', async ({ page }) => {
    await page.waitForSelector(PJ_SELECTOR, { state: 'visible' });
    // Open panel
    await page.focus(PJ_SELECTOR);
    await page.keyboard.press('Enter');
    await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });

    // Click the Summarize Dashboard command
    const btn = page.locator('.command-btn[data-cmd="summarize-dashboard"]');
    await expect(btn).toBeVisible();
    await btn.click();

    // Should show loading state
    const result = page.locator('#pj-mock-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText('Processing');

    // Wait for the mock result to appear (replaces loading state)
    await expect(result).toContainText('Dashboard Summary', { timeout: 5000 });
    await expect(result).toContainText('Revenue running');
  });
});
