import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: [
    {
      command: "bun run dev:server",
      port: 4220,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev:client",
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
