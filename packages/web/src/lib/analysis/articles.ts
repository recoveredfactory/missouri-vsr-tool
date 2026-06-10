// Registry of analysis articles ("living articles").
//
// Single source of truth for the /analysis index, the homepage "Latest
// analysis" card, and any cross-links. Add a new entry here and the index +
// homepage card pick it up automatically — that's the "built to grow"
// mechanism, so a single article today becomes a list tomorrow with no rework.
//
// Article *prose* lives in each article's `+page.md` (English-first; a Spanish
// sibling can be added later). The *chrome* below (title/dek) is i18n'd via
// Paraglide message keys so the index and nav read correctly in both locales.

import * as m from "$lib/paraglide/messages";

export type ArticleStatus = "published" | "draft";

export type Article = {
  /** URL slug — must match the route folder under src/routes/analysis/. */
  slug: string;
  /** ISO publish date (used for ordering + display). */
  date: string;
  status: ArticleStatus;
  /** Paraglide message key for the title (looked up via m[titleKey]()). */
  titleKey: string;
  /** Paraglide message key for the dek / standfirst. */
  dekKey: string;
  /** Whether the article body is available in Spanish yet. */
  hasSpanish: boolean;
};

export const ARTICLES: Article[] = [
  {
    slug: "first-impressions-2025",
    date: "2026-06-09",
    status: "published",
    titleKey: "analysis_ii2025_title",
    dekKey: "analysis_ii2025_dek",
    hasSpanish: false,
  },
];

/** Resolve a registry message key to its localized string. */
const msg = (key: string): string => {
  const fn = (m as Record<string, unknown>)[key];
  return typeof fn === "function" ? (fn as () => string)() : key;
};

export type ResolvedArticle = Article & { title: string; dek: string };

export const resolveArticle = (a: Article): ResolvedArticle => ({
  ...a,
  title: msg(a.titleKey),
  dek: msg(a.dekKey),
});

/** Published articles, newest first, with localized title/dek resolved. */
export const publishedArticles = (): ResolvedArticle[] =>
  ARTICLES.filter((a) => a.status === "published")
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(resolveArticle);

/** The most recent published article (for the homepage card), or null. */
export const latestArticle = (): ResolvedArticle | null =>
  publishedArticles()[0] ?? null;
