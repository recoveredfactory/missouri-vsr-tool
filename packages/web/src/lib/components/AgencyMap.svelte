<script>
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { withDataBase } from "$lib/dataBase";

  // featureStateData: Map<agency_id, normalizedValue 0..1>
  export let featureStateData = new Map();
  export let basemapStyleUrl = "/map/style.en.json";

  const dispatch = createEventDispatcher();

  const jurisdictionPmtilesUrl = withDataBase(
    "/data/dist/tiles/mo_jurisdictions_2024_500k.pmtiles"
  );

  // Blue bubble ramp: no-data gray → light → dark blue
  const bubbleColor = [
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
    "#cbd5e1",
  ];

  const bubbleRadius = [
    "interpolate", ["linear"], ["zoom"],
    6, [
      "case",
      [">=", ["coalesce", ["feature-state", "value"], -1], 0],
      ["interpolate", ["linear"], ["sqrt", ["coalesce", ["feature-state", "value"], 0]], 0, 1, 1, 8],
      0,
    ],
    10, [
      "case",
      [">=", ["coalesce", ["feature-state", "value"], -1], 0],
      ["interpolate", ["linear"], ["sqrt", ["coalesce", ["feature-state", "value"], 0]], 0, 3, 1, 16],
      0,
    ],
  ];

  const bubbleOpacity = [
    "case",
    ["boolean", ["feature-state", "hovered"], false],
    0.95,
    [">=", ["coalesce", ["feature-state", "value"], -1], 0],
    0.65,
    0,
  ];

  const bubbleStrokeWidth = [
    "case",
    ["boolean", ["feature-state", "hovered"], false],
    2,
    [">=", ["coalesce", ["feature-state", "value"], -1], 0],
    0.5,
    0,
  ];

  const bubbleStrokeColor = [
    "case",
    ["boolean", ["feature-state", "hovered"], false],
    "#1e3a8a",
    "#ffffff",
  ];

  const lineColor = "#94a3b8";
  const lineWidth = ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.5, 12, 1.0];

  let container;
  let map = null;
  let mapLoaded = false;
  let pendingFeatureStateData = null;
  let hoveredId = null;

  const SOURCE_ID = "mo-jurisdictions";
  const POLY_LAYERS = ["counties", "places"];
  const CENTROID_LAYER = "centroids";
  const ALL_STATE_LAYERS = [...POLY_LAYERS, CENTROID_LAYER];

  const applyFeatureStates = (data) => {
    if (!map || !mapLoaded) {
      pendingFeatureStateData = data;
      return;
    }
    for (const sourceLayer of ALL_STATE_LAYERS) {
      map.removeFeatureState({ source: SOURCE_ID, sourceLayer });
    }
    for (const [slug, value] of data) {
      for (const sourceLayer of ALL_STATE_LAYERS) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: slug },
          { value }
        );
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

  // Reactive: re-apply whenever featureStateData reference changes
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
      map.addSource(SOURCE_ID, {
        type: "vector",
        url: `pmtiles://${jurisdictionPmtilesUrl}`,
        promoteId: "agency_id",
      });

      // Subtle polygon context layers (no data-driven color)
      for (const sourceLayer of POLY_LAYERS) {
        map.addLayer({
          id: `context-fill-${sourceLayer}`,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: {
            "fill-color": "#e2e8f0",
            "fill-opacity": 0.25,
          },
        });

        map.addLayer({
          id: `context-line-${sourceLayer}`,
          type: "line",
          source: SOURCE_ID,
          "source-layer": sourceLayer,
          paint: {
            "line-color": lineColor,
            "line-width": lineWidth,
            "line-opacity": 0.4,
          },
        });
      }

      // Bubble layer from centroids
      map.addLayer({
        id: "bubble-centroids",
        type: "circle",
        source: SOURCE_ID,
        "source-layer": CENTROID_LAYER,
        paint: {
          "circle-color": bubbleColor,
          "circle-radius": bubbleRadius,
          "circle-opacity": bubbleOpacity,
          "circle-stroke-width": bubbleStrokeWidth,
          "circle-stroke-color": bubbleStrokeColor,
        },
      });

      map.on("mousemove", "bubble-centroids", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties ?? {};
        const slug = props.agency_id ?? null;
        map.getCanvas().style.cursor = slug ? "pointer" : "";
        setHovered(slug);
        dispatch("hover", { slug, props, x: e.point.x, y: e.point.y });
      });

      map.on("mouseleave", "bubble-centroids", () => {
        map.getCanvas().style.cursor = "";
        setHovered(null);
        dispatch("leave");
      });

      map.on("click", "bubble-centroids", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const slug = feature.properties?.agency_id;
        if (slug) dispatch("click", { slug });
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
