<script>
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getLocale } from "$lib/paraglide/runtime";
  import { map_stops_count } from "$lib/paraglide/messages";
  import { browser } from "$app/environment";
  import { withDataBase } from "$lib/dataBase";

  export let addressResponse = null;
  export let fallbackResponse = null;
  export let heading = "Location";
  export let loadingLabel = "Map loading…";
  export let showHeading = true;
  export let className = "";
  export let heightClass = "h-[360px]";
  export let agencyId = "";
  export let pmtilesUrl = "";
  export let pmtilesSourceLayer = "counties";
  export let showJurisdictionTiles = false;

  export let agencyBoundaryBasePath = withDataBase("/data/dist/agency_boundaries");
  export let boundaryDataOverride = undefined;
  export let basemapPmtilesUrl = "";
  export let basemapStyleUrl = "/map/style.en.json";

  let MapLibre;
  let Marker;
  let VectorTileSource;
  let GeoJSONSource;
  let FillLayer;
  let LineLayer;

  let mapReady = false;
  let center = null;
  let mapInstance;
  let boundaryData = null;
  let boundaryBounds = null;
  let boundaryUrl = "";
  let lastBoundaryUrl = "";
  let lastBoundsKey = "";
  let lastBoundaryRequestId = 0;
  let isMounted = false;
  let pmtilesProtocol;
  let pmtilesReady = false;
  let pmtilesSourceUrl = "";
  let maplibreModule;
  let hoverHandlersBound = false;
  let cleanupHoverHandlers = () => {};
  let hoverFilterCounties = ["==", ["get", "geoid"], ""];
  let hoverFilterPlaces = ["==", ["get", "geoid"], ""];
  let popup;
  let lastHoverKey = "";
  let hoverTimer = null;
  let pendingHover = null;
  const hoverDelayMs = 120;

  let mapStyle = basemapStyleUrl;
  const defaultCenter = [-92.6037607, 38.5767017];

  const boundaryFillPaint = {
    "fill-color": "#3b82f6",
    "fill-opacity": 0.25,
  };
  const boundaryLinePaint = {
    "line-color": "#1d4ed8",
    "line-width": 2,
  };
  const countiesFillPaint = {
    "fill-color": "#94a3b8",
    "fill-opacity": 0.08,
  };
  const placesFillPaint = {
    "fill-color": "#93c5fd",
    "fill-opacity": 0.07,
  };
  const countiesLinePaint = {
    "line-color": "#475569",
    "line-width": 1.6,
    "line-opacity": 0.75,
  };
  const placesLinePaint = {
    "line-color": "#64748b",
    "line-width": 1.4,
    "line-opacity": 0.7,
  };
  const hoverLinePaintCounties = {
    "line-color": "#1f2937",
    "line-width": 2.6,
    "line-opacity": 0.75,
    "line-opacity-transition": { duration: 180, delay: 0 },
  };
  const hoverFillPaintCounties = {
    "fill-color": "#1e3a8a",
    "fill-opacity": 0.08,
    "fill-opacity-transition": { duration: 180, delay: 0 },
  };
  const hoverLinePaintPlaces = {
    "line-color": "#020617",
    "line-width": 3.6,
    "line-opacity": 0.95,
    "line-opacity-transition": { duration: 180, delay: 0 },
  };
  const hoverFillPaintPlaces = {
    "fill-color": "#1e3a8a",
    "fill-opacity": 0.16,
    "fill-opacity-transition": { duration: 180, delay: 0 },
  };

  const getLocation = (response) => response?.results?.[0]?.location;

  $: {
    const location = getLocation(addressResponse) ?? getLocation(fallbackResponse);
    const lng = location?.lng != null ? Number(location.lng) : null;
    const lat = location?.lat != null ? Number(location.lat) : null;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      center = [lng, lat];
    } else {
      center = defaultCenter;
    }
  }

  $: pmtilesSourceUrl = showJurisdictionTiles && pmtilesUrl
    ? pmtilesUrl.startsWith("pmtiles://")
      ? pmtilesUrl
      : `pmtiles://${pmtilesUrl}`
    : "";

  onMount(async () => {
    if (!browser) return;
    isMounted = true;
    const mod = await import("svelte-maplibre-gl");
    MapLibre = mod.MapLibre;
    Marker = mod.Marker;
    VectorTileSource = mod.VectorTileSource;
    GeoJSONSource = mod.GeoJSONSource;
    FillLayer = mod.FillLayer;
    LineLayer = mod.LineLayer;

    if (basemapPmtilesUrl) {
      try {
        const response = await fetch(basemapStyleUrl);
        if (!response.ok) {
          throw new Error(`Failed to load basemap style: ${response.status}`);
        }
        const style = await response.json();
        const pmtilesStyleUrl = basemapPmtilesUrl.startsWith("pmtiles://")
          ? basemapPmtilesUrl
          : `pmtiles://${basemapPmtilesUrl}`;
        if (style?.sources && typeof style.sources === "object") {
          for (const key of Object.keys(style.sources)) {
            const source = style.sources[key];
            if (source?.type === "vector") {
              style.sources[key] = {
                ...source,
                url: pmtilesStyleUrl,
              };
              delete style.sources[key].tiles;
            }
          }
        }
        mapStyle = style;
      } catch (error) {
        mapStyle = basemapStyleUrl;
      }
    }

    if (pmtilesUrl || basemapPmtilesUrl) {
      try {
        const pmtilesModule = await import("pmtiles");
        pmtilesProtocol = new pmtilesModule.Protocol();
        maplibreModule = await import(/* @vite-ignore */ "maplibre-gl");
        maplibreModule.addProtocol?.("pmtiles", pmtilesProtocol.tile);
        pmtilesReady = true;
      } catch (error) {
        pmtilesReady = false;
      }
    }

    mapReady = true;
  });

  onDestroy(() => {
    isMounted = false;
    cleanupHoverHandlers();
    popup?.remove?.();
    popup = null;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  });

  $: boundaryUrl = agencyId ? `${agencyBoundaryBasePath}/${agencyId}.geojson` : "";

  const hasBoundaryOverride = boundaryDataOverride !== undefined;

  $: if (hasBoundaryOverride) {
    boundaryData = boundaryDataOverride;
    boundaryBounds = null;
    lastBoundaryUrl = "";
  }

  $: if (!hasBoundaryOverride && !boundaryUrl) {
    boundaryData = null;
    boundaryBounds = null;
    lastBoundaryUrl = "";
  }

  const loadBoundaryData = async (url) => {
    const requestId = ++lastBoundaryRequestId;
    try {
      const response = await fetch(url);
      if (requestId !== lastBoundaryRequestId) return;
      boundaryData = response.ok ? await response.json() : null;
    } catch {
      if (requestId !== lastBoundaryRequestId) return;
      boundaryData = null;
    }
  };

  $: if (!hasBoundaryOverride && isMounted && boundaryUrl && boundaryUrl !== lastBoundaryUrl) {
    lastBoundaryUrl = boundaryUrl;
    void loadBoundaryData(boundaryUrl);
  }

  const updateBoundaryBounds = () => {
    if (!boundaryData) {
      boundaryBounds = null;
      return;
    }
    const coords = [];
    const pushCoords = (geomCoords) => {
      if (!Array.isArray(geomCoords)) return;
      if (typeof geomCoords[0] === "number") {
        coords.push(geomCoords);
        return;
      }
      geomCoords.forEach(pushCoords);
    };
    const features = boundaryData?.features || [];
    features.forEach((feature) => {
      const geometry = feature?.geometry;
      if (!geometry) return;
      pushCoords(geometry.coordinates);
    });
    if (!coords.length) {
      boundaryBounds = null;
      return;
    }
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    coords.forEach(([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
    if (!Number.isFinite(minLng)) {
      boundaryBounds = null;
      return;
    }
    boundaryBounds = [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  };

  const fitToBounds = () => {
    if (!mapInstance || !boundaryBounds) return;
    const boundsKey = boundaryBounds.flat().join(",");
    if (boundsKey && boundsKey === lastBoundsKey) return;
    lastBoundsKey = boundsKey;
    const applyFit = () => {
      mapInstance.fitBounds(boundaryBounds, {
        padding: 32,
        duration: 0,
      });
      mapInstance.once("moveend", () => {
        mapInstance.zoomTo(mapInstance.getZoom() - 0.4, { duration: 0 });
      });
    };
    if (mapInstance.loaded?.()) {
      applyFit();
    } else {
      mapInstance.once("load", applyFit);
    }
  };

  const handleMapLoad = (event) => {
    const nextMap = event?.target ?? event?.detail?.map ?? event?.detail ?? null;
    if (nextMap && mapInstance !== nextMap) {
      cleanupHoverHandlers();
      hoverHandlersBound = false;
      mapInstance = nextMap;
      disableMapInteractions(mapInstance);
      if (boundaryBounds) {
        fitToBounds();
      }
    }
  };

  const disableMapInteractions = (map) => {
    map.dragPan?.disable?.();
    map.scrollZoom?.disable?.();
    map.boxZoom?.disable?.();
    map.doubleClickZoom?.disable?.();
    map.touchZoomRotate?.disable?.();
    map.touchPitch?.disable?.();
    map.keyboard?.disable?.();
    map.dragRotate?.disable?.();
  };

  $: if (boundaryData) {
    updateBoundaryBounds();
  }

  $: if (boundaryBounds && mapInstance) {
    fitToBounds();
  }

  const formatStops = (value) => {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return null;
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  };

  const showPopup = (event, props) => {
    if (!mapInstance || !maplibreModule) return;
    const name = props?.agency_name || props?.namelsad || props?.name;
    const stopsValue = formatStops(props?.total_stops);
    if (!name) return;
    if (!popup) {
      popup = new maplibreModule.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "agency-map-popup",
      });
    }
    const subtitle = stopsValue ? map_stops_count({ stops: stopsValue }) : null;
    const html = `
      <div style="font-size:12px;font-weight:600;color:#0f172a;">${name}</div>
      ${subtitle ? `<div style="margin-top:2px;font-size:11px;color:#475569;">${subtitle}</div>` : ""}
    `;
    popup.setLngLat(event.lngLat).setHTML(html).addTo(mapInstance);
  };

  const buildAgencyHref = (slug) => {
    if (!slug) return "";
    let locale = "en";
    try {
      locale = getLocale();
    } catch {
      locale = "en";
    }
    return `/${locale}/agency/${slug}`;
  };

  const clearHover = () => {
    hoverFilterCounties = ["==", ["get", "geoid"], ""];
    hoverFilterPlaces = ["==", ["get", "geoid"], ""];
    lastHoverKey = "";
    popup?.remove?.();
    if (mapInstance) {
      mapInstance.getCanvas().style.cursor = "";
    }
  };

  const applyHover = (layerType, event, props) => {
    const geoid = props?.geoid;
    const nextKey = geoid ? `${layerType}:${geoid}` : "";
    if (nextKey && nextKey === lastHoverKey) return;
    lastHoverKey = nextKey;
    if (geoid) {
      if (layerType === "counties") {
        hoverFilterCounties = ["==", ["get", "geoid"], geoid];
        hoverFilterPlaces = ["==", ["get", "geoid"], ""];
      } else {
        hoverFilterPlaces = ["==", ["get", "geoid"], geoid];
        hoverFilterCounties = ["==", ["get", "geoid"], ""];
      }
    }
    if (mapInstance) {
      mapInstance.getCanvas().style.cursor = "pointer";
    }
    showPopup(event, props);
  };

  const scheduleHover = (layerType, event) => {
    const feature = event?.features?.[0];
    const props = feature?.properties || {};
    const payload = { layerType, event, props };
    pendingHover = payload;
    if (hoverTimer) return;
    hoverTimer = setTimeout(() => {
      const next = pendingHover;
      pendingHover = null;
      hoverTimer = null;
      if (next) {
        applyHover(next.layerType, next.event, next.props);
      }
    }, hoverDelayMs);
  };

  const bindHoverHandlers = () => {
    if (!mapInstance || hoverHandlersBound) return;
    const hasCounties = mapInstance.getLayer?.("mo-jurisdictions-counties-fill");
    const hasPlaces = mapInstance.getLayer?.("mo-jurisdictions-places-fill");
    if (!hasCounties || !hasPlaces) {
      mapInstance.once("idle", bindHoverHandlers);
      return;
    }
    hoverHandlersBound = true;
    const handleMove = (layerType) => (event) => scheduleHover(layerType, event);
    const handleLeave = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
        pendingHover = null;
      }
      clearHover();
    };
    const handleClick = (event) => {
      const feature = event?.features?.[0];
      const props = feature?.properties || {};
      const slug = props?.agency_slug || props?.agency_id;
      if (!slug) return;
      const href = buildAgencyHref(slug);
      if (!href) return;
      goto(href).catch(() => {
        window.location.href = href;
      });
    };

    const moveCounties = handleMove("counties");
    const movePlaces = handleMove("places");
    mapInstance.on("mousemove", "mo-jurisdictions-counties-fill", moveCounties);
    mapInstance.on("mousemove", "mo-jurisdictions-places-fill", movePlaces);
    mapInstance.on("mouseleave", "mo-jurisdictions-counties-fill", handleLeave);
    mapInstance.on("mouseleave", "mo-jurisdictions-places-fill", handleLeave);
    mapInstance.on("click", "mo-jurisdictions-counties-fill", handleClick);
    mapInstance.on("click", "mo-jurisdictions-places-fill", handleClick);
    cleanupHoverHandlers = () => {
      mapInstance.off("mousemove", "mo-jurisdictions-counties-fill", moveCounties);
      mapInstance.off("mousemove", "mo-jurisdictions-places-fill", movePlaces);
      mapInstance.off("mouseleave", "mo-jurisdictions-counties-fill", handleLeave);
      mapInstance.off("mouseleave", "mo-jurisdictions-places-fill", handleLeave);
      mapInstance.off("click", "mo-jurisdictions-counties-fill", handleClick);
      mapInstance.off("click", "mo-jurisdictions-places-fill", handleClick);
    };
  };

  $: if (showJurisdictionTiles && mapInstance && pmtilesReady && pmtilesSourceUrl) {
    bindHoverHandlers();
  }
