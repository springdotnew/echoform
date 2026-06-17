import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

const SERVER_PORT = 44241;
const STORAGE_KEY = "echoform-widget-plugins:v3";

declare global {
  interface Window {
    __widgetPluginDemo?: {
      readonly setSource: (source: string) => void;
      readonly getSource: () => string;
    };
  }
}

function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    let started = false;
    const proc = spawn("bun", ["server/index.tsx"], {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: "pipe",
    });

    proc.on("error", reject);
    proc.on("exit", (code, signal) => {
      if (!started) reject(new Error(`Widget plugin test server exited before startup: ${signal ?? code}`));
    });
    proc.stdout?.on("data", (data: Buffer) => {
      if (data.toString().includes("Widget plugin server running")) {
        started = true;
        resolve(proc);
      }
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(proc);
      }
    }, 2500);
  });
}

async function waitForDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Echoform Widget Plugins" })).toBeVisible();
  await expect(page.getByText("Widget Grid")).toBeVisible();
}

async function enableDevMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Dev Mode" }).click();
  await expect(page.getByRole("heading", { name: "Plugin TSX" })).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__widgetPluginDemo));
}

test.describe("Widget plugin PoC", () => {
  let serverProc: ChildProcess;

  test.beforeEach(async ({ page }) => {
    serverProc = await startServer();
    await page.goto("/");
    await page.evaluate((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, STORAGE_KEY);
    await waitForDashboard(page);
  });

  test.afterEach(() => {
    serverProc?.kill();
  });

  test("renders seeded widgets through QuickJS", async ({ page }) => {
    await expect(page.getByText("13 generated widgets")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue Metric" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Traffic Trend" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Signups" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Action Counter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ops Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Release Checklist" })).toBeVisible();
    await expect(page.locator(".widget-frame").filter({ hasText: "Revenue Metric" }).getByText("$128k")).toBeVisible();
    await expect(page.getByText("Generated table widget")).toBeVisible();
    await expect(page.getByText("Error budget remaining")).toBeVisible();
  });

  test("runs plugin-local callback and re-renders state", async ({ page }) => {
    const counter = page.locator(".widget-frame").filter({ hasText: "Action Counter" });
    await counter.getByRole("button", { name: "Increment" }).click();
    await expect(counter.getByText("1")).toBeVisible();
    await counter.getByRole("button", { name: "Increment" }).click();
    await expect(counter.getByText("2")).toBeVisible();
  });

  test("edits host-rendered table cells through plugin state", async ({ page }) => {
    const signups = page.locator(".widget-frame").filter({ hasText: "Recent Signups" });
    await expect(signups.getByLabel("Seats northwind")).toHaveValue("18");
    await signups.getByLabel("Seats northwind").fill("26");
    await expect(signups.locator(".stat-list").getByText("77")).toBeVisible();
    await signups.getByLabel("Plan acme").selectOption("Enterprise");
    await signups.getByRole("button", { name: "Ent", exact: true }).click();
    await expect(signups.getByLabel("Seats acme")).toBeVisible();
    await expect(signups.getByLabel("Seats northwind")).toBeHidden();
  });

  test("shows bundle errors without removing previous output", async ({ page }) => {
    await enableDevMode(page);
    await page.locator(".widget-frame").filter({ hasText: "Revenue Metric" }).click();
    await page.evaluate(() => {
      window.__widgetPluginDemo?.setSource("export default function Widget(){ return <Stack>");
    });
    await page.getByRole("button", { name: "Run" }).last().click();
    await expect(page.locator(".editor-error")).toBeVisible();
    await expect(page.locator(".widget-frame").filter({ hasText: "Revenue Metric" }).getByText("$128k")).toBeVisible();
  });

  test("persists reordered widgets", async ({ page }) => {
    const firstTitle = page.locator(".widget-frame h3").first();
    await expect(firstTitle).toHaveText("Revenue Metric");

    await page.evaluate(() => {
      const frames = [...document.querySelectorAll<HTMLElement>(".widget-frame")];
      const first = frames[0];
      const second = frames[1];
      first?.querySelector(".drag-handle")?.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
      second?.dispatchEvent(new DragEvent("dragenter", { bubbles: true }));
      second?.dispatchEvent(new DragEvent("dragover", { bubbles: true }));
      second?.dispatchEvent(new DragEvent("drop", { bubbles: true }));
    });

    await expect(page.locator(".widget-frame h3").first()).toHaveText("Traffic Trend");
    await page.waitForFunction((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { readonly widgetOrder?: readonly string[] };
      return parsed.widgetOrder?.[0] === "traffic";
    }, STORAGE_KEY);
    await page.reload();
    await waitForDashboard(page);
    await expect(page.locator(".widget-frame h3").first()).toHaveText("Traffic Trend");
  });

  test("reorders widgets from the drag handle keyboard controls", async ({ page }) => {
    const firstHandle = page.locator(".widget-frame").filter({ hasText: "Revenue Metric" }).locator(".drag-handle");
    await firstHandle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".widget-frame h3").first()).toHaveText("Traffic Trend");
  });
});
