import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

export async function load() {
  return {
    aboutDataHtml: await aboutDataHtmlPromise,
  };
}
