// Line and polygon rendering, including directional arrowheads, and the handler
// that turns a Geoman-drawn shape into our own styled, labelled, removable layer.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { decorators, leaflet, type PmCreateEvent } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import {
  colorHex,
  DEFAULT_COLOR,
  DEFAULT_LINE_WIDTH,
  swatchName,
} from "../../features.ts";
import type { Line, Polygon } from "../../types.ts";
import { dropFrom, markElement, wireFeature } from "./editor.ts";
import { featureTarget } from "./context.ts";
import type { Selection } from "./selection.ts";

function toPoint(latlng: Leaflet.LatLng): { lat: number; lng: number } {
  return { lat: latlng.lat, lng: latlng.lng };
}

// Format a metre distance: metres under 1 km, otherwise kilometres to 2 dp.
function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(2)} km`;
}

// A non-interactive permanent label pinned at a coordinate, drawn as a divIcon so
// it is captured in the rendered image.
function distanceLabel(
  latlng: Leaflet.LatLngExpression,
  text: string,
  className: string,
): Leaflet.Marker {
  return leaflet.marker(latlng, {
    icon: leaflet.divIcon({ className, html: text }),
    interactive: false,
    keyboard: false,
  });
}

// Permanent per-segment length labels plus a total for a measured line.
function measureLabels(vertices: [number, number][]): Leaflet.Marker[] {
  const labels: Leaflet.Marker[] = [];
  let total = 0;
  for (let index = 0; index < vertices.length - 1; index++) {
    const from = leaflet.latLng(vertices[index]);
    const to = leaflet.latLng(vertices[index + 1]);
    const segment = from.distanceTo(to);
    total += segment;
    const mid = leaflet.latLng(
      (from.lat + to.lat) / 2,
      (from.lng + to.lng) / 2,
    );
    labels.push(distanceLabel(mid, formatDistance(segment), "measure-label"));
  }
  if (vertices.length >= 2) {
    labels.push(
      distanceLabel(
        vertices[vertices.length - 1],
        `Total ${formatDistance(total)}`,
        "measure-total",
      ),
    );
  }
  return labels;
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
  const vertices = line.points.map((point) =>
    [point.lat, point.lng] as [number, number]
  );
  const lineColor = () => line.color ?? colorHex(DEFAULT_COLOR);
  const lineWidth = () => line.width ?? DEFAULT_LINE_WIDTH;
  const target = featureTarget(map);
  const layer = leaflet.polyline(vertices, {
    color: lineColor(),
    weight: lineWidth(),
  });
  layer.addTo(target);
  markElement(layer, "line");
  // The arrow decorator is rebuilt whenever colour / arrows change.
  let decorator: Leaflet.Layer | undefined;
  const applyArrows = () => {
    decorator?.remove();
    decorator = line.arrows ? arrowDecorator(layer, lineColor()) : undefined;
    decorator?.addTo(target);
  };
  applyArrows();
  // Permanent segment-length and total labels for a measured line. Computed once
  // from the fixed geometry; removed with the line.
  const labels = line.measure ? measureLabels(vertices) : [];
  for (const label of labels) {
    label.addTo(target);
  }
  const restyle = () => {
    layer.setStyle({ color: lineColor(), weight: lineWidth() });
    applyArrows();
  };
  const buildSelection = (): Selection => ({
    kind: "line",
    layer,
    color: {
      get: () => swatchName(line.color),
      set: (name) => {
        line.color = colorHex(name);
        restyle();
        syncToUrl();
      },
    },
    width: {
      get: () => line.width ?? DEFAULT_LINE_WIDTH,
      set: (px) => {
        line.width = px;
        restyle();
        syncToUrl();
      },
    },
    arrows: {
      get: () => line.arrows ?? false,
      set: (on) => {
        line.arrows = on || undefined;
        applyArrows();
        syncToUrl();
      },
    },
  });
  wireFeature(
    layer,
    line,
    () => {
      state.lines = dropFrom(state.lines, line);
      layer.remove();
      decorator?.remove();
      for (const label of labels) {
        label.remove();
      }
      syncToUrl();
    },
    true,
    buildSelection,
  );
}

export function addPolygonLayer(map: Leaflet.Map, polygon: Polygon): void {
  const vertices = polygon.points.map((point) =>
    [point.lat, point.lng] as [number, number]
  );
  const layer = leaflet.polygon(vertices, {
    color: polygon.color ?? colorHex(DEFAULT_COLOR),
  });
  const buildSelection = (): Selection => ({
    kind: "polygon",
    layer,
    color: {
      get: () => swatchName(polygon.color),
      set: (name) => {
        polygon.color = colorHex(name);
        layer.setStyle({ color: polygon.color });
        syncToUrl();
      },
    },
  });
  wireFeature(
    layer,
    polygon,
    () => {
      state.polygons = dropFrom(state.polygons, polygon);
      layer.remove();
      syncToUrl();
    },
    true,
    buildSelection,
  );
  layer.addTo(featureTarget(map));
  markElement(layer, "polygon");
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
    // The measure tool draws a normal Line, tagged so it shows distance labels.
    if (ui.tool === "measure") {
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
