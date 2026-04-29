import { compile } from "mdsvex";
import aboutMarkdownEn from "../../../../content/about-the-data.en.md?raw";
import aboutMarkdownEs from "../../../../content/about-the-data.es.md?raw";

const unwrapHtmlBlocks = (html) =>
  html.replace(/{@html\s+`([\s\S]*?)`}/g, (_match, inner) => inner);

const wrapTables = (html) =>
  html.replace(
    /<table([\s\S]*?)<\/table>/g,
    (_match, inner) => `<div class="table-wrapper"><table${inner}</table></div>`,
  );

const compileMarkdown = (md) =>
  compile(md).then((compiled) => wrapTables(unwrapHtmlBlocks(compiled.code)));

const sourceByLocale = {
  en: aboutMarkdownEn,
  es: aboutMarkdownEs,
};

const cache = new Map();

export async function GET({ params }) {
  const locale = params.locale === "es" ? "es" : "en";
  let promise = cache.get(locale);
  if (!promise) {
    promise = compileMarkdown(sourceByLocale[locale]);
    cache.set(locale, promise);
  }
  const html = await promise;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Edge-cache aggressively; content only changes on deploy.
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

export const prerender = false;
