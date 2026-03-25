import { test, expect } from "@playwright/test";

// The wmux server runs on :4220 and the wmux-client runs on :5173.
// We navigate to the client with hash params to connect.
const WMUX_URL = "/#token=test-token&ws=ws://localhost:4220/ws";

// Selector for xterm inside the visible (active) tab panel
const VISIBLE_XTERM = "[style*='visibility: visible'] .xterm";

// xterm-rows contains terminal text as readable DOM nodes
const XTERM_ROWS = "[style*='visibility: visible'] .xterm-rows";

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

test.describe("Stream Replay E2E", () => {
  test("late-joining client receives terminal history", async ({ browser }) => {
    // Page 1: connect and ensure counter tab is active
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(WMUX_URL);
    await page1.waitForSelector(VISIBLE_XTERM, { state: "visible", timeout: 15000 });

    // Ensure we're on the counter tab (first tab in background category)
    await page1.getByText("counter", { exact: true }).click();
    await page1.waitForTimeout(500);

    // Wait for ticks to accumulate in the replay buffer
    await page1.waitForFunction(
      (sel: string) => {
        const tree = document.querySelector(sel);
        return tree?.textContent?.includes("tick") ?? false;
      },
      XTERM_ROWS,
      { timeout: 10000 },
    );

    // Page 2: late joiner opens a fresh context (new WebSocket connection)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(WMUX_URL);
    await page2.waitForSelector(VISIBLE_XTERM, { state: "visible", timeout: 15000 });

    // Ensure counter tab is selected on page 2 as well
    await page2.getByText("counter", { exact: true }).click();
    await page2.waitForTimeout(500);

    // The late joiner should see replayed terminal content with "tick"
    const hasReplay = await page2.waitForFunction(
      (sel: string) => {
        const tree = document.querySelector(sel);
        return tree?.textContent?.includes("tick") ?? false;
      },
      XTERM_ROWS,
      { timeout: 10000 },
    );

    expect(hasReplay).toBeTruthy();

    await ctx1.close();
    await ctx2.close();
  });
});
