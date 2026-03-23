import { test, expect, type Page } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";

const SERVER_PORT = 4201;

function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("bun", ["server/index.tsx"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    proc.on("error", reject);

    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("Server running")) {
        resolve(proc);
      }
    });

    setTimeout(() => resolve(proc), 2000);
  });
}

function waitForApp(page: Page) {
  return expect(page.locator("h1")).toHaveText("Todo List");
}

test.describe("Todo App E2E", () => {
  let serverProc: ChildProcess;

  test.beforeEach(async ({ page }) => {
    serverProc = await startServer();
    await page.goto("/");
    await waitForApp(page);
  });

  test.afterEach(() => {
    serverProc?.kill();
  });

  test("should show initial todos", async ({ page }) => {
    await expect(page.getByText("0 of 2 completed")).toBeVisible();
    await expect(page.getByText("Learn react-fullstack")).toBeVisible();
    await expect(page.getByText("Build something awesome")).toBeVisible();
  });

  test("should add a todo", async ({ page }) => {
    await page.getByPlaceholder("What needs to be done?").fill("New test todo");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("New test todo")).toBeVisible();
    await expect(page.getByText("0 of 3 completed")).toBeVisible();
  });

  test("should toggle a todo", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Learn react-fullstack" })
      .getByRole("checkbox")
      .click();

    await expect(page.getByText("1 of 2 completed")).toBeVisible();
  });

  test("should delete a todo", async ({ page }) => {
    await page
      .getByRole("listitem")
      .filter({ hasText: "Build something awesome" })
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page.getByText("Build something awesome")).not.toBeVisible();
    await expect(page.getByText("0 of 1 completed")).toBeVisible();
  });

  test("should filter todos", async ({ page }) => {
    // Toggle first todo to completed
    await page
      .getByRole("listitem")
      .filter({ hasText: "Learn react-fullstack" })
      .getByRole("checkbox")
      .click();
    await expect(page.getByText("1 of 2 completed")).toBeVisible();

    // Filter active
    await page.getByRole("button", { name: "Active" }).click();
    await expect(page.getByText("Learn react-fullstack")).not.toBeVisible();
    await expect(page.getByText("Build something awesome")).toBeVisible();

    // Filter completed
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await expect(page.getByText("Learn react-fullstack")).toBeVisible();
    await expect(page.getByText("Build something awesome")).not.toBeVisible();

    // Filter all
    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText("Learn react-fullstack")).toBeVisible();
    await expect(page.getByText("Build something awesome")).toBeVisible();
  });

  test("should clear completed todos", async ({ page }) => {
    // Toggle first todo
    await page
      .getByRole("listitem")
      .filter({ hasText: "Learn react-fullstack" })
      .getByRole("checkbox")
      .click();
    await expect(page.getByText("1 of 2 completed")).toBeVisible();

    await page.getByRole("button", { name: "Clear Completed" }).click();

    await expect(page.getByText("Learn react-fullstack")).not.toBeVisible();
    await expect(page.getByText("0 of 1 completed")).toBeVisible();
  });
});
