import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      "quickjs-emscripten",
      "quickjs-emscripten-core",
      "@jitl/quickjs-wasmfile-release-sync",
    ],
  },
  server: {
    port: 4240,
  },
  worker: {
    format: "es",
  },
});
