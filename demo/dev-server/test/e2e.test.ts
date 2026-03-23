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

  test("should accept keyboard input and show output", async ({ page }) => {
    // Switch to the interactive "shell" tab
    await page.locator("button").filter({ hasText: "shell" }).click();
    await page.waitForTimeout(500);
    await page.locator(".xterm").click();
    await page.waitForTimeout(500);
    await page.keyboard.type("echo hello-dockview", { delay: 30 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm-rows")).toContainText("hello-dockview", { timeout: 10000 });
  });

  test("should have + button for new tab", async ({ page }) => {
    // Dockview renders header actions — find the + button
    const plusBtn = page.locator("button").filter({ hasText: "" }).locator("svg");
    await expect(plusBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
