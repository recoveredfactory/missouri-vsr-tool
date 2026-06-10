<script>
  // Wrapper for an analysis figure: a heading, the chart (default slot), an
  // optional caption, a source line, and a visually-hidden text summary for
  // screen readers. `not-prose` so it sits cleanly inside the article's prose.
  export let title = "";
  export let caption = "";
  export let source = "";
  /** Visually-hidden one-line summary read to assistive tech. */
  export let summary = "";
</script>

<figure class="chart-fig not-prose my-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
  {#if title}
    <h3 class="text-base font-semibold leading-snug text-slate-900 sm:text-lg">{title}</h3>
  {/if}
  {#if caption}
    <p class="mt-1.5 text-sm leading-relaxed text-slate-500">{caption}</p>
  {/if}

  {#if summary}
    <div class="sr-only">{summary}</div>
  {/if}

  <div class="mt-5">
    <slot />
  </div>

  {#if source}
    <figcaption class="mt-5 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
      {source}
    </figcaption>
  {/if}
</figure>

<style>
  /* Break charts out wider than the reading column on desktop, centered on
     the viewport. Mobile (~60% of readers) keeps the full-column width. The
     width cap prevents any horizontal overflow. */
  @media (min-width: 1024px) {
    figure.chart-fig {
      width: min(64rem, calc(100vw - 3rem));
      margin-left: 50%;
      transform: translateX(-50%);
    }
  }
</style>
