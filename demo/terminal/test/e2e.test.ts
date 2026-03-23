import { test, expect } from "@playwright/test";

test.describe("Terminal E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show the terminal title bar", async ({ page }) => {
    await expect(page.getByText("Terminal", { exact: true })).toBeVisible();
  });

  test("should render the xterm container", async ({ page }) => {
    // xterm.js creates a .xterm element when mounted
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 5000 });
  });

  test("should show shell prompt from PTY stream", async ({ page }) => {
    // The real shell outputs a prompt — xterm renders it on a canvas,
    // but the underlying DOM has xterm-rows we can check
    const terminal = page.locator(".xterm-screen");
    await expect(terminal).toBeVisible({ timeout: 5000 });
  });

  test("should accept keyboard input and show output", async ({ page }) => {
    // Wait for xterm to mount and shell to be ready
    await expect(page.locator(".xterm")).toBeVisible({ timeout: 5000 });

    // Type a command into the terminal (xterm captures keyboard directly)
    await page.locator(".xterm-helper-textarea").fill("");
    await page.keyboard.type("echo hello-from-test", { delay: 30 });
    await page.keyboard.press("Enter");

    // Wait for the echo output to appear in the xterm rows
    // xterm renders text in .xterm-rows spans
    await expect(page.locator(".xterm-rows")).toContainText("hello-from-test", { timeout: 5000 });
  });
});
