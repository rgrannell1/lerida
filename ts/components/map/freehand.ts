// The highlighter pen: a press-drag traces a freehand stroke, stored as a Line
// with `highlight: true`. Captured points are throttled by pixel distance so a
// single stroke stays a handful of vertices rather than hundreds — the whole
// path lives in the URL, so an unthinned freehand line would bloat it.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { leaflet } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { colorHex } from "../../features.ts";
import type { LatLng, Line } from "../../types.ts";
import { addLineLayer } from "./shapes.ts";
import { featureTarget } from "./context.ts";

// Minimum gap (screen pixels) between captured points; smaller moves are dropped.
const MIN_GAP_PX = 8;

let drawing = false;
let points: LatLng[] = [];
let lastPixel: Leaflet.Point | undefined;
let preview: Leaflet.Polyline | undefined;

function strokeStyle(): Leaflet.PolylineOptions {
  return { color: colorHex(ui.selectedColor), weight: 14, opacity: 0.4, lineCap: "round" };
}

// Begin a stroke at the pressed point. Dragging is already disabled by applyTool
// while the highlight tool is active, so the press-drag traces rather than pans.
export function startFreehand(map: Leaflet.Map, latlng: Leaflet.LatLng): void {
  drawing = true;
  points = [{ lat: latlng.lat, lng: latlng.lng }];
  lastPixel = map.latLngToContainerPoint(latlng);
  preview = leaflet.polyline([[latlng.lat, latlng.lng]], strokeStyle()).addTo(featureTarget(map));
}

// Extend the in-progress stroke, skipping points that haven't moved far enough.
export function extendFreehand(map: Leaflet.Map, latlng: Leaflet.LatLng): void {
  if (!drawing) {
    return;
  }
  const pixel = map.latLngToContainerPoint(latlng);
  if (lastPixel && pixel.distanceTo(lastPixel) < MIN_GAP_PX) {
    return;
  }
  lastPixel = pixel;
  points.push({ lat: latlng.lat, lng: latlng.lng });
  preview?.addLatLng([latlng.lat, latlng.lng]);
}

// Finish the stroke: commit it as a highlight line if it has real length.
export function finishFreehand(map: Leaflet.Map): void {
  if (!drawing) {
    return;
  }
  drawing = false;
  preview?.remove();
  preview = undefined;
  lastPixel = undefined;
  const captured = points;
  points = [];
  if (captured.length < 2) {
    return;
  }
  const line: Line = { points: captured, color: colorHex(ui.selectedColor), highlight: true };
  state.lines = state.lines ?? [];
  state.lines.push(line);
  addLineLayer(map, line);
  syncToUrl();
}
