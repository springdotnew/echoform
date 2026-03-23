import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4209",
  },
  webServer: [
    {
      command: "bun run dev:server",
      port: 4210,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev:client",
      port: 4209,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
