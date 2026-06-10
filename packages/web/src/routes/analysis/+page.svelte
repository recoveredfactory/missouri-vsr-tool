<script>
  import StickyHeader from "$lib/components/StickyHeader.svelte";
  import { publishedArticles } from "$lib/analysis/articles";
  import { getLocale, locales } from "$lib/paraglide/runtime";
  import {
    analysis_index_title,
    analysis_index_intro,
    analysis_card_cta,
  } from "$lib/paraglide/messages";

  $: currentLocale = getLocale();
  $: localeBase = locales.includes(currentLocale) ? `/${currentLocale}` : "/en";
  $: articles = publishedArticles();

  const fmtDate = (iso, locale) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale === "es" ? "es" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
</script>

<svelte:head>
  <title>{analysis_index_title()}</title>
  <meta name="description" content={analysis_index_intro()} />
</svelte:head>

<StickyHeader />

<main id="main-content" class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
  <h1 class="text-3xl font-bold text-slate-900 sm:text-4xl">{analysis_index_title()}</h1>
  <p class="mt-3 max-w-2xl text-lg leading-relaxed text-slate-600">{analysis_index_intro()}</p>

  <ul class="mt-10 flex flex-col gap-6">
    {#each articles as article}
      <li>
        <a
          href={`${localeBase}/analysis/${article.slug}`}
          class="block rounded-lg border border-slate-200 bg-white p-6 no-underline transition hover:border-[#1b613c] hover:shadow-sm"
        >
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {fmtDate(article.date, currentLocale)}
          </div>
          <h2 class="mt-1 text-xl font-bold text-slate-900">{article.title}</h2>
          <p class="mt-2 leading-relaxed text-slate-600">{article.dek}</p>
          <span class="mt-3 inline-block font-semibold text-[#1b613c]">{analysis_card_cta()}</span>
        </a>
      </li>
    {/each}
  </ul>
</main>
