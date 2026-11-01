import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import type { Connect, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vitest/config";

const BASE = "/AI/";
const gateway = process.env.VITE_API_PROXY ?? "http://localhost:8080";
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT) || undefined;
// Behind the gateway the Host header is whatever the browser used (machine name, LAN IP, a dev domain).
const allowedHosts = process.env.VITE_ALLOWED_HOSTS === "all" ? true : process.env.VITE_ALLOWED_HOSTS?.split(",");

// "/" and "/AI" redirect to "/AI/" (the gateway does the same in every environment).
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

export default defineConfig({
  base: BASE,
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [react(), { name: "redirect-to-base", configureServer: redirectToBase, configurePreviewServer: redirectToBase }],
  server: {
    proxy: { "/AI/api": { target: gateway, changeOrigin: false } },
    hmr: hmrClientPort ? { clientPort: hmrClientPort } : undefined,
    allowedHosts,
  },
  preview: { proxy: { "/AI/api": { target: gateway, changeOrigin: false } } },
  test: { include: ["src/**/*.test.ts"] },
});
