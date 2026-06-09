// Mithril component wrapping a Leaflet map. Leaflet owns its own DOM, so the map
// is created in oncreate and torn down in onremove; Mithril never re-renders the
// map's internals. The map/feature logic lives in ts/map/*; this file just builds
// the map, renders the URL's features, and wires Leaflet events to them.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { leaflet, type PmCreateEvent } from "./map/leaflet.ts";
import { state, syncToUrl } from "../state.ts";
import { ui } from "../ui.ts";
import { isEditable, mapContext } from "./map/context.ts";
import { addMarkerLayer, placeMarker } from "./map/markers.ts";
import { addLineLayer, addPolygonLayer, onShapeCreated } from "./map/shapes.ts";
import { addTextLayer, placeText } from "./map/text.ts";
import { onKeyDown } from "./map/tools.ts";

// Re-exported for the toolbar, which imports these from "./map.ts".
export { applyTool, clearFeatures } from "./map/tools.ts";

// Default viewport when the URL carries no state: Ireland.
const DEFAULT_CENTER: [number, number] = [53.35, -6.26];
// Default zoom level — roughly the whole island.
const DEFAULT_ZOOM = 7;

// OpenStreetMap raster tiles.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "© OpenStreetMap contributors";

// Initial centre/zoom — from URL state if present, otherwise the defaults. The
// schema marks no field required, so a hand-edited URL can carry a partial view
// (e.g. zoom but no centre); fall back per-field rather than dereferencing blind.
function initialCenter(): [number, number] {
  const center = state.view?.center;
  return center && typeof center.lat === "number" && typeof center.lng === "number"
    ? [center.lat, center.lng]
    : DEFAULT_CENTER;
}

function initialZoom(): number {
  const zoom = state.view?.zoom;
  return typeof zoom === "number" ? zoom : DEFAULT_ZOOM;
}

// Capture the live viewport into state and write it to the URL.
function captureView(map: Leaflet.Map): void {
  const center = map.getCenter();
  state.view = {
    center: { lat: center.lat, lng: center.lng },
    zoom: Math.round(map.getZoom()),
  };
  syncToUrl();
}

// Render every feature the URL carries onto the freshly-created map.
function renderFeatures(map: Leaflet.Map): void {
  for (const marker of state.markers ?? []) {
    addMarkerLayer(map, marker);
  }
  for (const line of state.lines ?? []) {
    addLineLayer(map, line);
  }
  for (const polygon of state.polygons ?? []) {
    addPolygonLayer(map, polygon);
  }
  for (const textItem of state.texts ?? []) {
    addTextLayer(map, textItem, false);
  }
}

// Clear and re-draw every feature from current state. Wiring (editor popups,
// contentEditable text, removal) is decided per layer at creation from the
// editable flag, so a setting that flips that flag after load (the lock) must
// re-render to drop the stale, still-editable layers.
export function rerenderFeatures(): void {
  const map = mapContext.map;
  if (!map) {
    return;
  }
  mapContext.featureLayers?.clearLayers();
  renderFeatures(map);
}

// A bare-map click places a marker or text (depending on the tool), unless a
// vector feature just consumed the click.
function onMapClick(map: Leaflet.Map, event: Leaflet.LeafletEvent): void {
  const original = (event as Leaflet.LeafletMouseEvent).originalEvent;
  // Did a vector feature just consume *this* click? Clear the flag either way,
  // so a stale value from a click whose map-handler never fired can't swallow
  // the next genuine click.
  const consumed = mapContext.consumedClick === original;
  mapContext.consumedClick = undefined;
  if (consumed) {
    return;
  }
  if (!isEditable()) {
    return;
  }
  // The options panel owns the toolbar; don't place features behind it.
  if (ui.showOptions) {
    return;
  }
  const point = (event as Leaflet.LeafletMouseEvent).latlng;
  if (ui.tool === "marker") {
    placeMarker(map, point);
  } else if (ui.tool === "text") {
    placeText(map, point);
  }
}

export function MapView(): m.Component {
  return {
    view() {
      return m("div#map");
    },
    oncreate(vnode) {
      const node = vnode.dom as HTMLElement;
      const map = leaflet.map(node).setView(initialCenter(), initialZoom());
      // Keep the zoom control clear of the top toolbar (overlaps on mobile).
      map.zoomControl.setPosition("bottomleft");
      leaflet.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      mapContext.map = map;
      mapContext.featureLayers = leaflet.layerGroup().addTo(map);
      renderFeatures(map);
      map.on("moveend", () => captureView(map));
      map.on("zoomend", () => captureView(map));
      map.on("click", (event) => onMapClick(map, event));
      map.on("pm:create", (event) => {
        onShapeCreated(map, event as unknown as PmCreateEvent);
      });
      document.addEventListener("keydown", onKeyDown);
    },
    onremove() {
      document.removeEventListener("keydown", onKeyDown);
      mapContext.map?.remove();
      mapContext.map = undefined;
      mapContext.featureLayers = undefined;
    },
  };
}
