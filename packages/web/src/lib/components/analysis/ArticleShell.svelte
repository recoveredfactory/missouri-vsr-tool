<script>
  // Visual frame for an analysis article — modeled on the 287(g) page:
  // a large title + dek hero with a byline/date line, then a styled prose
  // body with a serif dropcap on the opening paragraph.
  //
  // Lives as a *component* (not raw HTML in the .md) so mdsvex parses the
  // markdown placed in its default slot.
  //
  // Body/heading typography is set via :global(.article-prose > …) rules below
  // rather than Tailwind prose-* modifiers: those modifiers land at the same
  // specificity as the @tailwindcss/typography base styles and lose, so they
  // silently don't apply. The child combinator (>) targets the article's own
  // paragraphs/headings while leaving `not-prose` figure internals alone.
  export let title = "";
  export let dek = "";
  export let byline = "";
  export let dateLabel = "";
</script>

<main id="main-content" class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
  <header class="mb-10 sm:mb-12">
    {#if title}
      <h1 class="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">{title}</h1>
    {/if}
    {#if dek}
      <p class="mt-5 text-xl font-light leading-relaxed text-slate-500 sm:text-2xl">{dek}</p>
    {/if}
    {#if byline || dateLabel}
      <div class="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500">
        {#if byline}<span class="font-medium text-slate-700">{byline}</span>{/if}
        {#if byline && dateLabel}<span class="px-2 text-slate-300">·</span>{/if}
        {#if dateLabel}<span>{dateLabel}</span>{/if}
      </div>
    {/if}
  </header>

  <article class="article-prose prose prose-slate max-w-none">
    <slot />
  </article>
</main>

<style>
  /* Body paragraphs (direct children only — leaves figure captions alone).
     Sized comfortably on the large side without shouting: ~19px mobile,
     ~20px desktop (the "goldilocks" reading size). */
  :global(.article-prose > p) {
    margin-top: 0;
    margin-bottom: 1.5rem;
    font-size: 1.1875rem; /* ~19px */
    line-height: 1.7;
    color: #334155; /* slate-700 */
  }

  /* Section headings — coherent scale: h1 (hero) > h2 > h3 > body. */
  :global(.article-prose > h2) {
    margin-top: 3.5rem;
    margin-bottom: 1.25rem;
    font-size: 1.625rem;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: #0f172a; /* slate-900 */
  }
  :global(.article-prose > h3) {
    margin-top: 2.25rem;
    margin-bottom: 0.75rem;
    font-size: 1.2rem;
    line-height: 1.375;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  :global(.article-prose > p a) {
    color: #1b613c;
    font-weight: 500;
    text-decoration: none;
  }
  :global(.article-prose > p a:hover) {
    text-decoration: underline;
  }
  :global(.article-prose > p strong) {
    font-weight: 600;
    color: #0f172a;
  }

  @media (min-width: 640px) {
    :global(.article-prose > p) {
      margin-bottom: 1.75rem;
      font-size: 1.1875rem; /* ~19px — nudged down from 20px per editorial */
    }
    :global(.article-prose > h2) {
      font-size: 1.875rem;
    }
    :global(.article-prose > h3) {
      font-size: 1.35rem;
    }
  }

  /* Serif dropcap on the opening paragraph. */
  :global(.article-prose > p:first-of-type)::first-letter {
    float: left;
    margin-right: 0.5rem;
    margin-top: 0.32rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 3.5rem;
    font-weight: 400;
    line-height: 0.82;
    color: #1e293b;
  }
</style>
