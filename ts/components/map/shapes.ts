// Line and polygon rendering, including directional arrowheads, and the handler
// that turns a Geoman-drawn shape into our own styled, labelled, removable layer.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { type PmCreateEvent } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import {
  colorHex,
} from "../../features.ts";
import type { Line, Polygon } from "../../types.ts";
import { LineLayer } from "./line-layer.ts";
import { PolygonLayer } from "./polygon-layer.ts";

function toPoint(latlng: Leaflet.LatLng): { lat: number; lng: number } {
  return { lat: latlng.lat, lng: latlng.lng };
}

export function addLineLayer(map: Leaflet.Map, line: Line): void {
  const rendered = new LineLayer(map, line);
  rendered.add();
}

export function addPolygonLayer(map: Leaflet.Map, polygon: Polygon): void {
  const rendered = new PolygonLayer(map, polygon);
  rendered.add();
}

function readLineCoords(
  layer: Leaflet.Polyline,
): { lat: number; lng: number }[] {
  return (layer.getLatLngs() as Leaflet.LatLng[]).map(toPoint);
}

function readPolygonCoords(
  layer: Leaflet.Polyline,
): { lat: number; lng: number }[] {
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
    const line: Line = {
      points: readLineCoords(drawn),
      color,
      width: ui.selectedWidth,
    };
    if (ui.selectedArrows) {
      line.arrows = true;
    }
    // The measure toggle tags a normal Line so it shows distance labels.
    if (ui.selectedMeasure) {
      line.measure = true;
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
