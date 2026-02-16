import { test, expect } from '@playwright/test';

test.describe('Tools page - Governance card', () => {
  test('Governance card is visible with Agenda and Playbooks buttons', async ({ page }) => {
    await page.goto('/#/tools');

    await expect(page.locator('text=Governance')).toBeVisible();
    await expect(page.locator('a', { hasText: 'Agenda' })).toBeVisible();
    await expect(page.locator('a', { hasText: 'Playbooks' })).toBeVisible();
  });

  test('Agenda button links to agenda page', async ({ page }) => {
    await page.goto('/#/tools');

    const agendaLink = page.locator('a', { hasText: 'Agenda' });
    await expect(agendaLink).toBeVisible();
    await expect(agendaLink).toHaveAttribute('href', '#/agenda');
  });

  test('Playbooks button links to Logicville playbook', async ({ page }) => {
    await page.goto('/#/tools');

    const playbooksLink = page.locator('a', { hasText: 'Playbooks' });
    await expect(playbooksLink).toBeVisible();
    await expect(playbooksLink).toHaveAttribute('href', /09-logicville-living-agenda/);
  });

  test('PuddleJumper Admin button shown when configured', async ({ page }) => {
    await page.goto('/#/tools');

    const adminBtn = page.locator('a', { hasText: 'PuddleJumper Admin' });
    if (await adminBtn.count()) {
      await expect(adminBtn).toHaveAttribute('href', /pj\/admin/);
    }
  });
});
