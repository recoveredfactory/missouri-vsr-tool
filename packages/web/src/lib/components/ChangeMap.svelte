<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { withDataBase } from "$lib/dataBase";

  // featureStateData: Map<agency_id, -1..1>
  // Positive = increase, negative = decrease, not set = no data
  export let featureStateData = new Map();
  export let basemapStyleUrl = "/map/style.en.json";

  const dispatch = createEventDispatcher();

  const jurisdictionPmtilesUrl = withDataBase(
    "/data/dist/tiles/mo_jurisdictions_2024_500k.pmtiles"
  );

  const SOURCE_ID = "mo-jurisdictions";
  const POLY_LAYERS = ["counties", "places"];
  const CENTROID_LAYER = "centroids";
  const ALL_STATE_LAYERS = [...POLY_LAYERS, CENTROID_LAYER];
  const ARROW_IMG = "vsr-arrow";

  // icon-size is a layout property — can only use zoom, not feature-state
  // opacity (paint) encodes magnitude via sqrt(|change|)
  const arrowSize = ["interpolate", ["linear"], ["zoom"], 5, 0.4, 8, 0.7, 11, 1.1];

  const lineColor = "#94a3b8";
  const lineWidth = ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.5, 12, 1.0];

  // Up-layer opacity: show only for positive change, magnitude via sqrt
  const upOpacity = [
    "case",
    ["boolean", ["feature-state", "hovered"], false], 1.0,
    [">", ["coalesce", ["feature-state", "change"], -2], 0],
    ["sqrt", ["feature-state", "change"]],
    0,
  ];

  // Down-layer opacity: show only for negative change, magnitude via sqrt(-change)
  const downOpacity = [
    "case",
    ["boolean", ["feature-state", "hovered"], false], 1.0,
    ["<", ["coalesce", ["feature-state", "change"], 0], 0],
    ["sqrt", ["*", -1, ["feature-state", "change"]]],
    0,
  ];

  let container;
  let map = null;
  let mapLoaded = false;
  let pendingFeatureStateData = null;
  let hoveredId = null;

  const applyFeatureStates = (data) => {
    if (!map || !mapLoaded) { pendingFeatureStateData = data; return; }
    for (const sourceLayer of ALL_STATE_LAYERS) {
      map.removeFeatureState({ source: SOURCE_ID, sourceLayer });
    }
    for (const [slug, change] of data) {
      for (const sourceLayer of ALL_STATE_LAYERS) {
        map.setFeatureState({ source: SOURCE_ID, sourceLayer, id: slug }, { change });
      }
    }
  };

  const setHovered = (id) => {
    if (hoveredId === id) return;
    if (hoveredId) {
      map?.setFeatureState(
        { source: SOURCE_ID, sourceLayer: CENTROID_LAYER, id: hoveredId },
        { hovered: false }
      );
    }
    hoveredId = id;
    if (id) {
      map?.setFeatureState(
        { source: SOURCE_ID, sourceLayer: CENTROID_LAYER, id },
        { hovered: true }
      );
    }
  };

  $: applyFeatureStates(featureStateData);

  onMount(async () => {
    const [maplibreModule, pmtilesModule] = await Promise.all([
      import("maplibre-gl"),
      import("pmtiles"),
    ]);

    const maplibregl = maplibreModule.default ?? maplibreModule;
    const { Protocol } = pmtilesModule;

    try {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile.bind(protocol));
    } catch { /* already registered */ }

    map = new maplibregl.Map({
      container,
      style: basemapStyleUrl,
      center: [-92.6, 38.58],
      zoom: 5.8,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Programmatic upward-pointing triangle SDF image
      const SZ = 32;
      const buf = new Uint8Array(SZ * SZ * 4);
      const pad = 3;
      const ax = SZ / 2, ay = pad;       // apex
      const blx = pad, bly = SZ - pad;   // bottom-left
      const brx = SZ - pad, bry = SZ - pad; // bottom-right

      const cross = (ax, ay, bx, by, px, py) =>
        (bx - ax) * (py - ay) - (by - ay) * (px - ax);

      for (let y = 0; y < SZ; y++) {
        for (let x = 0; x < SZ; x++) {
          const d1 = cross(ax, ay, blx, bly, x, y);
          const d2 = cross(blx, bly, brx, bry, x, y);
          const d3 = cross(brx, bry, ax, ay, x, y);
          const inside = (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
          const i = (y * SZ + x) * 4;
          buf[i] = buf[i + 1] = buf[i + 2] = 255;
          buf[i + 3] = inside ? 255 : 0;
        }
      }
      map.addImage(ARROW_IMG, { width: SZ, height: SZ, data: buf }, { sdf: true });

      map.addSource(SOURCE_ID, {
        type: "vector",
        url: `pmtiles://${jurisdictionPmtilesUrl}`,
        promoteId: "agency_id",
      });

      // Subtle polygon context
      for (const sourceLayer of POLY_LAYERS) {
        map.addLayer({
          id: `change-fill-${sourceLayer}`,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: { "fill-color": "#e2e8f0", "fill-opacity": 0.25 },
        });
        map.addLayer({
          id: `change-line-${sourceLayer}`,
          type: "line",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: { "line-color": lineColor, "line-width": lineWidth, "line-opacity": 0.4 },
        });
      }

      // Up arrows (increase) — orange
      map.addLayer({
        id: "arrows-up",
        type: "symbol",
        source: SOURCE_ID,
        "source-layer": CENTROID_LAYER,
        layout: {
          "icon-image": ARROW_IMG,
          "icon-size": arrowSize,
          "icon-rotate": 0,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
        },
        paint: {
          "icon-color": "#ea580c",
          "icon-opacity": upOpacity,
        },
      });

      // Down arrows (decrease) — blue, same icon rotated 180°
      map.addLayer({
        id: "arrows-down",
        type: "symbol",
        source: SOURCE_ID,
        "source-layer": CENTROID_LAYER,
        layout: {
          "icon-image": ARROW_IMG,
          "icon-size": arrowSize,
          "icon-rotate": 180,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-rotation-alignment": "viewport",
        },
        paint: {
          "icon-color": "#2563eb",
          "icon-opacity": downOpacity,
        },
      });

      // Single hover/click listener on the top layer — handles both directions
      map.on("mousemove", "arrows-down", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties ?? {};
        const slug = props.agency_id ?? null;
        if (!slug) return;
        const state = map.getFeatureState({ source: SOURCE_ID, sourceLayer: CENTROID_LAYER, id: slug });
        if (state.change == null) return;
        map.getCanvas().style.cursor = "pointer";
        setHovered(slug);
        dispatch("hover", { slug, props, x: e.point.x, y: e.point.y });
      });

      map.on("mouseleave", "arrows-down", () => {
        map.getCanvas().style.cursor = "";
        setHovered(null);
        dispatch("leave");
      });

      map.on("click", "arrows-down", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const slug = feature.properties?.agency_id;
        const state = map.getFeatureState({ source: SOURCE_ID, sourceLayer: CENTROID_LAYER, id: slug });
        if (slug && state.change != null) dispatch("click", { slug });
      });

      mapLoaded = true;
      if (pendingFeatureStateData) {
        applyFeatureStates(pendingFeatureStateData);
        pendingFeatureStateData = null;
      }
    });
  });

  onDestroy(() => {
    map?.remove();
    map = null;
  });
</script>

<div bind:this={container} class="h-full w-full"></div>
