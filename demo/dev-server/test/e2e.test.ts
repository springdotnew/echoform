import { test, expect } from "@playwright/test";

// The wmux server runs on :4220 and the wmux-client runs on :5173.
// We navigate to the client with hash params to connect.
const WMUX_URL = "/#token=test-token&ws=ws://localhost:4220/ws";

// Selector for xterm inside the visible (active) tab panel
const VISIBLE_XTERM = "[style*='visibility: visible'] .xterm";

test.describe("Terminal E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WMUX_URL);
    // Wait for the active tab's xterm terminal to mount and become visible
    await page.waitForSelector(VISIBLE_XTERM, { state: "visible", timeout: 15000 });
  });

  test("should render xterm terminal", async ({ page }) => {
    await expect(page.locator(VISIBLE_XTERM).first()).toBeVisible({ timeout: 10000 });
  });

  test("should switch tabs via sidebar", async ({ page }) => {
    // Switch to the interactive "shell" tab via sidebar
    await page.getByText("shell", { exact: true }).click();
    await page.waitForTimeout(500);
    // Verify a terminal is still visible after tab switch
    await expect(page.locator(VISIBLE_XTERM).first()).toBeVisible({ timeout: 5000 });
  });

  test("should have sidebar with categories", async ({ page }) => {
    // Sidebar should render category sections
    await expect(page.getByText("background")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("interactive")).toBeVisible({ timeout: 5000 });
  });
});
