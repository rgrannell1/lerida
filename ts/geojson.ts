// Convert the in-memory map state into a GeoJSON FeatureCollection. Pure and
// DOM-free: markers, lines, polygons and text labels each map to a Feature.
// GeoJSON coordinates are [lng, lat] order, the reverse of our LatLng fields.

import type {
  LatLng,
  Line,
  MapState,
  Marker,
  Polygon,
  TextLabel,
} from "./types.ts";

// A minimal subset of the GeoJSON types we emit (RFC 7946). Geometry is one of
// the three shapes lerida uses; properties is an open bag of feature metadata.
type Position = [number, number];

interface Geometry {
  type: "Point" | "LineString" | "Polygon";
  coordinates: Position | Position[] | Position[][];
}

interface Feature {
  type: "Feature";
  geometry: Geometry;
  properties: Record<string, unknown>;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

// Copy only the defined entries of `props` so undefined fields are omitted from
// the output rather than serialised as nulls.
function definedProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

// [lng, lat] from a LatLng (GeoJSON axis order).
function position(point: LatLng): Position {
  return [point.lng, point.lat];
}

function feature(geometry: Geometry, props: Record<string, unknown>): Feature {
  return { type: "Feature", geometry, properties: definedProps(props) };
}

function markerFeature(marker: Marker): Feature {
  return feature(
    { type: "Point", coordinates: [marker.lng, marker.lat] },
    { label: marker.label, color: marker.color, feature: marker.feature },
  );
}

function lineFeature(line: Line): Feature {
  return feature(
    { type: "LineString", coordinates: line.points.map(position) },
    {
      label: line.label,
      color: line.color,
      arrows: line.arrows,
      width: line.width,
    },
  );
}

function polygonFeature(polygon: Polygon): Feature {
  const ring = polygon.points.map(position);
  if (ring.length > 0) {
    ring.push(ring[0]);
  }
  return feature(
    { type: "Polygon", coordinates: [ring] },
    { label: polygon.label, color: polygon.color },
  );
}

function textFeature(text: TextLabel): Feature {
  return feature(
    { type: "Point", coordinates: [text.lng, text.lat] },
    { text: text.text, color: text.color, size: text.size, role: "text" },
  );
}

// Build a FeatureCollection from the current map state.
export function stateToGeoJSON(state: MapState): FeatureCollection {
  const features: Feature[] = [];

  for (const marker of state.markers ?? []) {
    features.push(markerFeature(marker));
  }

  for (const line of state.lines ?? []) {
    features.push(lineFeature(line));
  }

  for (const polygon of state.polygons ?? []) {
    features.push(polygonFeature(polygon));
  }

  for (const text of state.texts ?? []) {
    features.push(textFeature(text));
  }

  return { type: "FeatureCollection", features };
}
