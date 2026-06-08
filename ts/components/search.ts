// Floating search box that filters the map's own markers, then pans the viewport
// to a picked one. Purely local: no geocoding, no network (only the markers
// already in `state`). Shown on locked maps too, since jumping to a place is
// navigation, not editing.
//
// Query grammar: "category:text". The part before the first colon filters by POI
// category (its id or display name); the rest fuzzy-matches the label. With no
// colon the whole string fuzzy-matches the label across every category. "*" (or
// an empty side) means "match anything" — so "cafe:*" is every café.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { state } from "../state.ts";
import { ui } from "../ui.ts";
import { iconFor, nameFor } from "../features.ts";
import { mapContext } from "./map/context.ts";
import type { Marker } from "../types.ts";

const MAX_RESULTS = 6;

interface Query {
  category: string | null;
  text: string;
}

function parseQuery(raw: string): Query {
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

// True if every character of `query` appears in `text` in order (a light fuzzy
// match). "*" and the empty string match anything.
function fuzzy(text: string, query: string): boolean {
  if (query === "" || query === "*") {
    return true;
  }
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let matched = 0;
  for (const char of haystack) {
    if (char === needle[matched]) {
      matched += 1;
      if (matched === needle.length) {
        return true;
      }
    }
  }
  return false;
}

// True if the marker's category matches the token (its id or display name).
// A null / empty / "*" token matches any category.
function categoryMatches(marker: Marker, category: string | null): boolean {
  if (category === null || category === "" || category === "*") {
    return true;
  }
  const id = (marker.feature ?? "").toLowerCase();
  const name = nameFor(marker.feature ?? "").toLowerCase();
  return id.includes(category) || name.includes(category);
}

// Markers passing both the category filter and the fuzzy label match. An empty
// query yields nothing, so the dropdown stays closed.
function matches(): Marker[] {
  if (ui.searchQuery.trim() === "") {
    return [];
  }
  const { category, text } = parseQuery(ui.searchQuery);
  const found = (state.markers ?? []).filter((marker) => {
    const label = `${marker.label ?? ""} ${nameFor(marker.feature ?? "")}`;
    return categoryMatches(marker, category) && fuzzy(label, text);
  });
  return found.slice(0, MAX_RESULTS);
}

// The text shown for a result: its label, or the category name when unlabelled.
function resultLabel(marker: Marker): string {
  return marker.label?.trim() || nameFor(marker.feature ?? "");
}

// Jump the viewport to the picked marker (keeping the current zoom), then clear
// the box. setView fires moveend, so the URL view params update on their own.
function jumpTo(marker: Marker): void {
  const map = mapContext.map;
  if (map) {
    map.setView([marker.lat, marker.lng], map.getZoom());
  }
  ui.searchQuery = "";
}

function resultRow(marker: Marker, index: number): m.Vnode {
  return m("button.search-result", {
    key: index,
    onclick: () => jumpTo(marker),
    "data-search-result": String(index),
  }, [
    m(`i.fa.fa-${iconFor(marker.feature ?? "")}`),
    m("span", resultLabel(marker)),
  ]);
}

export function Search(): m.Component {
  return {
    view() {
      const results = matches();
      const hasQuery = ui.searchQuery !== "";
      return m("div.search", { "data-role": "search" }, [
        m("div.search-box", [
          m("input.search-input", {
            type: "text",
            placeholder: "Search markers (e.g. cafe:*)…",
            spellcheck: false,
            value: ui.searchQuery,
            oninput: (event: InputEvent) => {
              ui.searchQuery = (event.target as HTMLInputElement).value;
            },
            "data-role": "search-input",
          }),
          hasQuery
            ? m("button.search-clear", {
              title: "Clear search",
              onclick: () => {
                ui.searchQuery = "";
              },
              "data-action": "search-clear",
            }, m("i.fa.fa-times"))
            : null,
        ]),
        results.length > 0
          ? m("div.search-results", { "data-role": "search-results" }, results.map(resultRow))
          : null,
      ]);
    },
  };
}
