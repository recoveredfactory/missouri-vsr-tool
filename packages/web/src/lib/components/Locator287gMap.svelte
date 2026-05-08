<script lang="ts" context="module">
  import { withDataBase } from "$lib/dataBase";

  /**
   * Pipeline output: one SVG with the MO outline + one path per
   * participating agency, each `<path id="agency-{slug}">`. Until the
   * pipeline emits this file, locator boxes render blank (no error).
   *
   * Spec for the pipeline:
   *   - <svg viewBox="…" preserveAspectRatio="xMidYMid meet">
   *   - <path class="state"> for the MO outline (rendered behind agencies)
   *   - <path class="agency" id="agency-{slug}"> per participating agency
   *   - Optional: <circle class="centroid" data-slug="{slug}">
   *   - No inline fill/stroke — let CSS in this component handle styling.
   */
  const LOCATOR_SVG_URL = withDataBase("/data/dist/287g_locator.svg");

  let sharedSvgPromise: Promise<string> | null = null;
  const loadLocatorSvg = (): Promise<string> => {
    if (!sharedSvgPromise) {
      sharedSvgPromise = fetch(LOCATOR_SVG_URL)
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => "");
    }
    return sharedSvgPromise;
  };
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  export let agencySlug: string;

  let container: HTMLDivElement | undefined;
  let visible = false;
  let svgHtml = "";
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
        { rootMargin: "2400px 0px" },
      );
      observer.observe(container);
    }
  }

  $: if (visible && !svgHtml) {
    void loadLocatorSvg().then((html) => {
      svgHtml = html;
    });
  }

  $: if (svgHtml && container && agencySlug) {
    queueMicrotask(() => {
      if (!container) return;
      container.querySelectorAll(".locator-current").forEach((el) => {
        el.classList.remove("locator-current");
      });
      const safe = agencySlug.replace(/[^a-zA-Z0-9_-]/g, "");
      const path = container.querySelector(`#agency-${safe}`);
      path?.classList.add("locator-current");
      const dot = container.querySelector(`[data-slug="${safe}"]`);
      dot?.classList.add("locator-current");
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
>
  {#if svgHtml}
    {@html svgHtml}
  {/if}
</div>

<style>
  .locator287g-frame :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .locator287g-frame :global(.state) {
    fill: #f1f5f9;
    stroke: #cbd5e1;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
  }
  .locator287g-frame :global(.agency) {
    fill: #cbd5e1;
    stroke: #94a3b8;
    stroke-width: 0.4;
    vector-effect: non-scaling-stroke;
  }
  .locator287g-frame :global(.centroid) {
    fill: #64748b;
    r: 1.4;
  }
  .locator287g-frame :global(.agency.locator-current) {
    fill: #1d4ed8;
    stroke: #1e3a8a;
    stroke-width: 0.8;
  }
  .locator287g-frame :global(.centroid.locator-current) {
    fill: #1e3a8a;
    r: 2.2;
  }
</style>
