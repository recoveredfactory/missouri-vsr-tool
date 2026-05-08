<script lang="ts" context="module">
  import { withDataBase } from "$lib/dataBase";

  /** Pipeline-emitted SVG (`mo_locator.svg`). Contains state outline, all
   *  agency polygons (some with `class="county"`), all centroids, and —
   *  in v2.1+ — a `<g class="roads">` of major highways. No inline style. */
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

  const SVG_NS = "http://www.w3.org/2000/svg";

  export type LocatorTooltipInfo = {
    name: string;
    subtitle?: string;
    stops?: string;
    agreement?: string;
  };
</script>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { browser } from "$app/environment";

  export let agencySlug: string;
  export let participantSlugs: string[] = [];
  export let dotSlugs: string[] = [];
  export let countySlugs: string[] = [];
  export let allCountySlugs: string[] = [];
  export let tooltips: Record<string, LocatorTooltipInfo> = {};

  let container: HTMLDivElement | undefined;
  let inner: HTMLDivElement | undefined;
  let visible = false;
  let injected = false;
  let observer: IntersectionObserver | null = null;

  let tooltipSlug: string | null = null;
  let tooltipX = 0;
  let tooltipY = 0;
  $: tooltipInfo = tooltipSlug ? tooltips[tooltipSlug] ?? null : null;

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

  const wrapInteractive = (
    el: Element,
    slug: string,
  ): void => {
    const parent = el.parentNode;
    if (!parent) return;
    const a = document.createElementNS(SVG_NS, "a");
    a.setAttribute("href", `#agency-${slug}`);
    a.setAttribute("class", "locator-link");
    a.setAttribute("data-slug", slug);
    parent.insertBefore(a, el);
    a.appendChild(el);
  };

  const handleEnter = (event: Event) => {
    const target = (event.target as Element | null)?.closest?.(
      "[data-slug]",
    ) as Element | null;
    const slug = target?.getAttribute("data-slug");
    if (!slug || !tooltips[slug]) return;
    tooltipSlug = slug;
    positionTooltip(event as MouseEvent);
  };
  const handleMove = (event: Event) => {
    if (tooltipSlug) positionTooltip(event as MouseEvent);
  };
  const handleLeave = () => {
    tooltipSlug = null;
  };

  const positionTooltip = (event: MouseEvent) => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    tooltipX = event.clientX - rect.left;
    tooltipY = event.clientY - rect.top;
  };

  $: if (visible && !injected && inner) {
    injected = true;
    void loadLocatorFragment().then((fragment) => {
      if (!fragment || !inner) return;
      const cloned = fragment.cloneNode(true) as DocumentFragment;
      const svg = cloned.querySelector("svg");
      if (!svg) return;

      // Pad the viewBox a hair so the state stroke doesn't get clipped at
      // the viewport edge and so we get a small gutter around MO.
      const vb = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
      if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
        const [x, y, w, h] = vb;
        const pad = Math.max(w, h) * 0.02;
        svg.setAttribute(
          "viewBox",
          `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`,
        );
      }

      // Paint order:
      //   1. <g class="agencies">          base counties + non-participants
      //   2. <g class="muni-participants"> (hidden via CSS — kept for cleanup)
      //   3. <g class="roads">             roads above fills, below dots
      //   4. <g class="centroids">         only muni-participant dots visible
      //   5. <path class="state">          state border on top of fills
      //   6. current-agency element        orange highlight, above everything
      const agenciesGroup = svg.querySelector("g.agencies");
      const centroidsGroup = svg.querySelector("g.centroids");
      const roadsGroup =
        svg.querySelector("g.roads") || svg.querySelector("g.road");
      const statePath = svg.querySelector(".state");

      const countySet = new Set(countySlugs);
      for (const slug of allCountySlugs) {
        const path = svg.querySelector(`#agency-${cssEscape(slug)}`);
        path?.classList.add("county");
      }

      const muniGroup = document.createElementNS(SVG_NS, "g");
      muniGroup.setAttribute("class", "muni-participants");
      agenciesGroup?.parentElement?.insertBefore(
        muniGroup,
        agenciesGroup.nextSibling,
      );
      // Order: agencies → muni → roads → centroids
      if (roadsGroup) {
        muniGroup.parentElement?.insertBefore(roadsGroup, muniGroup.nextSibling);
      }
      if (centroidsGroup) {
        const after = roadsGroup ?? muniGroup;
        after.parentElement?.insertBefore(centroidsGroup, after.nextSibling);
      }

      for (const slug of countySlugs) {
        const path = svg.querySelector(`#agency-${cssEscape(slug)}`);
        if (!path) continue;
        path.classList.add("participant", "county");
        agenciesGroup?.appendChild(path);
        if (slug !== agencySlug) wrapInteractive(path, slug);
      }

      for (const slug of participantSlugs) {
        if (countySet.has(slug)) continue;
        const path = svg.querySelector(`#agency-${cssEscape(slug)}`);
        if (!path) continue;
        path.classList.add("participant");
        muniGroup.appendChild(path);
      }

      let currentHasFeature = false;
      if (centroidsGroup) {
        const showSet = new Set(dotSlugs);
        for (const circle of Array.from(
          centroidsGroup.querySelectorAll("circle.centroid"),
        )) {
          const slug = circle.getAttribute("data-slug") ?? "";
          if (!showSet.has(slug)) continue;
          circle.classList.add("dot-visible");
          if (slug === agencySlug) {
            circle.classList.add("locator-current");
            currentHasFeature = true;
          } else {
            wrapInteractive(circle, slug);
          }
        }
      }

      if (statePath) svg.appendChild(statePath);

      if (countySet.has(agencySlug)) {
        const currentPath = svg.querySelector(`#agency-${cssEscape(agencySlug)}`);
        if (currentPath) {
          currentPath.classList.remove("participant", "county");
          currentPath.classList.add("locator-current");
          svg.appendChild(currentPath);
          currentHasFeature = true;
        }
      }

      // State agencies (e.g. MSHP) have no polygon and no centroid in the
      // SVG. As a fallback, light up the state border itself in orange.
      if (!currentHasFeature && statePath) {
        statePath.classList.add("locator-current");
      }

      svg.addEventListener("mouseover", handleEnter);
      svg.addEventListener("mousemove", handleMove);
      svg.addEventListener("mouseout", handleLeave);

      inner.replaceChildren(svg);
    });
  }

  onDestroy(() => {
    observer?.disconnect();
    observer = null;
  });
