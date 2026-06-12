<script>
  import ChartTooltip from "./ChartTooltip.svelte";

  // Graphic 3 — stacked area of statewide search volume by reason
  // (consent / smell of drugs or alcohol / all other), per year.
  //
  // The "smell" band collapses after 2022 (cannabis legalized Dec 2022;
  // reporting-form change in 2023), annotated inline. Bands stack bottom->top:
  // all other, consent, smell — so the shrinking stories sit on top.
  //
  // Mobile-first: a compact viewBox keeps the text legible when the SVG scales
  // down on a phone. Series are labeled DIRECTLY on each band (at its thickest
  // column) instead of a separate legend, so a reader never has to map a swatch
  // back to a color.
  export let data; // SearchReasonsData: { years, consent, smell, other, reliableFromYear }
  // The odor reason wasn't reported separately from 2009–2017, so starting at
  // 2018 gives the "smell" band an unbroken run.
  export let startYear = 2018;
  export let labels = {
    consent: "Consent",
    smell: "Smell of drugs / alcohol",
    other: "All other reasons",
    cannabis: "Recreational cannabis legalized",
  };

  const COLORS = { other: "#cbd5e1", consent: "#0e7490", smell: "#c2410c" };

  const W = 440;
  const H = 300;
  const pad = { top: 26, right: 16, bottom: 32, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Clip every parallel series to the shared window.
  $: i0 = Math.max(0, data.years.findIndex((y) => y >= startYear));
  $: years = data.years.slice(i0);
  $: n = years.length;
  // Stack order bottom -> top.
  $: stack = [
    { key: "other", values: data.other.slice(i0), color: COLORS.other, label: labels.other },
    { key: "consent", values: data.consent.slice(i0), color: COLORS.consent, label: labels.consent },
    { key: "smell", values: data.smell.slice(i0), color: COLORS.smell, label: labels.smell },
  ];
  $: totals = years.map((_, i) => stack.reduce((s, b) => s + b.values[i], 0));
  $: yMax = Math.ceil(Math.max(...totals, 1) / 20000) * 20000;

  const x = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  $: y = (v) => pad.top + (1 - v / yMax) * plotH;

  // Cumulative tops for each band (running sum from the bottom of the stack).
  $: bands = (() => {
    let lower = years.map(() => 0);
    const out = [];
    for (const b of stack) {
      const upper = lower.map((lo, i) => lo + b.values[i]);
      out.push({ ...b, lower: lower.slice(), upper: upper.slice() });
      lower = upper;
    }
    return out;
  })();

  const areaPath = (band) => {
    const top = band.upper.map((v, i) => `${x(i)},${y(v)}`);
    const bottom = band.lower.map((v, i) => `${x(i)},${y(v)}`).reverse();
    return `M${top.join("L")}L${bottom.join("L")}Z`;
  };

  // "Consent" and "All other reasons" are labeled directly inside their bands,
  // anchored at ONE column so they line up as a tidy left-aligned stack. The
  // column is where the thinner of the two is thickest. ("Smell" collapses
  // after 2022, so it's labeled separately, off to the right — see markup.)
  $: inlineBands = bands.filter((b) => b.key !== "smell");
  $: labelIdx = (() => {
    let idx = 0;
    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      const minT = Math.min(...inlineBands.map((b) => b.upper[i] - b.lower[i]));
      if (minT > best) { best = minT; idx = i; }
    }
    return idx;
  })();
  $: labelX = Math.min(Math.max(x(labelIdx) + 18, pad.left + 12), pad.left + plotW - 150);
  // Light "other" band takes dark text; the saturated consent band white.
  const labelFor = (band) => ({
    y: y((band.upper[labelIdx] + band.lower[labelIdx]) / 2),
    fill: band.key === "other" ? "#334155" : "#ffffff",
    text: band.label,
  });

  // The legalization effect lands in the 2023 data (sales began 2023; the smell
  // band collapses that year), so the marker sits on the 2023 point.
  $: i2022 = years.indexOf(2022);
  $: i2023 = years.indexOf(2023);
  $: cannabisX = i2023 >= 0 ? x(i2023) : i2022 >= 0 ? x(i2022) : null;
  // Show first, last, the 2023 effect year, and the even years (skipping 2024
  // so it doesn't crowd the 2025 endpoint).
  $: yearTicks = years
    .map((yr, i) => ({ yr, i }))
    .filter(({ yr, i }) => i === 0 || i === n - 1 || yr === 2023 || (yr % 2 === 0 && yr !== 2024));
  $: fmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

  // Floating tooltip — positioned relative to the .tip-host wrapper.
  let tip = null;
  const showTip = (e, payload) => {
    const host = e.currentTarget.closest(".tip-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    tip = {
      x: Math.max(80, Math.min(r.width - 80, e.clientX - r.left)),
      y: e.clientY - r.top,
      ...payload,
    };
  };
  const hideTip = () => (tip = null);
  const tipRows = (i) => [
    { label: "Consent", value: stack[1].values[i].toLocaleString(), color: COLORS.consent },
    { label: "Smell of drugs / alcohol", value: stack[2].values[i].toLocaleString(), color: COLORS.smell },
    { label: "All other reasons", value: stack[0].values[i].toLocaleString(), color: COLORS.other },
  ];
