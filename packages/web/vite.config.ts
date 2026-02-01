import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig({
  envDir: repoRoot,
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    sveltekit(), 
    paraglideVitePlugin({
      project: './project.inlang',
        outdir: './src/lib/paraglide',
        strategy: ['url', 'cookie', 'baseLocale'],
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
