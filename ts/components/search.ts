// Floating search box. It searches two sources at once: the map's own markers
// (instant, local, by label + category) and OpenStreetMap places (Nominatim,
// debounced, client-side via ts/geocode.ts). Picking a marker pans to it; picking
// a place fits the viewport to its bounds. Shown on locked maps too, since
// jumping to a place is navigation, not editing.
//
// Query grammar (markers only): "category:text". The part before the first colon
// filters by POI category (id or display name); the rest fuzzy-matches the label.
// With no colon the whole string fuzzy-matches the label across every category.
// "*" (or an empty side) means "match anything", so "cafe:*" is every café. The
// OSM lookup uses the same words with the colon dropped.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { state } from "../state.ts";
import { ui } from "../ui.ts";
import { iconFor, nameFor } from "../features.ts";
import { mapContext } from "./map/context.ts";
import { geocode, type Place } from "../geocode.ts";
import type { Marker } from "../types.ts";

const MAX_RESULTS = 6;
// Wait this long after the last keystroke before hitting Nominatim, and only for
// queries at least this long — both keep us within Nominatim's usage policy.
const DEBOUNCE_MS = 600;
const MIN_OSM_QUERY = 3;

// OSM results for the current query, and whether a lookup is in flight. Kept at
// module scope (one Search instance) so async resolution can update the view.
let places: Place[] = [];
let loading = false;
let timer: number | undefined;
let controller: AbortController | undefined;
// The query the in-flight lookup was fired for, to drop stale responses.
let pendingQuery = "";

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

// The words to send to OSM: the query's parts minus any "*" wildcard and colon.
function osmQueryText(): string {
  const { category, text } = parseQuery(ui.searchQuery);
  return [category, text].filter((part) => part && part !== "*").join(" ").trim();
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
function markerMatches(): Marker[] {
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

// Reset the box and all OSM lookup state.
function clearSearch(): void {
  ui.searchQuery = "";
  ui.searchActive = -1;
  places = [];
  loading = false;
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  controller?.abort();
}

// The current map bounds as a Nominatim "west,north,east,south" viewbox, so OSM
// results are constrained to what the user is looking at.
function currentViewbox(): string | undefined {
  const map = mapContext.map;
  if (!map) {
    return undefined;
  }
  const bounds = map.getBounds();
  return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
}

// Debounced OSM lookup, re-armed on every keystroke. Short queries skip OSM.
function scheduleGeocode(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  controller?.abort();
  const query = osmQueryText();
  if (query.length < MIN_OSM_QUERY) {
    places = [];
    loading = false;
    return;
  }
  loading = true;
  timer = setTimeout(() => {
    const live = new AbortController();
    controller = live;
    pendingQuery = ui.searchQuery;
    geocode(query, { signal: live.signal, viewbox: currentViewbox() })
      .then((result) => {
        if (ui.searchQuery !== pendingQuery) {
          return;
        }
        places = result;
        loading = false;
        m.redraw();
      })
      .catch(() => {
        if (ui.searchQuery !== pendingQuery) {
          return;
        }
        places = [];
        loading = false;
        m.redraw();
      });
  }, DEBOUNCE_MS);
}

// A unified result entry so keyboard nav can span both groups in order.
type Item = { kind: "marker"; marker: Marker } | { kind: "place"; place: Place };

function items(markers: Marker[]): Item[] {
  return [
    ...markers.map((marker): Item => ({ kind: "marker", marker })),
    ...places.map((place): Item => ({ kind: "place", place })),
  ];
}

// Jump the viewport to a picked marker (keeping the current zoom), then clear the
// box. setView fires moveend, so the URL view params update on their own.
function jumpToMarker(marker: Marker): void {
  mapContext.map?.setView([marker.lat, marker.lng], mapContext.map.getZoom());
  clearSearch();
}

// Fit the viewport to a picked place's bounds (or centre on it when it has none),
// then clear the box.
function jumpToPlace(place: Place): void {
  const map = mapContext.map;
  if (map && place.bounds) {
    map.fitBounds(place.bounds);
  } else if (map) {
    map.setView([place.lat, place.lng], 14);
  }
  clearSearch();
}

function activate(item: Item): void {
  if (item.kind === "marker") {
    jumpToMarker(item.marker);
  } else {
    jumpToPlace(item.place);
  }
}

// The text shown for a marker result: its label, or the category when unlabelled.
function markerLabel(marker: Marker): string {
  return marker.label?.trim() || nameFor(marker.feature ?? "");
}

function markerRow(marker: Marker, index: number): m.Vnode {
  const selector = ui.searchActive === index
    ? "button.search-result.active"
    : "button.search-result";
  return m(selector, {
    key: `m${index}`,
    onclick: () => jumpToMarker(marker),
    "data-search-result": String(index),
  }, [
    m(`i.fa.fa-${iconFor(marker.feature ?? "")}`),
    m("span", markerLabel(marker)),
  ]);
}

function placeRow(place: Place, placeIndex: number, markerCount: number): m.Vnode {
  const combined = markerCount + placeIndex;
  const selector = ui.searchActive === combined
    ? "button.search-result.active"
    : "button.search-result";
  return m(selector, {
    key: `p${placeIndex}`,
    onclick: () => jumpToPlace(place),
    "data-place-result": String(placeIndex),
  }, [
    m("i.fa.fa-map-marker"),
    m("span", place.label),
  ]);
}

// Arrow keys move the highlight through the combined list, Enter jumps to it (or
// the first item when none is highlighted), Escape clears the box.
function onKeyDown(event: KeyboardEvent, list: Item[]): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    ui.searchActive = list.length === 0 ? -1 : (ui.searchActive + 1) % list.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    ui.searchActive = list.length === 0
      ? -1
      : (ui.searchActive <= 0 ? list.length : ui.searchActive) - 1;
  } else if (event.key === "Enter") {
    const target = ui.searchActive >= 0 ? list[ui.searchActive] : list[0];
    if (target) {
      activate(target);
    }
  } else if (event.key === "Escape") {
    clearSearch();
  }
}

