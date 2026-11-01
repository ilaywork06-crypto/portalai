import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

const BASE = "/AI/";

// "/" and "/AI" redirect to "/AI/".
function redirectToBase(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use(((req, res, next) => {
    const [path, query] = (req.url ?? "").split("?");
    if (path === "/" || path === BASE.slice(0, -1)) {
      res.writeHead(302, { Location: BASE + (query ? `?${query}` : "") });
      res.end();
      return;
    }
    next();
  }) as Connect.NextHandleFunction);
}

// The API is mocked in the browser (src/mock), so there is no backend to proxy to.
export default defineConfig({
  base: BASE,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [react(), { name: "redirect-to-base", configureServer: redirectToBase, configurePreviewServer: redirectToBase }],
  build: { chunkSizeWarningLimit: 1000 }, // the lazily loaded usage demo dataset is ~900 kB
  test: { include: ["src/**/*.test.ts"] },
});
