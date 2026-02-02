import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) => compiled.code);

export async function load() {
  return {
    aboutDataHtml: await aboutDataHtmlPromise,
  };
}
