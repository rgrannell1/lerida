// Pure query parsing and local marker matching for search.

import { nameFor } from "../../features.ts";
import type { Place } from "../../geocode.ts";
import type { Marker } from "../../types.ts";

const MAX_RESULTS = 6;

interface Query {
  category: string | null;
  text: string;
}

export type SearchItem = { kind: "marker"; marker: Marker } | {
  kind: "place";
  place: Place;
};

export function parseQuery(raw: string): Query {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(":");
  if (colon === -1) {
    return { category: null, text: trimmed };
  }
  return {
    category: trimmed.slice(0, colon).trim().toLowerCase(),
    text: trimmed.slice(colon + 1).trim(),
  };
}

export function osmQueryText(raw: string): string {
  const { category, text } = parseQuery(raw);
  return [category, text].filter((part) => part && part !== "*").join(" ")
    .trim();
}

function fuzzy(text: string, query: string): boolean {
  const matchesAll = query === "" || query === "*";
  if (matchesAll) {
    return true;
  }
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let matched = 0;
  for (const character of haystack) {
    if (character === needle[matched]) {
      matched += 1;
      if (matched === needle.length) {
        return true;
      }
    }
  }
  return false;
}

function categoryMatches(marker: Marker, category: string | null): boolean {
  const matchesAll = category === null || category === "" || category === "*";
  if (matchesAll) {
    return true;
  }
  const id = (marker.feature ?? "").toLowerCase();
  const name = nameFor(marker.feature ?? "").toLowerCase();
  return id.includes(category) || name.includes(category);
}

export function markerMatches(raw: string, markers: Marker[]): Marker[] {
  if (raw.trim() === "") {
    return [];
  }
  const { category, text } = parseQuery(raw);
  const found = markers.filter((marker) => {
    const label = `${marker.label ?? ""} ${nameFor(marker.feature ?? "")}`;
    return categoryMatches(marker, category) && fuzzy(label, text);
  });
  return found.slice(0, MAX_RESULTS);
}

export function markerLabel(marker: Marker): string {
  return marker.label?.trim() || nameFor(marker.feature ?? "");
}

export function searchItems(markers: Marker[], places: Place[]): SearchItem[] {
  return [
    ...markers.map((marker): SearchItem => ({ kind: "marker", marker })),
    ...places.map((place): SearchItem => ({ kind: "place", place })),
  ];
}
