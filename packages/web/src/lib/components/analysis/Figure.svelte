<script>
  // Wrapper for an analysis figure. Editorial, not boxed: the chart sits in the
  // flow of the prose rather than inside a card, so a finding can run straight
  // from a paragraph into its graphic. A faint top rule + small label set it
  // apart without the heavy border/shadow of a card.
  //
  // `not-prose` so the article's prose rules don't touch the figure internals.
  export let title = ""; // optional kicker; omit to let the chart stand alone
  export let caption = "";
  export let source = "";
  /** Visually-hidden one-line summary read to assistive tech. */
  export let summary = "";
  /** Hug the preceding paragraph (small top margin) — "right into the chart". */
  export let flush = false;
  /** Break out wider than the default on large screens. */
  export let wide = false;
</script>

<figure class="chart-fig not-prose {flush ? 'mt-2 mb-12' : 'my-12'}" class:wide>
  {#if title || caption}
    <div class="mb-4">
      {#if title}
        <div class="text-[0.95rem] font-semibold leading-snug text-slate-900">{title}</div>
      {/if}
      {#if caption}
        <p class="mt-1 text-sm leading-relaxed text-slate-500">{caption}</p>
      {/if}
    </div>
  {/if}

  {#if summary}
    <div class="sr-only">{summary}</div>
  {/if}

  <slot />

  {#if source}
    <figcaption class="mt-4 text-xs leading-relaxed text-slate-400">
      {source}
    </figcaption>
  {/if}
</figure>

<style>
  /* A figure stays in the reading column by default so its caption/source line
     can't outrun a width-capped chart. Only `wide` figures (the small-multiple
     charts that need the room) break out past the column on desktop, centered
     on the viewport; the width cap prevents horizontal overflow. */
  @media (min-width: 1024px) {
    figure.chart-fig.wide {
      width: min(74rem, calc(100vw - 3rem));
      margin-left: 50%;
      transform: translateX(-50%);
    }
  }
</style>