export function Search(): m.Component {
  return {
    view() {
      const markers = markerMatches();
      const list = items(markers);
      const hasQuery = ui.searchQuery !== "";
      const showHeadings = markers.length > 0 && places.length > 0;
      const groups: m.Vnode[] = [];
      if (markers.length > 0) {
        if (showHeadings) {
          groups.push(m("div.search-heading", "Markers"));
        }
        groups.push(...markers.map(markerRow));
      }
      if (places.length > 0) {
        if (showHeadings) {
          groups.push(m("div.search-heading", "Places"));
        }
        groups.push(...places.map((place, index) => placeRow(place, index, markers.length)));
      }
      return m("div.search", { "data-role": "search" }, [
        m("div.search-box", [
          m("input.search-input", {
            type: "text",
            placeholder: "Search markers and places…",
            spellcheck: false,
            value: ui.searchQuery,
            oninput: (event: InputEvent) => {
              ui.searchQuery = (event.target as HTMLInputElement).value;
              // A changed query reshuffles the results, so drop the highlight.
              ui.searchActive = -1;
              scheduleGeocode();
            },
            onkeydown: (event: KeyboardEvent) => onKeyDown(event, list),
            "data-role": "search-input",
          }),
          loading
            ? m("i.fa.fa-spinner.fa-spin.search-spinner", { "data-role": "search-loading" })
            : null,
          hasQuery
            ? m("button.search-clear", {
              title: "Clear search",
              onclick: clearSearch,
              "data-action": "search-clear",
            }, m("i.fa.fa-times"))
            : null,
        ]),
        groups.length > 0
          ? m("div.search-results", { "data-role": "search-results" }, groups)
          : null,
      ]);
    },
  };
}
