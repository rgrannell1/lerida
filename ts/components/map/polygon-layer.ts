// Rendered polygon styling, removal, and toolbar editing.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { colorHex, DEFAULT_COLOR, swatchName } from "../../features.ts";
import { state, syncToUrl } from "../../state.ts";
import type { Polygon } from "../../types.ts";
import { dropFrom } from "../../commons/array.ts";
import { featureTarget } from "./context.ts";
import { markElement, wireFeature } from "./editor.ts";
import { leaflet } from "./leaflet.ts";
import type { Selection } from "./selection.ts";

export class PolygonLayer {
  polygon: Polygon;
  layer: Leaflet.Polygon;
  target: Leaflet.Map | Leaflet.LayerGroup;

  constructor(map: Leaflet.Map, polygon: Polygon) {
    this.polygon = polygon;
    this.target = featureTarget(map);
    const vertices = polygon.points.map(
      (point): [number, number] => [point.lat, point.lng],
    );
    this.layer = leaflet.polygon(vertices, { color: this.color() });
  }

  color(): string {
    return this.polygon.color ?? colorHex(DEFAULT_COLOR);
  }

  setColor(name: string): void {
    this.polygon.color = colorHex(name);
    this.layer.setStyle({ color: this.polygon.color });
    syncToUrl();
  }

  buildSelection(): Selection {
    return {
      kind: "polygon",
      layer: this.layer,
      color: {
        get: swatchName.bind(null, this.polygon.color),
        set: this.setColor.bind(this),
      },
    };
  }

  remove(): void {
    state.polygons = dropFrom(state.polygons, this.polygon);
    this.layer.remove();
    syncToUrl();
  }

  add(): void {
    wireFeature(
      this.layer,
      this.polygon,
      this.remove.bind(this),
      true,
      this.buildSelection.bind(this),
    );
    this.layer.addTo(this.target);
    markElement(this.layer, "polygon");
  }
}