</script>

<div
  bind:this={container}
  class="locator287g-frame relative w-44 shrink-0 sm:w-72 sm:self-stretch"
>
  <div
    bind:this={inner}
    class="aspect-square h-full w-full overflow-hidden sm:aspect-auto"
  ></div>
  {#if tooltipInfo}
    <div
      class="locator287g-tooltip pointer-events-none absolute z-10 max-w-[16rem] rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-tight shadow-lg"
      style="left:{tooltipX + 12}px; top:{tooltipY + 12}px;"
    >
      <div class="font-semibold text-slate-900">{tooltipInfo.name}</div>
      {#if tooltipInfo.subtitle}
        <div class="mt-0.5 text-slate-600">{tooltipInfo.subtitle}</div>
      {/if}
      {#if tooltipInfo.stops}
        <div class="mt-0.5 text-slate-700">{tooltipInfo.stops}</div>
      {/if}
      {#if tooltipInfo.agreement}
        <div class="mt-1 text-slate-700">{tooltipInfo.agreement}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .locator287g-frame :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    /* Smoother strokes for thin lines under non-scaling-stroke. */
    shape-rendering: geometricPrecision;
    text-rendering: geometricPrecision;
  }
  /* MO outline: hairline state border. */
  .locator287g-frame :global(.state) {
    fill: none;
    stroke: #cbd5e1;
    stroke-width: 0.5;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  /* When the current card is a state agency (no polygon / no centroid in
   * the SVG), light up the state border itself in orange. */
  .locator287g-frame :global(.state.locator-current) {
    stroke: #f97316;
    stroke-width: 2;
  }
  /* Non-participant agencies: undifferentiated light-gray basemap, no stroke. */
  .locator287g-frame :global(.agency) {
    fill: #e2e8f0;
    stroke: none;
  }
  /* Counties (participating or not) get a faint white separator. */
  .locator287g-frame :global(.agency.county) {
    stroke: #ffffff;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
  }
  /* County participants: a little darker than the basemap. */
  .locator287g-frame :global(.agency.participant.county) {
    fill: #cbd5e1;
  }
  /* Muni participants are hidden — the dot is their only representation. */
  .locator287g-frame :global(.muni-participants .agency.participant) {
    display: none;
  }
  /* Roads: subtle thin gray lines above fills, below dots. */
  .locator287g-frame :global(g.roads path),
  .locator287g-frame :global(.road) {
    fill: none;
    stroke: #94a3b8;
    stroke-width: 0.5;
    stroke-opacity: 0.6;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* State highways drop further back so interstates / US highways read first. */
  .locator287g-frame :global(.state-highway),
  .locator287g-frame :global(g.roads path.state-highway) {
    stroke: #cbd5e1;
    stroke-width: 0.35;
    stroke-opacity: 0.5;
  }
  /* Current agency on this card: hot orange fill, no rim. */
  .locator287g-frame :global(.agency.locator-current) {
    fill: #f97316;
    stroke: none;
  }
  /* Centroids: hidden by default; opt-in via .dot-visible. */
  .locator287g-frame :global(circle.centroid) {
    display: none;
  }
  .locator287g-frame :global(circle.centroid.dot-visible) {
    display: inline;
    fill: #64748b;
    r: 0.05;
  }
  .locator287g-frame :global(circle.centroid.dot-visible.locator-current) {
    fill: #f97316;
    stroke: none;
    r: 0.11;
  }
  .locator287g-frame :global(.locator-link) {
    cursor: pointer;
  }
  .locator287g-frame :global(.locator-link:hover .agency.participant.county) {
    fill: #94a3b8;
  }
  .locator287g-frame :global(.locator-link:hover circle.centroid.dot-visible) {
    fill: #334155;
    r: 0.075;
  }
</style>
