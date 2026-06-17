// Shared mutable state for the live map. The MapView component sets it up; the
// feature and tool modules read and update it.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { state } from "../../state.ts";

export const mapContext: {
  // The live Leaflet map, so the toolbar's tool selection can drive draw mode.
  map: Leaflet.Map | undefined;
  // All marker/line/polygon/text layers, grouped so they can be cleared at once.
  featureLayers: Leaflet.LayerGroup | undefined;
  // The DOM click event a vector feature consumed, so the map's click handler
  // (which fires immediately afterwards via Leaflet propagation, with the same
  // originalEvent) skips placing a marker on top of it. Storing the event rather
  // than a latched boolean makes it self-correcting: if the follow-up map click
  // never fires, the stale value simply won't match the next, distinct event.
  consumedClick: MouseEvent | undefined;
} = {
  map: undefined,
  featureLayers: undefined,
  consumedClick: undefined,
};

// Editing is gated by the `editable` flag (default true); a locked map only
// pans and zooms — no placing, drawing, editing, or removing features.
export function isEditable(): boolean {
  return state.editable !== false;
}

// Where a feature layer is added — the feature group if present, else the map.
export function featureTarget(
  map: Leaflet.Map,
): Leaflet.Map | Leaflet.LayerGroup {
  return mapContext.featureLayers ?? map;
}
