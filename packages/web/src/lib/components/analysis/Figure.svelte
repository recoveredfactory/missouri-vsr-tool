<script>
  // Wrapper for an analysis figure: a heading, the chart (default slot), an
  // optional caption, a source line, and a visually-hidden text summary for
  // screen readers. Keeps every figure in an article visually consistent.
  export let title = "";
  export let caption = "";
  export let source = "";
  /** Visually-hidden one-line summary read to assistive tech. */
  export let summary = "";
</script>

<figure class="my-8 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
  {#if title}
    <h3 class="mb-1 text-base font-bold text-slate-900 sm:text-lg">{title}</h3>
  {/if}
  {#if caption}
    <p class="mb-4 text-sm leading-relaxed text-slate-600">{caption}</p>
  {/if}

  {#if summary}
    <div class="sr-only">{summary}</div>
  {/if}

  <div class="not-prose">
    <slot />
  </div>

  {#if source}
    <figcaption class="mt-3 text-xs text-slate-400">{source}</figcaption>
  {/if}
</figure>
