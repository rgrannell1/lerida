// Line and polygon rendering, including directional arrowheads, and the handler
// that turns a Geoman-drawn shape into our own styled, labelled, removable layer.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { decorators, leaflet, type PmCreateEvent } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { colorHex, DEFAULT_COLOR } from "../../features.ts";
import type { Line, Polygon } from "../../types.ts";
import { dropFrom, markElement, wireFeature } from "./editor.ts";
import { featureTarget } from "./context.ts";

function toPoint(latlng: Leaflet.LatLng): { lat: number; lng: number } {
  return { lat: latlng.lat, lng: latlng.lng };
}

// Build a decorator drawing arrowheads along a polyline in its colour.
function arrowDecorator(line: Leaflet.Polyline, color: string): Leaflet.Layer {
  const symbol = decorators.Symbol.arrowHead({
    pixelSize: 11,
    polygon: false,
    pathOptions: { color, weight: 2, stroke: true },
  });
  return decorators.polylineDecorator(line, {
    patterns: [{ offset: "6%", repeat: "110px", symbol }],
  });
}

export function addLineLayer(map: Leaflet.Map, line: Line): void {
  const vertices = line.points.map((point) => [point.lat, point.lng] as [number, number]);
  const color = line.color ?? colorHex(DEFAULT_COLOR);
  const target = featureTarget(map);
  const layer = leaflet.polyline(vertices, { color });
  layer.addTo(target);
  markElement(layer, "line");
  const decorator = line.arrows ? arrowDecorator(layer, color) : undefined;
  decorator?.addTo(target);
  wireFeature(layer, line, () => {
    state.lines = dropFrom(state.lines, line);
    layer.remove();
    decorator?.remove();
    syncToUrl();
  }, true);
}

export function addPolygonLayer(map: Leaflet.Map, polygon: Polygon): void {
  const vertices = polygon.points.map((point) => [point.lat, point.lng] as [number, number]);
  const layer = leaflet.polygon(vertices, { color: polygon.color ?? colorHex(DEFAULT_COLOR) });
  wireFeature(layer, polygon, () => {
    state.polygons = dropFrom(state.polygons, polygon);
    layer.remove();
    syncToUrl();
  }, true);
  layer.addTo(featureTarget(map));
  markElement(layer, "polygon");
}

function readLineCoords(layer: Leaflet.Polyline): { lat: number; lng: number }[] {
  return (layer.getLatLngs() as Leaflet.LatLng[]).map(toPoint);
}

function readPolygonCoords(layer: Leaflet.Polyline): { lat: number; lng: number }[] {
  // A polygon's getLatLngs returns an array of rings; we keep only the outer one.
  // Guard the empty case so a degenerate shape can't throw in the pm:create path.
  const rings = layer.getLatLngs() as Leaflet.LatLng[][];
  return (rings[0] ?? []).map(toPoint);
}

// Geoman finished a shape: read its coords into state and re-render via our own
// styled, labelled, removable layer (Geoman's raw layer is discarded).
export function onShapeCreated(map: Leaflet.Map, event: PmCreateEvent): void {
  const drawn = event.layer;
  const color = colorHex(ui.selectedColor);
  drawn.remove();
  if (event.shape === "Line") {
    const line: Line = { points: readLineCoords(drawn), color };
    if (ui.selectedArrows) {
      line.arrows = true;
    }
    state.lines = state.lines ?? [];
    state.lines.push(line);
    addLineLayer(map, line);
  } else if (event.shape === "Polygon") {
    const polygon: Polygon = { points: readPolygonCoords(drawn), color };
    state.polygons = state.polygons ?? [];
    state.polygons.push(polygon);
    addPolygonLayer(map, polygon);
  }
  syncToUrl();
}
