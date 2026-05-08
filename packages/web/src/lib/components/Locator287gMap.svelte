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
  /**
   * Slugs of all 287(g) participants. Each path with a matching id gets a
   * `.participant` class added and is moved to the end of its parent group
   * so it paints on top of the non-participant base layer (SVG has no
   * z-index — paint order is document order).
   */
  export let participantSlugs: string[] = [];

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

      // Tag 287(g) participants and reorder them to the end of their parent
      // group so they paint on top of the non-participant base layer.
      for (const slug of participantSlugs) {
        const safeSlug = cssEscape(slug);
        const path = svg.querySelector(`#agency-${safeSlug}`);
        if (path) {
          path.classList.add("participant");
          path.parentElement?.appendChild(path);
        }
      }

      // Highlight the current agency last so it paints over everything.
      const safeCurrent = cssEscape(agencySlug);
      const currentPath = svg.querySelector(`#agency-${safeCurrent}`);
      if (currentPath) {
        currentPath.classList.add("locator-current");
        currentPath.parentElement?.appendChild(currentPath);
      }

      // State outline paints on top of every fill so the border reads cleanly.
      const statePath = svg.querySelector(".state");
      if (statePath) svg.appendChild(statePath);

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
  /* MO outline: just the state border, no fill. */
  .locator287g-frame :global(.state) {
    fill: none;
    stroke: #475569;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  /* Non-participant agencies: undifferentiated light-gray basemap, no stroke. */
  .locator287g-frame :global(.agency) {
    fill: #e2e8f0;
    stroke: none;
  }
  /* 287(g) participants: darker fill, white separators, painted above the base. */
  .locator287g-frame :global(.agency.participant) {
    fill: #94a3b8;
    stroke: #ffffff;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  /* Current agency on this card: bright blue + dark outline, on top. */
  .locator287g-frame :global(.agency.locator-current) {
    fill: #2563eb;
    stroke: #1e3a8a;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
  }
  /* Centroids hidden for now — keeping them in the source SVG for later. */
  .locator287g-frame :global(circle.centroid) {
    display: none;
  }
</style>
