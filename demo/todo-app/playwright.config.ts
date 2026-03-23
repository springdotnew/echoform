import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:4200",
  },
  webServer: {
    command: "bun run dev:client",
    port: 4200,
    reuseExistingServer: !process.env.CI,
  },
});
