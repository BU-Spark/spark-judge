import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "canonical-local-auth-origin",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const host = request.headers.host ?? "";
          // Auth callbacks must return to the same origin as the local session.
          // Keep loopback navigation on the localhost origin configured in SITE_URL.
          if (
            (request.method === "GET" || request.method === "HEAD") &&
            request.headers.accept?.includes("text/html") &&
            /^127\.0\.0\.1(?::\d+)?$/.test(host)
          ) {
            const origin = `http://${host.replace("127.0.0.1", "localhost")}`;
            const path = request.url?.startsWith("/") ? request.url : "/";
            response.writeHead(307, {
              Location: `${origin}${path}`,
              "Cache-Control": "no-store",
            });
            response.end();
            return;
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: [
      // Design review routes never ship: production builds swap in a stub.
      ...(command === "build"
        ? [{ find: /^@\/devRoutes$/, replacement: path.resolve(rootDir, "./src/devRoutes.prod.ts") }]
        : []),
      { find: "@", replacement: path.resolve(rootDir, "./src") },
    ],
  },
}));
