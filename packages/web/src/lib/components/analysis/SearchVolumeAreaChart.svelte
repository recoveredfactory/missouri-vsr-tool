<script>
  // Graphic 3 — stacked area of statewide search volume by reason
  // (consent / smell of drugs or alcohol / all other), per year.
  //
  // Direct band labels, no legend. The "smell" band collapses after 2022
  // (cannabis legalized Dec 2022; reporting-form change in 2023), which we
  // annotate inline. Bands stack bottom->top: all other, consent, smell — so
  // the two shrinking stories sit on top where the change reads clearly.
  export let data; // SearchReasonsData: { years, consent, smell, other, reliableFromYear }
  export let labels = {
    consent: "Consent",
    smell: "Smell of drugs / alcohol",
    other: "All other reasons",
    cannabis: "Recreational cannabis legalized, Dec 2022",
    yAxis: "Searches",
  };

  const W = 720;
  const H = 360;
  const pad = { top: 24, right: 132, bottom: 36, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  $: years = data.years;
  $: n = years.length;
  // Stack order bottom -> top.
  $: stack = [
    { key: "other", values: data.other, color: "#cbd5e1", label: labels.other },
    { key: "consent", values: data.consent, color: "#0e7490", label: labels.consent },
    { key: "smell", values: data.smell, color: "#c2410c", label: labels.smell },
  ];
  $: totals = years.map((_, i) => stack.reduce((s, b) => s + b.values[i], 0));
  $: yMax = Math.ceil(Math.max(...totals, 1) / 20000) * 20000;

  const x = (i) => pad.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  $: y = (v) => pad.top + (1 - v / yMax) * plotH;

  // Cumulative tops for each band (running sum from the bottom of the stack).
  $: bands = (() => {
    const base = years.map(() => 0);
    const out = [];
    let lower = base.slice();
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

  // Label each band at its right edge, vertically centered in its last slice.
  $: labelY = (band) => y((band.upper[n - 1] + band.lower[n - 1]) / 2);

  $: cannabisIdx = years.indexOf(2022);
  $: yearTicks = years
    .map((yr, i) => ({ yr, i }))
    .filter(({ yr, i }) => yr % 5 === 0 || i === 0 || i === n - 1);
  $: fmt = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);
</script>

<svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
  <!-- y grid + labels -->
  {#each [0, 0.25, 0.5, 0.75, 1] as t}
    <line x1={pad.left} y1={y(yMax * t)} x2={pad.left + plotW} y2={y(yMax * t)} stroke="#eef2f6" stroke-width="1" />
    <text x={pad.left - 8} y={y(yMax * t) + 3} text-anchor="end" font-size="11" fill="#94a3b8">{fmt(yMax * t)}</text>
  {/each}
  <text x={pad.left - 8} y={pad.top - 10} text-anchor="end" font-size="10" fill="#64748b" font-weight="600">{labels.yAxis}</text>

  <!-- bands -->
  {#each bands as band}
    <path d={areaPath(band)} fill={band.color} opacity="0.92" />
  {/each}

  <!-- cannabis annotation -->
  {#if cannabisIdx >= 0}
    <line x1={x(cannabisIdx)} y1={pad.top} x2={x(cannabisIdx)} y2={pad.top + plotH} stroke="#475569" stroke-width="1" stroke-dasharray="3 3" />
    <text x={x(cannabisIdx) - 6} y={pad.top + 12} text-anchor="end" font-size="10" fill="#475569" font-weight="600">
      {labels.cannabis}
    </text>
  {/if}

  <!-- x ticks -->
  {#each yearTicks as { yr, i }}
    <text x={x(i)} y={pad.top + plotH + 18} text-anchor="middle" font-size="11" fill="#64748b">{yr}</text>
  {/each}

  <!-- direct band labels at right edge -->
  {#each bands as band}
    <text x={pad.left + plotW + 8} y={labelY(band) + 3} font-size="11" font-weight="600" fill={band.color}>
      {band.label}
    </text>
  {/each}
</svg>
