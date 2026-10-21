import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
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
    // The code below enables dev tools like taking screenshots of your site
    // while it is being developed on chef.convex.dev.
    // Feel free to remove this code if you're no longer developing your app with Chef.
    mode === "development"
      ? {
          name: "inject-chef-dev",
          transform(code: string, id: string) {
            if (id.includes("main.tsx")) {
              return {
                code: `${code}

/* Added by Vite plugin inject-chef-dev */
window.addEventListener('message', async (message) => {
  if (message.source !== window.parent) return;
  if (message.data.type !== 'chefPreviewRequest') return;

  const worker = await import('https://chef.convex.dev/scripts/worker.bundled.mjs');
  await worker.respondToMessage(message);
});
            `,
                map: null,
              };
            }
            return null;
          },
        }
      : null,
    // End of code for taking screenshots on chef.convex.dev.
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
}));
