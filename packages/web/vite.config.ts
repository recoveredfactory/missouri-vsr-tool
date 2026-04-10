import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import basicSsl from "@vitejs/plugin-basic-ssl";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// Set LOCAL_HTTPS=true in your root .env to enable HTTPS in dev.
// Useful for testing embeds in a live WP instance. Browser will warn
// about the self-signed cert — click through once per session.
const useLocalHttps = process.env.LOCAL_HTTPS === "true";

export default defineConfig({
  envDir: repoRoot,
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    sveltekit(),
    ...(useLocalHttps ? [basicSsl()] : []),
    paraglideVitePlugin({
      project: './project.inlang',
        outdir: './src/lib/paraglide',
        strategy: ['url', 'cookie', 'header', 'baseLocale'],
        urlPatterns: [
          {
            pattern: "/",
            localized: [
              ["en", "/en"],
              ["es", "/es"],
            ],
          },
          {
            pattern: "/:path(.*)?",
            localized: [
              ["en", "/en/:path(.*)?"],
              ["es", "/es/:path(.*)?"],
            ],
          },
        ],
      })
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  optimizeDeps: {
    include: ["layerchart", "layercake"],
  },
  ssr: {
    noExternal: ["layerchart", "layercake", "@inlang/paraglide-js"],
  },
});
