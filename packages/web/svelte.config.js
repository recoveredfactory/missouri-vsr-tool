import adapter from "svelte-kit-sst";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex } from "mdsvex";

// Wrap every <table> the compiler emits in <div class="table-wrapper"> so the
// overflow/scroll CSS in app.css (.content .table-wrapper) keeps working for
// markdown-sourced tables in about-the-data.*.md.
const rehypeWrapTables = () => (tree) => {
  const visit = (node) => {
    if (!node || !Array.isArray(node.children)) return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child?.type === "element" && child.tagName === "table") {
        node.children[i] = {
          type: "element",
          tagName: "div",
          properties: { className: ["table-wrapper"] },
          children: [child],
        };
      } else {
        visit(child);
      }
    }
  };
  visit(tree);
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    mdsvex({ rehypePlugins: [rehypeWrapTables] }),
  ],

  extensions: [".svelte", ".md"],

  kit: {
    adapter: adapter(),
  },
};

export default config;
