import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 45_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:44240",
  },
  webServer: {
    command: "VITE_WIDGET_PLUGIN_WS_URL=ws://localhost:44241/ws bun run dev:client -- --port 44240 --strictPort",
    port: 44240,
    reuseExistingServer: false,
  },
});
