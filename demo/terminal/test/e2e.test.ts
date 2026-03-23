import { test, expect } from "@playwright/test";

test.describe("Terminal E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show sidebar with initial tab", async ({ page }) => {
    await expect(page.getByText("TERMINALS")).toBeVisible();
    await expect(page.getByText("bash")).toBeVisible({ timeout: 5000 });
  });

  test("should render xterm for active tab", async ({ page }) => {
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 5000 });
  });

  test("should accept keyboard input", async ({ page }) => {
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 5000 });
    // Click terminal to focus xterm
    await page.locator(".xterm").click();
    await page.keyboard.type("echo hello-test", { delay: 30 });
    await page.keyboard.press("Enter");
    await expect(page.locator(".xterm-rows")).toContainText("hello-test", { timeout: 10000 });
  });

  test("should create new tab with + button", async ({ page }) => {
    await expect(page.getByText("bash")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "+" }).click();
    // Should now have 2 bash tabs in sidebar
    const tabs = page.locator("[style*='cursor: pointer']").filter({ hasText: "bash" });
    await expect(tabs).toHaveCount(2, { timeout: 5000 });
  });
});
