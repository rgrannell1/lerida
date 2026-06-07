// Global map state and its two-way binding with the URL query string. The
// component reads and mutates `state`; loadFromUrl decodes the URL into it and
// syncToUrl encodes it back, keeping the URL the single source of truth.

import { type StateObject } from "cycle";
import { decodeUrl, encodeUrl } from "./url.ts";
import type { MapState } from "./types.ts";

// In-memory map state — the single object the map component renders from.
export const state: MapState = {};

// Decode the current URL query string into `state`.
export function loadFromUrl(): void {
  const decoded = decodeUrl(globalThis.location.search);
  state.view = decoded.view;
  state.markers = decoded.markers ?? [];
  state.lines = decoded.lines ?? [];
  state.polygons = decoded.polygons ?? [];
  state.texts = decoded.texts ?? [];
  state.collapsed = decoded.collapsed ?? false;
  state.editable = decoded.editable ?? true;
  state.meta = decoded.meta;
}

// Build a clean snapshot for encoding — omit empty fields so the URL stays
// minimal (no bare `markers=` when there are none).
function snapshot(): StateObject {
  const out: MapState = {};
  if (state.view) {
    out.view = state.view;
  }
  if (state.markers && state.markers.length > 0) {
    out.markers = state.markers;
  }
  if (state.lines && state.lines.length > 0) {
    out.lines = state.lines;
  }
  if (state.polygons && state.polygons.length > 0) {
    out.polygons = state.polygons;
  }
  if (state.texts && state.texts.length > 0) {
    out.texts = state.texts;
  }
  if (state.collapsed) {
    out.collapsed = true;
  }
  // Default is editable; only encode the flag when the map is locked.
  if (state.editable === false) {
    out.editable = false;
  }
  if (state.meta && state.meta.title) {
    out.meta = state.meta;
  }
  return out as unknown as StateObject;
}

// Encode `state` into the URL query string without reloading the page.
export function syncToUrl(): void {
  const query = encodeUrl(snapshot());
  const target = query ? `?${query}` : globalThis.location.pathname;
  globalThis.history.replaceState(null, "", target);
}
