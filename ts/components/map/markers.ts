// Marker rendering: a coloured AwesomeMarkers pin carrying the POI category glyph.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { awesomeMarkers, leaflet } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { DEFAULT_COLOR, DEFAULT_FEATURE, iconFor } from "../../features.ts";
import type { Marker } from "../../types.ts";
import { dropFrom, markElement, wireFeature } from "./editor.ts";
import { featureTarget } from "./context.ts";

// How far above the marker position the label tooltip sits, clearing the pin.
const MARKER_TOOLTIP_ANCHOR: [number, number] = [0, -38];
// Markers render above text labels so a nearby label can't hide the pin.
const MARKER_Z_INDEX = 1000;

// Build a coloured pin containing the feature's Font Awesome glyph. The tooltip
// anchor lifts the label above the pin so the pin isn't covered by its own label.
function awesomeIcon(glyph: string, color: string): Leaflet.Icon {
  const icon = awesomeMarkers.icon({ icon: glyph, prefix: "fa", markerColor: color });
  (icon.options as { tooltipAnchor?: Leaflet.PointExpression }).tooltipAnchor =
    MARKER_TOOLTIP_ANCHOR;
  return icon;
}

export function addMarkerLayer(map: Leaflet.Map, marker: Marker): void {
  const glyph = iconFor(marker.feature ?? DEFAULT_FEATURE);
  const layer = leaflet.marker([marker.lat, marker.lng], {
    icon: awesomeIcon(glyph, marker.color ?? DEFAULT_COLOR),
    zIndexOffset: MARKER_Z_INDEX,
  });
  wireFeature(layer, marker, () => {
    state.markers = dropFrom(state.markers, marker);
    layer.remove();
    syncToUrl();
  }, false);
  layer.addTo(featureTarget(map));
  markElement(layer, "marker");
}

// Append a marker at the clicked point using the toolbar's selected icon/colour.
export function placeMarker(map: Leaflet.Map, point: Leaflet.LatLng): void {
  const marker: Marker = {
    lat: point.lat,
    lng: point.lng,
    feature: ui.selectedFeature,
    color: ui.selectedColor,
  };
  state.markers = state.markers ?? [];
  state.markers.push(marker);
  addMarkerLayer(map, marker);
  syncToUrl();
}
