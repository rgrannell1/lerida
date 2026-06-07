// URL ↔ state transport. cycle encodes the state into canonical query params;
// we round coordinates (to keep them short) and compress the whole thing into a
// single URL-safe `c=` value so shared links stay compact. Decoding accepts both
// the compressed form and a legacy readable param string (so old URLs still open).

import { type StateObject } from "cycle";
import LZString from "lz-string";
import { codec } from "./schema.ts";
import type { MapState } from "./types.ts";

// 5 decimal places ≈ 1.1 m on the ground — below tile/marker resolution, so
// rounding coordinates to this is visually lossless while trimming characters
// off every point.
const COORD_PRECISION = 1e5;

// Deep-clone `value`, rounding any numeric `lat`/`lng` leaf to COORD_PRECISION.
// Generic so it covers view, markers, lines, polygons and texts uniformly.
function roundCoords(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(roundCoords);
  }
  if (value && typeof value === "object") {
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

// Encode a state snapshot into the query string (without the leading "?"). Empty
// state yields an empty string; otherwise the rounded canonical params are
// compressed into a single `c=` value.
export function encodeUrl(snapshot: StateObject): string {
  const params = codec.encode(roundCoords(snapshot) as StateObject).toString();
  if (params === "") {
    return "";
  }
  return `c=${LZString.compressToEncodedURIComponent(params)}`;
}

// Decode a query string (with or without a leading "?") into state. A `c=` value
// is decompressed back to canonical params; any other query is treated as a
// legacy readable param string and decoded directly.
export function decodeUrl(search: string): MapState {
  const query = search.replace(/^\?/, "");
  const compressed = new URLSearchParams(query).get("c");
  if (compressed !== null) {
    const params = LZString.decompressFromEncodedURIComponent(compressed) ?? "";
    return codec.decode(params) as MapState;
  }
  return codec.decode(query) as MapState;
}
