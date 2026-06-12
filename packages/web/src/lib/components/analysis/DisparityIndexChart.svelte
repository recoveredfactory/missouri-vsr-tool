<script>
  import { raceColor } from "./colors";
  import ChartTooltip from "./ChartTooltip.svelte";

  // Graphic 2 — small multiple, one panel per outcome (stops / searches /
  // arrests). Within each panel, the disparity index for White / Black /
  // Hispanic drivers. 1.0× is parity (stopped/searched/arrested in proportion
  // to the group's 16+ population); 1.9× means 1.9 times as often.
  export let byMetric; // { stops, searches, arrests } -> race -> year -> { disparity_index }
  export let years;
  export let races = ["White", "Black", "Hispanic"];
  export let startYear = 0; // 0 = show every year the bundle carries (~10 years)
  export let metrics = [
    { key: "stops", label: "Stops" },
    { key: "searches", label: "Searches" },
    { key: "arrests", label: "Arrests" },
  ];
  // "parity" rides under the 1× tick in the y-axis gutter, labeling the dashed
  // parity line without ever being written over by a data line.
  export let parityLabel = "parity";

  $: yrs = years.filter((y) => y >= startYear);

  // Wider-than-tall panels, taller than before for more vertical room. The
  // right margin carries the end labels — wide enough for the Black label,
  // which spells out "× share of population" on a second line.
  const W = 280;
  const H = 230;
  const pad = { top: 18, right: 108, bottom: 30, left: 34 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const baseY = pad.top + plotH;

  $: n = yrs.length;
  const x = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);

  // Shared y-domain (from 0) across panels so panels are comparable.
  $: yMax = (() => {
    let max = 1.2;
    for (const mtr of metrics)
      for (const r of races)
        for (const y of yrs) {
          const v = byMetric?.[mtr.key]?.[r]?.[y]?.disparity_index;
          if (v != null) max = Math.max(max, v);
        }
    return Math.ceil(max * 1.1 * 10) / 10;
  })();
  const yOf = (v) => pad.top + (1 - v / yMax) * plotH;
  const linePts = (vals) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yOf(v)}`)).filter(Boolean).join(" ");

  const seriesFor = (metricKey, race) =>
    yrs.map((y) => byMetric?.[metricKey]?.[race]?.[y]?.disparity_index ?? null);

  // Whole-number axis ticks (0×, 1×, 2× …).
  $: yTicks = Array.from({ length: Math.floor(yMax) + 1 }, (_, i) => i);

  // END labels stack in a FIXED top→bottom order — Black, Hispanic, White — so
  // they never swap panel to panel (White always below Hispanic). Each starts
  // at its dot and is only pushed DOWN to keep order + a min gap; Black gets
  // extra room for its second line.
  const ORDER = ["Black", "Hispanic", "White"];
  const GAP = 12;
  const endLabels = (metricKey) => {
    const items = ORDER.map((race) => {
      const v = seriesFor(metricKey, race)[n - 1];
      return v == null ? null : { race, v, c: raceColor(race), y: yOf(v) + 4, two: race === "Black" };
    }).filter(Boolean);
    for (let i = 1; i < items.length; i++) {
      const need = items[i - 1].y + GAP + (items[i - 1].two ? 9 : 0);
      if (items[i].y < need) items[i].y = need;
    }
    return items;
  };

  // START labels follow NATURAL order: each value-only label sits beside its own
  // dot, with the LOWEST of the three tucked below its line and the others above
  // — so White rides below the line only when it actually starts below Hispanic.
  const startLabels = (metricKey) => {
    const items = races
      .map((race) => {
        const v = seriesFor(metricKey, race)[0];
        return v == null ? null : { race, v, c: raceColor(race) };
      })
      .filter(Boolean);
    if (!items.length) return [];
    const minV = Math.min(...items.map((it) => it.v));
    items.forEach((it) => (it.y = it.v === minV ? yOf(it.v) + 13 : yOf(it.v) - 6));
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++)
      if (items[i].y - items[i - 1].y < 11) items[i].y = items[i - 1].y + 11;
    return items;
  };

  // Floating tooltip + vertical locator, relative to the hovered panel.
  let tip = null;
  const showTip = (e, pi, payload) => {
    const host = e.currentTarget.closest(".tip-host");
    if (!host) return;
    const r = host.getBoundingClientRect();
    tip = {
      pi,
      x: Math.max(70, Math.min(r.width - 70, e.clientX - r.left)),
      y: e.clientY - r.top,
      ...payload,
    };
  };
  const hideTip = () => (tip = null);
  const tipRows = (metricKey, i) =>
    ORDER.map((race) => {
      const v = seriesFor(metricKey, race)[i];
      return v == null ? null : { label: race, value: `${v.toFixed(1)}×`, color: raceColor(race) };
    }).filter(Boolean);

  $: yearTick = (yr, i) => i === 0 || i === n - 1 || yr % 3 === 0;
</script>

<div class="grid gap-6 sm:grid-cols-3 sm:gap-5">
  {#each metrics as mtr, mi}
    <div class="tip-host relative {mi > 0 ? 'border-t border-slate-200 pt-6 sm:border-0 sm:pt-0' : ''}">
      <div class="mb-1 text-center text-[1.05rem] font-bold text-slate-900">{mtr.label}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- vertical locator (behind the data) -->
        {#if tip && tip.pi === mi && tip.lx != null}
          <line x1={tip.lx} y1={pad.top} x2={tip.lx} y2={baseY} stroke="#94a3b8" stroke-width="1" opacity="0.55" />
        {/if}

        <!-- axes: y spine + bottom x line -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={baseY} stroke="#94a3b8" stroke-width="1" />
        <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#94a3b8" stroke-width="1" />
        {#each yTicks as t}
          <line x1={pad.left - 3} y1={yOf(t)} x2={pad.left} y2={yOf(t)} stroke="#94a3b8" stroke-width="1" />
          <text x={pad.left - 6} y={yOf(t) + 3.5} text-anchor="end" font-size="9.5" fill="#64748b">{t}×</text>
          {#if t === 1}
            <text x={pad.left - 6} y={yOf(t) + 13} text-anchor="end" font-size="9" fill="#94a3b8" font-style="italic">{parityLabel}</text>
          {/if}
        {/each}

        <!-- parity line at 1.0× -->
        <line x1={pad.left} y1={yOf(1)} x2={pad.left + plotW} y2={yOf(1)} stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

        <!-- year ticks: first, last, and a few in between -->
        {#each yrs as yr, i}
          {#if yearTick(yr, i)}
            <text x={x(i)} y={baseY + 16} text-anchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} font-size="11" fill="#64748b">{yr}</text>
          {/if}
        {/each}

        {#each races as race}
          {@const c = raceColor(race)}
          {@const s = seriesFor(mtr.key, race)}
          <polyline fill="none" stroke={c} stroke-width="2.5" points={linePts(s)} />
          {#if s[0] != null}
            <circle cx={x(0)} cy={yOf(s[0])} r="3" fill={c} />
          {/if}
          {#if s[n - 1] != null}
            <circle cx={x(n - 1)} cy={yOf(s[n - 1])} r="3" fill={c} />
          {/if}
        {/each}

        <!-- start-of-line value labels (first dots), natural order -->
        {#each startLabels(mtr.key) as lab}
          <text x={x(0) + 5} y={lab.y} font-size="10.5" font-weight="600" fill={lab.c}>{lab.v.toFixed(1)}×</text>
        {/each}

        <!-- end-of-line labels: fixed order; Black spells out the unit -->
        {#each endLabels(mtr.key) as lab}
          <text x={x(n - 1) + 6} y={lab.y} font-size="11.5" font-weight="700" fill={lab.c}>{lab.race} {lab.v.toFixed(1)}×</text>
          {#if lab.two}
            <text x={x(n - 1) + 6} y={lab.y + 11} font-size="9" fill="#94a3b8">share of population</text>
          {/if}
        {/each}

        <!-- per-year hover columns drive the floating tooltip + locator -->
        {#each yrs as yr, i}
          {@const bw = n > 1 ? plotW / (n - 1) : plotW}
          <rect x={x(i) - bw / 2} y={pad.top} width={bw} height={plotH} fill="transparent"
                on:pointermove={(e) => showTip(e, mi, { title: yr, lx: x(i), rows: tipRows(mtr.key, i) })}
                on:pointerleave={hideTip} />
        {/each}
      </svg>
      <ChartTooltip tip={tip && tip.pi === mi ? tip : null} />
    </div>
  {/each}
</div>
