import { test, expect } from "@playwright/test";

// The wmux server runs on :4220 and the wmux-client runs on :5173.
// We navigate to the client with hash params to connect.
const WMUX_URL = "/#token=test-token&ws=ws://localhost:4220/ws";

test.describe("Terminal E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WMUX_URL);
    // Wait for dockview and xterm to mount
    await expect(page.locator(".xterm").first()).toBeVisible({ timeout: 15000 });
  });

  test("should render xterm terminal", async ({ page }) => {
    await expect(page.locator(".xterm-screen").first()).toBeVisible({ timeout: 10000 });
  });

  test("should accept keyboard input and show output", async ({ page }) => {
    // Switch to the interactive "shell" tab
    await page.locator("button").filter({ hasText: "shell" }).click();
    await page.waitForTimeout(500);
    await page.locator(".xterm").first().click();
    await page.waitForTimeout(500);
    await page.keyboard.type("echo hello-dockview", { delay: 30 });
    await page.keyboard.press("Enter");
    // xterm v5 renders to canvas; screenReaderMode populates .xterm-accessibility-tree with text
    await expect(page.locator(".xterm-accessibility-tree")).toContainText("hello-dockview", { timeout: 10000 });
  });

  test("should have + button for new tab", async ({ page }) => {
    // Dockview renders header actions — find the + button
    const plusBtn = page.locator("button").filter({ hasText: "" }).locator("svg");
    await expect(plusBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