</script>

<section class={`mb-10 ${className}`.trim()}>
  {#if showHeading && heading}
    <h2 class="mb-4 text-xl font-semibold text-slate-900">{heading}</h2>
  {/if}
  {#if mapReady && MapLibre && center}
    <div class={`${heightClass} w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-200`}>
      <svelte:component
        this={MapLibre}
        class="h-full w-full"
        style={mapStyle}
        center={center}
        zoom={14}
        attributionControl={true}
        customAttribution="© OpenStreetMap contributors"
        interactive={false}
        dragRotate={false}
        dragPan={false}
        scrollZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        touchPitch={false}
        touchZoomRotate={false}
        pitchWithRotate={false}
        maxPitch={0}
        bearing={0}
        pitch={0}
        onload={handleMapLoad}
      >
        {#if showJurisdictionTiles && pmtilesReady && pmtilesSourceUrl && VectorTileSource}
          <svelte:component this={VectorTileSource} id="mo-jurisdictions" url={pmtilesSourceUrl} />
          <svelte:component
            this={FillLayer}
            id="mo-jurisdictions-counties-fill"
            source="mo-jurisdictions"
            source-layer="counties"
            paint={countiesFillPaint}
          />
          <svelte:component
            this={FillLayer}
            id="mo-jurisdictions-counties-hover"
            source="mo-jurisdictions"
            source-layer="counties"
            paint={hoverFillPaintCounties}
            filter={hoverFilterCounties}
          />
          <svelte:component
            this={LineLayer}
            id="mo-jurisdictions-counties"
            source="mo-jurisdictions"
            source-layer="counties"
            paint={countiesLinePaint}
          />
          <svelte:component
            this={LineLayer}
            id="mo-jurisdictions-counties-hover-outline"
            source="mo-jurisdictions"
            source-layer="counties"
            paint={hoverLinePaintCounties}
            filter={hoverFilterCounties}
          />
          <svelte:component
            this={FillLayer}
            id="mo-jurisdictions-places-fill"
            source="mo-jurisdictions"
            source-layer="places"
            paint={placesFillPaint}
          />
          <svelte:component
            this={FillLayer}
            id="mo-jurisdictions-places-hover"
            source="mo-jurisdictions"
            source-layer="places"
            paint={hoverFillPaintPlaces}
            filter={hoverFilterPlaces}
          />
          <svelte:component
            this={LineLayer}
            id="mo-jurisdictions-places"
            source="mo-jurisdictions"
            source-layer="places"
            paint={placesLinePaint}
          />
          <svelte:component
            this={LineLayer}
            id="mo-jurisdictions-places-hover-outline"
            source="mo-jurisdictions"
            source-layer="places"
            paint={hoverLinePaintPlaces}
            filter={hoverFilterPlaces}
          />
        {/if}

        {#if boundaryData && GeoJSONSource}
          <svelte:component this={GeoJSONSource} id="agency-boundary" data={boundaryData}>
            <svelte:component this={FillLayer} id="agency-boundary-fill" paint={boundaryFillPaint} />
            <svelte:component this={LineLayer} id="agency-boundary-line" paint={boundaryLinePaint} />
          </svelte:component>
        {/if}

        <svelte:component this={Marker} lnglat={center} color="#1d4ed8" />
      </svelte:component>
    </div>
  {:else}
    <p class="text-sm text-slate-500">{loadingLabel}</p>
  {/if}
</section>
