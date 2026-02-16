import { test, expect } from "@playwright/test";

test.describe("PRR E2E Flow", () => {
  let publicToken: string;
  let prrId: string;

  test("Complete PRR workflow", async ({ page, context }) => {
    // Step 1: Submit a public PRR
    await page.goto("/prr");
    
    await expect(page.locator("h1")).toContainText("Public Records Request");
    
    // Fill out submission form
    await page.fill('input[name="submitter_name"]', "Test Submitter");
    await page.fill('input[name="submitter_email"]', "test@example.com");
    await page.fill('input[name="summary"]', "Test PRR Request");
    await page.fill('textarea[name="details"]', "This is a test request for E2E testing");
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for success state
    await expect(page.locator("#success-message")).toBeVisible({ timeout: 5000 });
    
    // Extract token from success message
    const tokenElement = page.locator("#public-token");
    await expect(tokenElement).toBeVisible();
    publicToken = await tokenElement.textContent() || "";
    expect(publicToken).toBeTruthy();
    expect(publicToken.length).toBe(64);

    // Step 2: Check status as public user
    await page.goto(`/prr-status?token=${publicToken}`);
    
    await expect(page.locator(".prr-status")).toBeVisible();
    await expect(page.locator(".prr-summary")).toContainText("Test PRR Request");
    await expect(page.locator(".status-badge")).toContainText("submitted");

    // Step 3: Login as admin (reuse existing OAuth flow from smoke test)
    await page.goto("/pj/admin");
    
    // Mock OAuth or use test credentials
    const sessionCookie = await page.context().cookies();
    if (sessionCookie.length === 0) {
      // If no session, simulate login
      await page.evaluate(() => {
        localStorage.setItem("pj_session", JSON.stringify({
          user_id: "test-admin",
          workspace_id: "test-workspace",
          role: "admin"
        }));
      });
      await page.reload();
    }

    // Step 4: Navigate to PRR tab
    await page.click('[data-tab="prr"]');
    await expect(page.locator("#tab-prr")).toBeVisible();

    // Step 5: Verify PRR appears in queue
    await page.waitForSelector("#prr-queue-body tr", { timeout: 5000 });
    
    const rows = page.locator("#prr-queue-body tr");
    await expect(rows).toHaveCount(1, { timeout: 3000 });
    
    const firstRow = rows.first();
    await expect(firstRow).toContainText("Test PRR Request");
    await expect(firstRow).toContainText("submitted");

    // Step 6: Open PRR detail
    await firstRow.locator('button:has-text("View")').click();
    
    await expect(page.locator("#prr-detail-overlay")).toBeVisible();
    await expect(page.locator("#prr-detail-content")).toContainText("Test PRR Request");
    await expect(page.locator("#prr-detail-content")).toContainText("This is a test request for E2E testing");

    // Step 7: Add a comment
    await page.fill("#prr-comment-input", "We have received your request and are reviewing it.");
    await page.click('button:has-text("Add Comment")');
    
    // Wait for toast notification
    await expect(page.locator(".toast")).toContainText("Comment added", { timeout: 3000 });

    // Verify comment appears
    await expect(page.locator(".comment")).toContainText("We have received your request");

    // Step 8: Update status to acknowledged
    await page.selectOption("#prr-status-select", "acknowledged");
    
    // Wait for status update confirmation
    await expect(page.locator(".toast")).toContainText("Status updated", { timeout: 3000 });

    // Close detail panel
    await page.click(".detail-close");
    await expect(page.locator("#prr-detail-overlay")).not.toBeVisible();

    // Step 9: Verify queue shows updated status
    await expect(firstRow.locator(".status-badge")).toContainText("acknowledged");

    // Step 10: Verify public can see updated status
    await page.goto(`/prr-status?token=${publicToken}`);
    
    await expect(page.locator(".status-badge")).toContainText("acknowledged");
    await expect(page.locator(".comment")).toContainText("We have received your request");

    // Step 11: Update to in_progress (admin side)
    await page.goto("/pj/admin");
    await page.click('[data-tab="prr"]');
    await page.waitForSelector("#prr-queue-body tr");
    
    await page.click('button:has-text("View")');
    await expect(page.locator("#prr-detail-overlay")).toBeVisible();
    
    await page.selectOption("#prr-status-select", "in_progress");
    await expect(page.locator(".toast")).toContainText("Status updated", { timeout: 3000 });

    // Step 12: Close PRR
    await page.selectOption("#prr-status-select", "closed");
    await expect(page.locator(".toast")).toContainText("Status updated", { timeout: 3000 });
    
    await page.click(".detail-close");

    // Step 13: Verify closed status publicly
    await page.goto(`/prr-status?token=${publicToken}`);
    await expect(page.locator(".status-badge")).toContainText("closed");
  });

  test("PRR queue filtering", async ({ page }) => {
    // Login as admin
    await page.goto("/pj/admin");
    await page.evaluate(() => {
      localStorage.setItem("pj_session", JSON.stringify({
        user_id: "test-admin",
        workspace_id: "test-workspace",
        role: "admin"
      }));
    });
    await page.reload();

    // Navigate to PRR tab
    await page.click('[data-tab="prr"]');
    
    // Wait for queue to load
    await page.waitForSelector("#prr-queue-body");

    // Test status filter
    await page.selectOption("#prr-status-filter", "submitted");
    await page.waitForTimeout(500); // Wait for filter to apply

    // Verify only submitted PRRs shown
    const rows = page.locator("#prr-queue-body tr .status-badge");
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText("submitted");
    }
  });

  test("PRR accessibility", async ({ page }) => {
    // Test public submission form
    await page.goto("/prr");
    
    // Check for proper labels
    await expect(page.locator('label[for="submitter_name"]')).toBeVisible();
    await expect(page.locator('label[for="summary"]')).toBeVisible();
    
    // Check ARIA attributes
    const summaryInput = page.locator('input[name="summary"]');
    await expect(summaryInput).toHaveAttribute("required");
    await expect(summaryInput).toHaveAttribute("aria-required", "true");

    // Test keyboard navigation
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBe("INPUT");
  });
});
