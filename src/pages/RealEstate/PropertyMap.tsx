import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { Loader2, LocateFixed, MapPinOff } from "lucide-react";
import { formatPropertyAddress } from "@/types/realEstate";
import type { Property } from "@/types/realEstate";

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const FONT = ["Montserrat Medium", "Open Sans Regular", "Noto Sans Regular"];
const SOURCE = "properties";

export const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  draft: "#f59e0b",
  archived: "#94a3b8",
};
const statusOf = (p: Property) =>
  p.record_status && STATUS_COLORS[p.record_status] ? p.record_status : "active";

const pinSvg = (color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="120" viewBox="0 0 48 60">
  <defs><filter id="s" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity=".35"/></filter></defs>
  <path filter="url(#s)" d="M24 2C12.4 2 3 11.2 3 22.6 3 38 24 57 24 57S45 38 45 22.6C45 11.2 35.6 2 24 2z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
  <circle cx="24" cy="22.5" r="13.5" fill="#ffffff"/>
  <g fill="${color}"><rect x="17.5" y="12.5" width="13" height="20" rx="1.6"/></g>
  <g fill="#ffffff">
    <rect x="20" y="15.5" width="3" height="3" rx=".6"/><rect x="25" y="15.5" width="3" height="3" rx=".6"/>
    <rect x="20" y="20.5" width="3" height="3" rx=".6"/><rect x="25" y="20.5" width="3" height="3" rx=".6"/>
    <rect x="22" y="26" width="4" height="6.5" rx=".8"/>
  </g>
</svg>`;

async function addPinImages(map: MapLibreMap) {
  await Promise.all(
    Object.entries(STATUS_COLORS).map(async ([status, color]) => {
      const id = `pin-${status}`;
      if (map.hasImage(id)) return;
      const img = new Image(96, 120);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(color))}`;
      await img.decode();
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
    })
  );
}

interface PointFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { id: string; status: string };
}

interface PointCollection {
  type: "FeatureCollection";
  features: PointFeature[];
}

function toCollection(properties: Property[]): PointCollection {
  return {
    type: "FeatureCollection",
    features: properties
      .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.longitude as number, p.latitude as number] },
        properties: { id: p.id, status: statusOf(p) },
      })),
  };
}

function popupContent(p: Property, onOpen?: (id: string) => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "property-popup";
  const add = (tag: string, cls: string, text: string, parent: HTMLElement = el) => {
    const n = document.createElement(tag);
    n.className = cls;
    n.textContent = text;
    parent.appendChild(n);
    return n;
  };
  const status = statusOf(p);
  const head = document.createElement("div");
  head.className = "property-popup__head";
  const dot = document.createElement("span");
  dot.className = "property-popup__dot";
  dot.style.background = STATUS_COLORS[status];
  head.appendChild(dot);
  add("span", "property-popup__status", status, head);
  if (p.property_type) add("span", "property-popup__type", p.property_type, head);
  el.appendChild(head);
  add("div", "property-popup__title", formatPropertyAddress(p));
  const locality = [p.city, p.state_province_region, p.country_code].filter(Boolean).join(", ");
  if (locality) add("div", "property-popup__sub", locality);
  const areaLabels: Record<string, string> = {
    sqft: "sq ft",
    sqm: "m²",
    acres: "ac",
    hectares: "ha",
    tsubo: "tsubo",
  };
  const stats = [
    p.bedrooms != null ? `${p.bedrooms} bd` : null,
    p.full_bathrooms != null
      ? `${(p.full_bathrooms ?? 0) + (p.half_bathrooms ?? 0) * 0.5} ba`
      : null,
    p.unit_area != null
      ? `${Number(p.unit_area).toLocaleString()} ${areaLabels[p.unit_area_unit ?? "sqft"] ?? "sq ft"}`
      : null,
    p.year_built != null ? `Built ${p.year_built}` : null,
  ].filter(Boolean) as string[];
  if (stats.length) add("div", "property-popup__stats", stats.join("  ·  "));
  if (onOpen) {
    const open = add("button", "property-popup__open", "Open property");
    open.addEventListener("click", () => onOpen(p.id));
  }
  return el;
}

interface PropertyMapProps {
  properties: Property[];
  selectedId?: string | null;
  hoverId?: string | null;
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  compact?: boolean;
}

