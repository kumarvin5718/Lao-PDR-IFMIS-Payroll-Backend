/**
 * Vite dev server: `@` → `src/`, proxies `/api` → FastAPI and `/superset` → Superset.
 */
import path from "path";
import { fileURLToPath } from "url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/superset": {
        target: "http://localhost:8088",
        changeOrigin: true,
      },
    },
  },
});
