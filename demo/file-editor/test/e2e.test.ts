import { test, expect } from "@playwright/test";

test.describe("File Editor E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should render the app with title bar", async ({ page }) => {
    await expect(page.getByText("File Editor")).toBeVisible();
  });

  test("should show explorer panel", async ({ page }) => {
    await expect(page.getByText("Explorer")).toBeVisible();
  });

  test("should show file tree", async ({ page }) => {
    await expect(page.getByText("file-editor", { exact: true })).toBeVisible();
  });

  test("should show empty editor message", async ({ page }) => {
    await expect(page.getByText("Select a file to edit")).toBeVisible();
  });

  test("should open a file when clicked", async ({ page }) => {
    // Expand server directory
    await page.getByText("server").click();
    // Click a file
    await page.getByText("index.tsx").click();
    // Tab should appear
    await expect(page.getByText("index.tsx")).toBeVisible();
    // Empty editor message should be gone
    await expect(page.getByText("Select a file to edit")).not.toBeVisible();
  });
});