export default function PropertyMap({
  properties,
  selectedId = null,
  hoverId = null,
  onSelect,
  onOpen,
  compact = false,
}: PropertyMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const collection = useMemo(() => toCollection(properties), [properties]);
  const mapped = collection.features.length;

  const live = useRef({ byId, collection, onSelect, onOpen });
  useEffect(() => {
    live.current = { byId, collection, onSelect, onOpen };
  }, [byId, collection, onSelect, onOpen]);

  const fit = useCallback((animate = true) => {
    const map = mapRef.current;
    const features = live.current.collection.features;
    if (!map || features.length === 0) return;
    if (features.length === 1) {
      map.flyTo({
        center: features[0].geometry.coordinates,
        zoom: 13,
        duration: animate ? 900 : 0,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    features.forEach((f) => bounds.extend(f.geometry.coordinates));
    map.fitBounds(bounds, {
      padding: { top: 70, bottom: 60, left: 70, right: 70 },
      maxZoom: 12,
      duration: animate ? 900 : 0,
    });
  }, []);

  const showPopup = useCallback((id: string) => {
    const map = mapRef.current;
    const prop = live.current.byId.get(id);
    const feature = live.current.collection.features.find((f) => f.properties.id === id);
    if (!map || !prop || !feature) return;
    popupRef.current?.remove();
    const popup = new maplibregl.Popup({
      offset: [0, -52],
      closeButton: true,
      maxWidth: "300px",
      className: "property-popup-wrap",
    })
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(popupContent(prop, live.current.onOpen))
      .addTo(map);
    popup.on("close", () => {
      if (popupRef.current === popup) {
        popupRef.current = null;
        live.current.onSelect?.(null);
      }
    });
    popupRef.current = popup;
  }, []);

  const setFeatureState = (id: string | null, key: "hover" | "selected", value: boolean) => {
    const map = mapRef.current;
    if (map && id && map.getSource(SOURCE)) {
      map.setFeatureState({ source: SOURCE, id }, { [key]: value });
    }
  };

  const install = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    await addPinImages(map);
    if (map.getSource(SOURCE)) return;
    map.addSource(SOURCE, {
      type: "geojson",
      data: live.current.collection as unknown as Parameters<GeoJSONSource["setData"]>[0],
      cluster: true,
      clusterRadius: 46,
      clusterMaxZoom: 13,
      promoteId: "id",
    });
    map.addLayer({
      id: "pin-ring",
      type: "circle",
      source: SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          20,
          ["boolean", ["feature-state", "hover"], false],
          16,
          0,
        ],
        "circle-color": "#6366f1",
        "circle-opacity": 0.22,
        "circle-stroke-color": "#6366f1",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.6,
      },
    });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#6366f1", 10, "#4f46e5", 30, "#4338ca"],
        "circle-radius": ["step", ["get", "point_count"], 18, 10, 23, 30, 29],
        "circle-stroke-width": 6,
        "circle-stroke-color": "rgba(99,102,241,0.28)",
      },
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": FONT,
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "pins",
      type: "symbol",
      source: SOURCE,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": ["concat", "pin-", ["get", "status"]],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-size": 0.85,
      },
    });
    setFeatureState(selectedRef.current, "selected", true);
    setFeatureState(hoverRef.current, "hover", true);
  }, []);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: isDark ? STYLE_DARK : STYLE_LIGHT,
      center: [-30, 30],
      zoom: 1.4,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("style.load", () => {
      void install().then(() => setStatus("ready"));
    });
    map.on("load", () => fit(false));
    map.on("error", () => {
      if (!map.isStyleLoaded() && !map.getSource(SOURCE)) {
        setStatus((s) => (s === "ready" ? s : "error"));
      }
    });

    map.on("click", "clusters", async (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
      if (!f || f.geometry.type !== "Point") return;
      const zoom = await (map.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(
        Number(f.properties.cluster_id)
      );
      map.easeTo({
        center: f.geometry.coordinates as [number, number],
        zoom: zoom + 0.5,
        duration: 600,
      });
    });
    map.on("click", "pins", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) {
        if (live.current.onSelect) live.current.onSelect(id);
        else showPopup(id);
      }
    });
    for (const layer of ["pins", "clusters"]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }
    map.on("mousemove", "pins", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id === hoverRef.current) return;
      setFeatureState(hoverRef.current, "hover", false);
      hoverRef.current = id ?? null;
      setFeatureState(hoverRef.current, "hover", true);
    });
    map.on("mouseleave", "pins", () => {
      setFeatureState(hoverRef.current, "hover", false);
      hoverRef.current = null;
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    mapRef.current?.setStyle(isDark ? STYLE_DARK : STYLE_LIGHT);
  }, [isDark]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!map || !source) return;
    source.setData(collection as unknown as Parameters<GeoJSONSource["setData"]>[0]);
    if (collection.features.length) fit();
  }, [collection, fit]);

  useEffect(() => {
    setFeatureState(selectedRef.current, "selected", false);
    selectedRef.current = selectedId;
    setFeatureState(selectedId, "selected", true);
    const map = mapRef.current;
    if (!map) return;
    if (!selectedId) {
      if (popupRef.current) {
        const p = popupRef.current;
        popupRef.current = null;
        p.remove();
      }
      return;
    }
    const feature = live.current.collection.features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    map.flyTo({
      center: feature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 14),
      duration: 900,
    });
    showPopup(selectedId);
  }, [selectedId, showPopup]);

  useEffect(() => {
    if (hoverId === hoverRef.current) return;
    setFeatureState(hoverRef.current, "hover", false);
    hoverRef.current = hoverId;
    setFeatureState(hoverId, "hover", true);
  }, [hoverId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { active: 0, draft: 0, archived: 0 };
    properties.forEach((p) => {
      if (typeof p.latitude === "number" && typeof p.longitude === "number") {
        c[statusOf(p)] += 1;
      }
    });
    return c;
  }, [properties]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-muted/40">
      <div ref={container} className="h-full w-full" aria-label="Map of properties" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground backdrop-blur-[1px]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading map…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-6 text-center text-sm text-muted-foreground">
          <MapPinOff className="h-7 w-7" />
          <p className="font-medium text-foreground">The map could not be loaded</p>
          <p className="max-w-xs text-xs">
            The map background loads from the internet. Check your connection and reload.
          </p>
        </div>
      )}
      {status === "ready" && mapped === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-full border border-border bg-background/90 px-4 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
          No properties with a map location yet
        </div>
      )}
      {status === "ready" && !compact && (
        <>
          <button
            type="button"
            onClick={() => fit()}
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/95 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted cursor-pointer"
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Show all
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            {Object.entries(STATUS_COLORS).map(([s, color]) => (
              <span key={s} className="inline-flex items-center gap-1.5 capitalize">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                {s} <span className="tabular-nums text-foreground">{counts[s]}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
