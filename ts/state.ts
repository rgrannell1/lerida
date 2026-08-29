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
  loadFromQuery(globalThis.location.search);
}

// Decode an explicit query string into `state`. Separate from loadFromUrl so the
// image worker (whose render page has no URL query) can load from an injected
// `?c=...` instead of location.search.
export function loadFromQuery(search: string): void {
  const decoded = decodeUrl(search);
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
function copyFeatures(out: MapState): void {
  const hasMarkers = (state.markers?.length ?? 0) > 0;
  if (hasMarkers) {
    out.markers = state.markers;
  }
  const hasLines = (state.lines?.length ?? 0) > 0;
  if (hasLines) {
    out.lines = state.lines;
  }
  const hasPolygons = (state.polygons?.length ?? 0) > 0;
  if (hasPolygons) {
    out.polygons = state.polygons;
  }
  const hasTexts = (state.texts?.length ?? 0) > 0;
  if (hasTexts) {
    out.texts = state.texts;
  }
}

function copySettings(out: MapState): void {
  if (state.view) {
    out.view = state.view;
  }
  if (state.collapsed) {
    out.collapsed = true;
  }
  // Default is editable; only encode the flag when the map is locked.
  if (state.editable === false) {
    out.editable = false;
  }
  const hasTitle = state.meta?.title !== undefined && state.meta.title !== "";
  if (hasTitle) {
    out.meta = state.meta;
  }
}

function snapshot(): StateObject {
  const out: MapState = {};
  copyFeatures(out);
  copySettings(out);
  return out as unknown as StateObject;
}

// The current state's compressed query ("c=..." or "" when empty) — the same
// value written to the URL. Used to build the render.png share link.
export function shareQuery(): string {
  return encodeUrl(snapshot());
}

// Encode `state` into the URL query string without reloading the page.
export function syncToUrl(): void {
  const query = encodeUrl(snapshot());
  const target = query ? `?${query}` : globalThis.location.pathname;
  globalThis.history.replaceState(null, "", target);
}
