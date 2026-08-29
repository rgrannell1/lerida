// Rendered line state, styling, measurement, and toolbar editing.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import {
  colorHex,
  DEFAULT_COLOR,
  DEFAULT_LINE_WIDTH,
  swatchName,
} from "../../features.ts";
import { state, syncToUrl } from "../../state.ts";
import type { Maybe } from "../../maybe.ts";
import { dropFrom } from "../../commons/array.ts";
import type { Line } from "../../types.ts";
import { featureTarget } from "./context.ts";
import { markElement, wireFeature } from "./editor.ts";
import { decorators, leaflet } from "./leaflet.ts";
import type { Selection } from "./selection.ts";

function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(2)} km`;
}

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

function measureLabels(vertices: [number, number][]): Leaflet.Marker[] {
  const labels: Leaflet.Marker[] = [];
  let total = 0;
  for (let idx = 0; idx < vertices.length - 1; idx++) {
    const from = leaflet.latLng(vertices[idx]);
    const to = leaflet.latLng(vertices[idx + 1]);
    const segment = from.distanceTo(to);
    total += segment;
    const mid = leaflet.latLng(
      (from.lat + to.lat) / 2,
      (from.lng + to.lng) / 2,
    );
    labels.push(distanceLabel(mid, formatDistance(segment), "measure-label"));
  }
  if (vertices.length >= 3) {
    const finalVertex = vertices[vertices.length - 1];
    labels.push(distanceLabel(
      finalVertex,
      `Total ${formatDistance(total)}`,
      "measure-total",
    ));
  }
  return labels;
}

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

export class LineLayer {
  line: Line;
  vertices: [number, number][];
  target: Leaflet.Map | Leaflet.LayerGroup;
  layer: Leaflet.Polyline;
  decorator: Maybe<Leaflet.Layer>;
  labels: Leaflet.Marker[];

  constructor(map: Leaflet.Map, line: Line) {
    this.line = line;
    this.vertices = line.points.map((point) => [point.lat, point.lng]);
    this.target = featureTarget(map);
    this.layer = leaflet.polyline(this.vertices, {
      color: this.color(),
      weight: this.width(),
    });
    this.decorator = undefined;
    this.labels = [];
  }

  color(): string {
    return this.line.color ?? colorHex(DEFAULT_COLOR);
  }

  width(): number {
    return this.line.width ?? DEFAULT_LINE_WIDTH;
  }

  applyArrows(): void {
    this.decorator?.remove();
    this.decorator = this.line.arrows
      ? arrowDecorator(this.layer, this.color())
      : undefined;
    this.decorator?.addTo(this.target);
  }

  applyMeasure(): void {
    for (const label of this.labels) {
      label.remove();
    }
    this.labels = this.line.measure ? measureLabels(this.vertices) : [];
    for (const label of this.labels) {
      label.addTo(this.target);
    }
  }

  restyle(): void {
    this.layer.setStyle({ color: this.color(), weight: this.width() });
    this.applyArrows();
  }

  setColor(name: string): void {
    this.line.color = colorHex(name);
    this.restyle();
    syncToUrl();
  }

  setWidth(px: number): void {
    this.line.width = px;
    this.restyle();
    syncToUrl();
  }

  setArrows(on: boolean): void {
    this.line.arrows = on || undefined;
    this.applyArrows();
    syncToUrl();
  }

  setMeasure(on: boolean): void {
    this.line.measure = on || undefined;
    this.applyMeasure();
    syncToUrl();
  }

  buildSelection(): Selection {
    return {
      kind: "line",
      layer: this.layer,
      color: {
        get: swatchName.bind(null, this.line.color),
        set: this.setColor.bind(this),
      },
      width: { get: this.width.bind(this), set: this.setWidth.bind(this) },
      arrows: {
        get: () => this.line.arrows ?? false,
        set: this.setArrows.bind(this),
      },
      measure: {
        get: () => this.line.measure ?? false,
        set: this.setMeasure.bind(this),
      },
    };
  }

  remove(): void {
    state.lines = dropFrom(state.lines, this.line);
    this.layer.remove();
    this.decorator?.remove();
    for (const label of this.labels) {
      label.remove();
    }
    syncToUrl();
  }

  add(): void {
    this.layer.addTo(this.target);
    markElement(this.layer, "line");
    this.applyArrows();
    this.applyMeasure();
    wireFeature(
      this.layer,
      this.line,
      this.remove.bind(this),
      true,
      this.buildSelection.bind(this),
    );
  }
}
