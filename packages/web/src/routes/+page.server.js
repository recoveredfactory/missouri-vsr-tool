import { readFileSync } from "fs";
import { compile } from "mdsvex";

export async function load() {
  const markdownPath = new URL("../../content/about-the-data.md", import.meta.url);
  const markdown = readFileSync(markdownPath, "utf-8");
  const compiled = await compile(markdown);

  return {
    aboutDataHtml: compiled.code,
  };
}
