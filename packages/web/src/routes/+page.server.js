import { compile } from "mdsvex";
import aboutMarkdown from "../../content/about-the-data.md?raw";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const aboutDataHtmlPromise = compile(aboutMarkdown).then((compiled) =>
  unwrapHtmlBlocks(compiled.code),
);

export async function load({ fetch }) {
  let downloadManifest = null;
  try {
    const response = await fetch(
      "/data/downloads/missouri_vsr_2020_2024_downloads_manifest.json"
    );
    if (response.ok) {
      downloadManifest = await response.json();
    } else {
      console.error("Failed to load downloads manifest:", response.status);
    }
  } catch (error) {
    console.error("Failed to load downloads manifest:", error);
  }

  return {
    aboutDataHtml: await aboutDataHtmlPromise,
    downloadManifest,
  };
}
