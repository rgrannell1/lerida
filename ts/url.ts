// URL ↔ state transport. cycle's withCompression wrapper handles the whole
// transport: state is encoded to canonical params, compressed into a single
// URL-safe `c=` value, and decode falls back to legacy readable param strings
// so old URLs still open. We round coordinates before encoding to keep them
// short.

import { type StateObject, withCompression } from "cycle";
import { codec } from "./schema.ts";
import type { MapState } from "./types.ts";

// 5 decimal places ≈ 1.1 m on the ground — below tile/marker resolution, so
// rounding coordinates to this is visually lossless while trimming characters
// off every point.
const COORD_PRECISION = 1e5;

// The compressed transport codec — compression and legacy readable-param
// fallback are delegated to cycle.
const compressedCodec = withCompression(codec);

// Deep-clone `value`, rounding any numeric `lat`/`lng` leaf to COORD_PRECISION.
// Generic so it covers view, markers, lines, polygons and texts uniformly.
function roundCoords(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(roundCoords);
  }
  const isObject = value !== null && typeof value === "object";
  if (isObject) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = (key === "lat" || key === "lng") && typeof item === "number"
        ? Math.round(item * COORD_PRECISION) / COORD_PRECISION
        : roundCoords(item);
    }
    return out;
  }
  return value;
}

// Encode a state snapshot into the query string (without the leading "?").
// Empty state yields an empty string.
export function encodeUrl(snapshot: StateObject): string {
  return compressedCodec.encode(roundCoords(snapshot) as StateObject).toString();
}

// Decode a query string (with or without a leading "?") into state. cycle
// decompresses a `c=` value, or decodes any other query as a legacy readable
// param string.
export function decodeUrl(search: string): MapState {
  return compressedCodec.decode(search.replace(/^\?/, "")) as MapState;
}
