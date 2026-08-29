// Search state updates, map navigation, and geocode effects.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { geocode, type Place } from "../../geocode.ts";
import type { Maybe } from "../../maybe.ts";
import { ui } from "../../ui.ts";
import { mapContext } from "../map/context.ts";
import { osmQueryText } from "./service.ts";

const DEBOUNCE_MS = 600;
const MIN_OSM_QUERY = 3;

export interface SearchState {
  places: Place[];
  loading: boolean;
  timer: Maybe<number>;
  controller: Maybe<AbortController>;
  pendingQuery: string;
  shouldFocus: boolean;
}

export function createSearchState(): SearchState {
  return {
    places: [],
    loading: false,
    timer: undefined,
    controller: undefined,
    pendingQuery: "",
    shouldFocus: false,
  };
}

export function clearSearch(state: SearchState): void {
  ui.searchQuery = "";
  ui.searchActive = -1;
  ui.searchExpanded = false;
  state.places = [];
  state.loading = false;
  if (state.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  state.controller?.abort();
}

function currentViewbox(): Maybe<string> {
  const map = mapContext.map;
  if (!map) {
    return undefined;
  }
  const bounds = map.getBounds();
  return `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
}

function acceptPlaces(state: SearchState, result: Place[]): void {
  if (ui.searchQuery !== state.pendingQuery) {
    return;
  }
  state.places = result;
  state.loading = false;
  m.redraw();
}

function rejectPlaces(state: SearchState): void {
  if (ui.searchQuery !== state.pendingQuery) {
    return;
  }
  state.places = [];
  state.loading = false;
  m.redraw();
}

function runGeocode(state: SearchState, query: string): void {
  const controller = new AbortController();
  state.controller = controller;
  state.pendingQuery = ui.searchQuery;
  geocode(query, { signal: controller.signal, viewbox: currentViewbox() })
    .then(acceptPlaces.bind(null, state))
    .catch(rejectPlaces.bind(null, state));
}

export function scheduleGeocode(state: SearchState): void {
  if (state.timer !== undefined) {
    clearTimeout(state.timer);
  }
  state.controller?.abort();
  const query = osmQueryText(ui.searchQuery);
  if (query.length < MIN_OSM_QUERY) {
    state.places = [];
    state.loading = false;
    return;
  }
  state.loading = true;
  state.timer = setTimeout(runGeocode.bind(null, state, query), DEBOUNCE_MS);
}

export function expandSearch(state: SearchState): void {
  ui.searchExpanded = true;
  state.shouldFocus = true;
}

export function focusSearch(state: SearchState, vnode: m.VnodeDOM): void {
  if (!state.shouldFocus) {
    return;
  }
  (vnode.dom as HTMLInputElement).focus();
  state.shouldFocus = false;
}

export function updateSearchQuery(state: SearchState, event: InputEvent): void {
  ui.searchQuery = (event.target as HTMLInputElement).value;
  ui.searchActive = -1;
  scheduleGeocode(state);
}
