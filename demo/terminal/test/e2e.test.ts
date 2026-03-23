import { test, expect, type Page } from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";

const SERVER_PORT = 4220;

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

function waitForTerminal(page: Page) {
  return expect(page.locator("h1")).toHaveText("Terminal Demo");
}

test.describe("Terminal Demo E2E", () => {
  let serverProc: ChildProcess;

  test.beforeEach(async ({ page }) => {
    serverProc = await startServer();
    await page.goto("/");
    await waitForTerminal(page);
  });

  test.afterEach(() => {
    serverProc?.kill();
  });

  test("should show the terminal title", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Terminal Demo");
  });

  test("should show the welcome message from stream", async ({ page }) => {
    const output = page.getByTestId("terminal-output");
    await expect(output).toContainText("Welcome to the react-fullstack terminal demo!", { timeout: 5000 });
  });

  test("should echo input back via stream", async ({ page }) => {
    const output = page.getByTestId("terminal-output");
    // Wait for welcome message first
    await expect(output).toContainText("Welcome", { timeout: 5000 });

    const input = page.getByTestId("terminal-input");
    await input.fill("hello world");
    await input.press("Enter");

    await expect(output).toContainText("hello world", { timeout: 5000 });
    await expect(output).toContainText("command not found: hello world", { timeout: 5000 });
  });

  test("should handle the echo command", async ({ page }) => {
    const output = page.getByTestId("terminal-output");
    await expect(output).toContainText("Welcome", { timeout: 5000 });

    const input = page.getByTestId("terminal-input");
    await input.fill("echo test message");
    await input.press("Enter");

    await expect(output).toContainText("test message", { timeout: 5000 });
  });

  test("should handle the help command", async ({ page }) => {
    const output = page.getByTestId("terminal-output");
    await expect(output).toContainText("Welcome", { timeout: 5000 });

    const input = page.getByTestId("terminal-input");
    await input.fill("help");
    await input.press("Enter");

    await expect(output).toContainText("Available commands", { timeout: 5000 });
  });
});
