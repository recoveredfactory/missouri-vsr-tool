<script>
  // Visual frame for an analysis article — modeled on the 287(g) page:
  // an eyebrow + large title + dek hero, then a styled prose body with a
  // serif dropcap on the opening paragraph.
  //
  // Lives as a *component* (not raw HTML in the .md) so mdsvex parses the
  // markdown placed in its default slot.
  export let kicker = "";
  export let title = "";
  export let dek = "";
  export let dateLabel = "";
</script>

<main id="main-content" class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
  <header class="mb-10 sm:mb-12">
    {#if kicker}
      <div class="text-xs font-semibold uppercase tracking-[0.2em] text-[#1b613c]">{kicker}</div>
    {/if}
    {#if title}
      <h1 class="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">{title}</h1>
    {/if}
    {#if dek}
      <p class="mt-5 text-xl font-light leading-relaxed text-slate-500 sm:text-2xl">{dek}</p>
    {/if}
    {#if dateLabel}
      <div class="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500">{dateLabel}</div>
    {/if}
  </header>

  <article
    class="article-prose prose prose-slate max-w-none
      prose-p:text-[1.2rem] prose-p:leading-[1.8] prose-p:text-slate-700 prose-p:my-7
      sm:prose-p:text-[1.3rem] sm:prose-p:my-8
      prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-slate-900
      prose-h2:mt-16 prose-h2:mb-5 prose-h2:text-[1.7rem] prose-h2:leading-snug sm:prose-h2:text-[2rem]
      prose-a:font-medium prose-a:text-[#1b613c] prose-a:no-underline hover:prose-a:underline
      prose-strong:text-slate-900 prose-strong:font-semibold"
  >
    <slot />
  </article>
</main>

<style>
  /* Serif dropcap on the article's opening paragraph (slot content, so :global). */
  :global(.article-prose > p:first-of-type)::first-letter {
    float: left;
    margin-right: 0.5rem;
    margin-top: 0.35rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 4rem;
    font-weight: 400;
    line-height: 0.85;
    color: #1e293b;
  }
</style>
