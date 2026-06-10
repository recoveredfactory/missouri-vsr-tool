import adapter from "svelte-kit-sst";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  // mdsvex defaults to only `.svx`; tell it to process `.md` too, otherwise
  // `.md` routes compile as raw Svelte components and the markdown renders
  // literally.
  preprocess: [vitePreprocess(), mdsvex({ extensions: [".md"] })],

  extensions: [".svelte", ".md"],

  kit: {
    adapter: adapter(),
  },
};

export default config;
