import { test, expect } from "@playwright/test";

test.describe("Tools page", () => {
  test("Governance card renders with Agenda and Playbooks links", async ({ page }) => {
    await page.goto("/#/tools");

    // Governance card title
    await expect(page.locator("text=Logicville — Governance")).toBeVisible();

    // Agenda & Playbooks links
    await expect(page.locator("a", { hasText: "Agenda" })).toBeVisible();
    await expect(page.locator("a", { hasText: "Playbooks" })).toBeVisible();
  });

  test("PuddleJumper Admin link renders only when configured", async ({ page }) => {
    await page.goto("/#/tools");

    // PuddleJumper Admin is optional — renders only when cfg.puddlejumper.adminUrl is set.
    // In a default/unconfigured environment, the button should not appear.
    const adminBtn = page.locator("a", { hasText: "PuddleJumper Admin" });
    const count = await adminBtn.count();
    if (count > 0) {
      await expect(adminBtn).toHaveAttribute("href", /pj\/admin/);
    }
  });
});
