<script lang="ts" context="module">
  import { withDataBase } from "$lib/dataBase";

  /**
   * Pipeline-emitted SVG (`mo_locator.svg`): one `<svg viewBox="…">`
   * containing
   *   - one `<path class="state">` for the MO outline
   *   - one `<g class="agencies">` of `<path class="agency" id="agency-{slug}">`
   *   - one `<g class="centroids">` of `<circle class="centroid" data-slug="{slug}">`
   * No inline fill/stroke — all visual styling lives in this component's CSS.
   *
   * Loaded ONCE per session and parsed into a DocumentFragment, so each of
   * the 78 cards just clones the parsed tree (no re-parse, no per-card
   * network).
   */
  const LOCATOR_SVG_URL = withDataBase("/data/dist/mo_locator.svg");

  let sharedFragmentPromise: Promise<DocumentFragment | null> | null = null;
  const loadLocatorFragment = (): Promise<DocumentFragment | null> => {
    if (!sharedFragmentPromise) {
      sharedFragmentPromise = fetch(LOCATOR_SVG_URL)
        .then((r) => (r.ok ? r.text() : ""))
        .then((text) => {
          if (!text) return null;
          const doc = new DOMParser().parseFromString(text, "image/svg+xml");
          const svg = doc.documentElement;
          if (!svg || svg.nodeName.toLowerCase() !== "svg") return null;
          const fragment = document.createDocumentFragment();
          fragment.appendChild(svg);
          return fragment;
        })
        .catch(() => null);
    }
    return sharedFragmentPromise;
  };

  const cssEscape = (raw: string): string =>
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(raw)
      : raw.replace(/[^a-zA-Z0-9_-]/g, "");
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  export let agencySlug: string;

  let container: HTMLDivElement | undefined;
  let visible = false;
  let injected = false;
  let observer: IntersectionObserver | null = null;

  $: if (browser && container && !visible) {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              visible = true;
              observer?.disconnect();
              observer = null;
              break;
            }
          }
        },
        // Generous so cards near the top (e.g. MSHP first card) load right
        // after page hydrate, and the rest pre-load before scroll.
        { rootMargin: "2400px 0px" },
      );
      observer.observe(container);
    }
  }

  $: if (visible && !injected && container) {
    injected = true;
    void loadLocatorFragment().then((fragment) => {
      if (!fragment || !container) return;
      // Clone the parsed tree so the shared source stays untouched.
      const cloned = fragment.cloneNode(true) as DocumentFragment;
      const svg = cloned.querySelector("svg");
      if (!svg) return;
      const safe = cssEscape(agencySlug);
      svg.querySelector(`#agency-${safe}`)?.classList.add("locator-current");
      svg
        .querySelector(`circle.centroid[data-slug="${safe}"]`)
        ?.classList.add("locator-current");
      container.replaceChildren(svg);
    });
  }

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
  });
</script>

<div
  bind:this={container}
  class="locator287g-frame relative aspect-square w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:aspect-auto sm:w-72 sm:self-stretch"
  aria-hidden="true"
></div>

<style>
  .locator287g-frame :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  /* MO outline: pale background — agency polygons provide structure on top. */
  .locator287g-frame :global(.state) {
    fill: #f1f5f9;
    stroke: none;
  }
  /* All jurisdictions: light gray fill with white separators. */
  .locator287g-frame :global(.agency) {
    fill: #cbd5e1;
    stroke: #ffffff;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  /* Tiny dot at each agency centroid. r is in viewBox units (viewBox ~5.2×4.6). */
  .locator287g-frame :global(circle.centroid) {
    fill: #475569;
    r: 0.035;
  }
  /* Current agency on this card: bright blue fill + dark outline. */
  .locator287g-frame :global(.agency.locator-current) {
    fill: #2563eb;
    stroke: #1e3a8a;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
  }
  /* Highlighted centroid for the current agency: a bigger pin with a
   * white ring so it pops even when the polygon is tiny. */
  .locator287g-frame :global(circle.centroid.locator-current) {
    fill: #1d4ed8;
    stroke: #ffffff;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    r: 0.09;
  }
</style>
