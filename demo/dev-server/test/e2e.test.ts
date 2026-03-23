import { test, expect } from "@playwright/test";

test.describe("Terminal E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for dockview and xterm to mount
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 15000 });
  });

  test("should render xterm terminal", async ({ page }) => {
    await expect(page.locator(".xterm-screen")).toBeVisible({ timeout: 10000 });
  });

  test("should have + button for new tab", async ({ page }) => {
    // Dockview renders header actions — find the + button
    const plusBtn = page.locator("button").filter({ hasText: "" }).locator("svg");
    await expect(plusBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
