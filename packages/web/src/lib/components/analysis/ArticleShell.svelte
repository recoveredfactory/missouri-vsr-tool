<script>
  // Visual frame for an analysis article — modeled on the 287(g) page:
  // a large title + dek hero with a byline/date line, then a styled prose
  // body with a serif dropcap on the opening paragraph.
  //
  // Lives as a *component* (not raw HTML in the .md) so mdsvex parses the
  // markdown placed in its default slot.
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

  <article
    class="article-prose prose prose-slate max-w-none
      prose-p:my-0 prose-p:mb-8 prose-p:text-[1.3rem] prose-p:leading-[1.75] prose-p:text-slate-700
      sm:prose-p:mb-9 sm:prose-p:text-[1.45rem]
      prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-900
      prose-h2:mb-6 prose-h2:mt-16 prose-h2:text-3xl prose-h2:leading-tight sm:prose-h2:text-4xl
      prose-h3:mb-3 prose-h3:mt-10 prose-h3:text-xl prose-h3:leading-snug sm:prose-h3:text-2xl
      prose-a:font-medium prose-a:text-[#1b613c] prose-a:no-underline hover:prose-a:underline
      prose-strong:font-semibold prose-strong:text-slate-900"
  >
    <slot />
  </article>
</main>

<style>
  /* Serif dropcap on the article's opening paragraph (slot content, so :global). */
  :global(.article-prose > p:first-of-type)::first-letter {
    float: left;
    margin-right: 0.5rem;
    margin-top: 0.3rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 4.25rem;
    font-weight: 400;
    line-height: 0.82;
    color: #1e293b;
  }
</style>