</script>

<div class="tip-host relative mx-auto max-w-xl">
  <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
    <!-- y grid + labels -->
    {#each [0, 0.5, 1] as t}
      <line x1={pad.left} y1={y(yMax * t)} x2={pad.left + plotW} y2={y(yMax * t)} stroke="#e2e8f0" stroke-width="1" />
      <text x={pad.left - 7} y={y(yMax * t) + 4} text-anchor="end" font-size="12.5" fill="#94a3b8">{fmt(yMax * t)}</text>
    {/each}

    <!-- bands: lighter fill, with the band's own color picked out as a crisp
         stroke along the top edge so the shape reads more from the line than
         the wash -->
    {#each bands as band}
      <path d={areaPath(band)} fill={band.color} fill-opacity="0.55" />
      <polyline points={band.upper.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none" stroke={band.color} stroke-width="2.75" stroke-linejoin="round" />
    {/each}

    <!-- inline labels for consent + all-other, left-aligned at one column -->
    {#each inlineBands as band}
      {@const l = labelFor(band)}
      <text x={labelX} y={l.y + 9} text-anchor="start" font-size="14" font-weight="700" fill={l.fill}>{l.text}</text>
    {/each}

    <!-- "smell" collapses after 2022; label it in its own color riding above
         the band on the left, where the band is tall and the top dips away -->
    <text x={pad.left + 12} y={pad.top + 10} text-anchor="start" font-size="14" font-weight="700" fill={COLORS.smell}>{labels.smell}</text>

    <!-- cannabis marker on the 2023 point; label stacked to the right of the
         line so it fits in the narrow space before the chart's right edge -->
    {#if cannabisX != null}
      <line x1={cannabisX} y1={pad.top} x2={cannabisX} y2={pad.top + plotH} stroke="#334155" stroke-width="1" stroke-dasharray="3 3" />
      {#each labels.cannabis.split(" ") as word, wi}
        <text x={cannabisX + 6} y={pad.top + 12 + wi * 14} text-anchor="start" font-size="12" fill="#334155" font-weight="600">{word}</text>
      {/each}
    {/if}

    <!-- x ticks -->
    {#each yearTicks as { yr, i }}
      <text x={x(i)} y={pad.top + plotH + 19} text-anchor="middle" font-size="11.5" fill="#64748b">{yr}</text>
    {/each}

    <!-- vertical locator on hover (over the bands, under the tooltip) -->
    {#if tip && tip.lx != null}
      <line x1={tip.lx} y1={pad.top} x2={tip.lx} y2={pad.top + plotH} stroke="#1e293b" stroke-width="1" opacity="0.4" />
    {/if}

    <!-- per-year hover columns drive the floating tooltip + locator -->
    {#each years as yr, i}
      {@const bw = n > 1 ? plotW / (n - 1) : plotW}
      <rect x={x(i) - bw / 2} y={pad.top} width={bw} height={plotH} fill="transparent"
            on:pointermove={(e) => showTip(e, { title: yr, lx: x(i), rows: tipRows(i) })}
            on:pointerleave={hideTip} />
    {/each}
  </svg>
  <ChartTooltip {tip} />
</div>
