import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

/**
 * Builds the browser-only preview of the app (see main.tsx) into .preview-dist/.
 * The output is one page plus two files (assets/app.js, assets/app.css), ready to host anywhere static.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const app = fileURLToPath(new URL("..", import.meta.url));

/** Hosts like claude.ai Artifacts add the <html>/<head>/<body> wrapper themselves, so strip ours. */
function bodyOnlyPage(): Plugin {
  return {
    name: "body-only-page",
    transformIndexHtml: {
      order: "post",
      handler: (html) =>
        html
          .replace(/<!doctype html>/i, "")
          .replace(/<\/?(html|head|body)[^>]*>/gi, "")
          .replace(/<meta charset[^>]*>|<meta name="viewport"[^>]*>/gi, "")
          .replace(/\n\s*\n/g, "\n")
          .trim(),
    },
  };
}

export default defineConfig({
  root: here,
  base: "./",
  plugins: [react(), tailwindcss(), bodyOnlyPage()],
  resolve: {
    alias: [
      { find: "next/link", replacement: `${here}shims/link.tsx` },
      { find: "next/navigation", replacement: `${here}shims/navigation.ts` },
      { find: /^@\//, replacement: app },
    ],
  },
  define: {
    "process.env.NEXT_PUBLIC_DEMO_DATA": JSON.stringify("true"),
    "process.env.NEXT_PUBLIC_DISCORD_INVITE_URL": JSON.stringify(""),
  },
  build: {
    outDir: `${app}.preview-dist`,
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: "assets/app.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/app[extname]" },
    },
  },
});
