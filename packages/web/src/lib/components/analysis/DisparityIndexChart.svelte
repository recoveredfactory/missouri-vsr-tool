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
  // The word "parity" rides under the 1× tick in the y-axis gutter, where it
  // labels the dashed parity line without ever being written over by a data
  // line (the old in-plot label collided with the White line, which hugs 1×).
  export let parityLabel = "parity";

  $: yrs = years.filter((y) => y >= startYear);

  // Wider-than-tall panels read better and stack shorter on mobile. The right
  // margin carries the end-of-line labels — wide enough for the Black label,
  // which spells out "× share of population" on a second line.
  const W = 280;
  const H = 200;
  const pad = { top: 18, right: 108, bottom: 28, left: 34 };
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

  // Labels stack in a FIXED top→bottom order — Black, then Hispanic, then White
  // — so the three never swap places from panel to panel (White always sits
  // below Hispanic). Each starts at its own dot and is only pushed DOWN to keep
  // the order and a minimum gap; Black gets extra room for its second line.
  const ORDER = ["Black", "Hispanic", "White"];
  const GAP = 12;
  const orderedLabels = (metricKey, idx, off, blackTwoLine) => {
    const items = ORDER.map((race) => {
      const v = seriesFor(metricKey, race)[idx];
      return v == null ? null : { race, v, c: raceColor(race), y: yOf(v) + off, two: blackTwoLine && race === "Black" };
    }).filter(Boolean);
    for (let i = 1; i < items.length; i++) {
      const need = items[i - 1].y + GAP + (items[i - 1].two ? 9 : 0);
      if (items[i].y < need) items[i].y = need;
    }
    return items;
  };

  // Floating tooltip — positioned relative to the hovered panel's .tip-host.
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
</script>

<div class="grid gap-6 sm:grid-cols-3 sm:gap-5">
  {#each metrics as mtr, mi}
    <div class="tip-host relative {mi > 0 ? 'border-t border-slate-200 pt-6 sm:border-0 sm:pt-0' : ''}">
      <div class="mb-1 text-center text-[0.95rem] font-bold text-slate-900">{mtr.label}</div>
      <svg viewBox="0 0 {W} {H}" class="h-auto w-full" role="img">
        <!-- axes: y spine + bottom x line -->
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        <line x1={pad.left} y1={baseY} x2={pad.left + plotW} y2={baseY} stroke="#cbd5e1" stroke-width="1" />
        {#each yTicks as t}
          <line x1={pad.left - 3} y1={yOf(t)} x2={pad.left} y2={yOf(t)} stroke="#94a3b8" stroke-width="1" />
          <text x={pad.left - 6} y={yOf(t) + 3.5} text-anchor="end" font-size="9.5" fill="#64748b">{t}×</text>
          <!-- the parity line is the 1× tick — name it once, in the gutter -->
          {#if t === 1}
            <text x={pad.left - 6} y={yOf(t) + 13} text-anchor="end" font-size="8" fill="#94a3b8" font-style="italic">{parityLabel}</text>
          {/if}
        {/each}

        <!-- parity line at 1.0× -->
        <line x1={pad.left} y1={yOf(1)} x2={pad.left + plotW} y2={yOf(1)} stroke="#475569" stroke-width="1" stroke-dasharray="4 3" />

        <!-- year ticks: first + last -->
        {#each yrs as yr, i}
          {#if i === 0 || i === n - 1}
            <text x={x(i)} y={baseY + 16} text-anchor={i === 0 ? "start" : "end"} font-size="11" fill="#64748b">{yr}</text>
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

        <!-- start-of-line value labels (first dots), fixed order, above the line -->
        {#each orderedLabels(mtr.key, 0, -5, false) as lab}
          <text x={x(0) + 5} y={lab.y} font-size="9.5" font-weight="600" fill={lab.c}>{lab.v.toFixed(1)}×</text>
        {/each}

        <!-- end-of-line labels: fixed order; Black spells out the unit -->
        {#each orderedLabels(mtr.key, n - 1, 3.5, true) as lab}
          <text x={x(n - 1) + 6} y={lab.y} font-size="10.5" font-weight="700" fill={lab.c}>{lab.race} {lab.v.toFixed(1)}×</text>
          {#if lab.two}
            <text x={x(n - 1) + 6} y={lab.y + 10} font-size="8" fill="#94a3b8">share of population</text>
          {/if}
        {/each}

        <!-- per-year hover columns drive the floating tooltip -->
        {#each yrs as yr, i}
          {@const bw = n > 1 ? plotW / (n - 1) : plotW}
          <rect x={x(i) - bw / 2} y={pad.top} width={bw} height={plotH} fill="transparent"
                on:pointermove={(e) => showTip(e, mi, { title: yr, rows: tipRows(mtr.key, i) })}
                on:pointerleave={hideTip} />
        {/each}
      </svg>
      <ChartTooltip tip={tip && tip.pi === mi ? tip : null} />
    </div>
  {/each}
</div>
