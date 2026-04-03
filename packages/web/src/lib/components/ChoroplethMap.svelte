<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { withDataBase } from "$lib/dataBase";

  // featureStateData: Map<agency_slug, normalizedValue 0..1>
  export let featureStateData = new Map();
  export let basemapStyleUrl = "/map/style.en.json";

  const dispatch = createEventDispatcher();

  const jurisdictionPmtilesUrl = withDataBase(
    "/data/dist/tiles/mo_jurisdictions_2024_500k.pmtiles"
  );

  // Blue choropleth ramp: no-data gray → light → dark blue
  const choroplethFillColor = [
    "case",
    [">=", ["coalesce", ["feature-state", "value"], -1], 0],
    [
      "interpolate", ["linear"],
      ["coalesce", ["feature-state", "value"], 0],
      0,    "#dbeafe",
      0.25, "#93c5fd",
      0.5,  "#3b82f6",
      0.75, "#1d4ed8",
      1,    "#1e3a8a",
    ],
    "#e2e8f0",
  ];

  const choroplethFillOpacity = [
    "case",
    ["boolean", ["feature-state", "hovered"], false],
    0.92,
    [">=", ["coalesce", ["feature-state", "value"], -1], 0],
    0.72,
    0.25,
  ];

  const lineColor = "#64748b";
  const lineWidth = ["interpolate", ["linear"], ["zoom"], 4, 0.3, 8, 0.8, 12, 1.2];

  let container;
  let map = null;
  let mapLoaded = false;
  let pendingFeatureStateData = null;
  let hoveredSlug = null;
  let hoveredSourceLayer = null;

  const SOURCE_ID = "mo-jurisdictions";
  const SOURCE_LAYERS = ["counties", "places"];

  const applyFeatureStates = (data) => {
    if (!map || !mapLoaded) {
      pendingFeatureStateData = data;
      return;
    }
    // Clear all existing choropleth values
    map.removeFeatureState({ source: SOURCE_ID });

    for (const [slug, value] of data) {
      for (const sourceLayer of SOURCE_LAYERS) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: slug },
          { value }
        );
      }
    }
  };

  const setHovered = (slug, sourceLayer) => {
    if (hoveredSlug === slug && hoveredSourceLayer === sourceLayer) return;

    // Clear previous hover
    if (hoveredSlug) {
      map?.setFeatureState(
        { source: SOURCE_ID, sourceLayer: hoveredSourceLayer, id: hoveredSlug },
        { hovered: false }
      );
    }

    hoveredSlug = slug;
    hoveredSourceLayer = sourceLayer;

    if (slug) {
      map?.setFeatureState(
        { source: SOURCE_ID, sourceLayer, id: slug },
        { hovered: true }
      );
    }
  };

  // Reactive: re-apply whenever featureStateData reference changes
  $: applyFeatureStates(featureStateData);

  onMount(async () => {
    const [maplibreModule, pmtilesModule] = await Promise.all([
      import("maplibre-gl"),
      import("pmtiles"),
    ]);

    const maplibregl = maplibreModule.default ?? maplibreModule;
    const { Protocol } = pmtilesModule;

    // Register pmtiles protocol (idempotent-ish — guard against double-register)
    try {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile.bind(protocol));
    } catch {
      // already registered
    }

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

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Add jurisdiction vector source with promoteId for feature-state
      map.addSource(SOURCE_ID, {
        type: "vector",
        url: `pmtiles://${jurisdictionPmtilesUrl}`,
        promoteId: "agency_slug",
      });

      for (const sourceLayer of SOURCE_LAYERS) {
        const suffix = sourceLayer;

        map.addLayer({
          id: `choropleth-fill-${suffix}`,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: {
            "fill-color": choroplethFillColor,
            "fill-opacity": choroplethFillOpacity,
          },
        });

        map.addLayer({
          id: `choropleth-line-${suffix}`,
          type: "line",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: {
            "line-color": lineColor,
            "line-width": lineWidth,
            "line-opacity": 0.5,
          },
        });

        // Hover & click listeners per layer
        map.on("mousemove", `choropleth-fill-${suffix}`, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const props = feature.properties ?? {};
          const slug = props.agency_slug ?? props.agency_id ?? null;
          map.getCanvas().style.cursor = slug ? "pointer" : "";
          setHovered(slug, sourceLayer);
          dispatch("hover", { slug, props, x: e.point.x, y: e.point.y });
        });

        map.on("mouseleave", `choropleth-fill-${suffix}`, () => {
          map.getCanvas().style.cursor = "";
          setHovered(null, null);
          dispatch("leave");
        });

        map.on("click", `choropleth-fill-${suffix}`, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const slug = feature.properties?.agency_slug ?? feature.properties?.agency_id;
          if (slug) dispatch("click", { slug });
        });
      }

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

<div bind:this={container} class="h-full w-full" />
