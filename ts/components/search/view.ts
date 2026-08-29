// Mithril views for the floating search control and its results.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { iconFor } from "../../features.ts";
import type { Place } from "../../geocode.ts";
import { state } from "../../state.ts";
import type { Marker } from "../../types.ts";
import { ui } from "../../ui.ts";
import { DOM_ATTRIBUTE } from "../dom-attributes.ts";
import {
  clearSearch,
  expandSearch,
  focusSearch,
  type SearchState,
  updateSearchQuery,
} from "./actions.ts";
import {
  jumpToMarker,
  jumpToPlace,
  onSearchKeyDown,
} from "./navigation.ts";
import {
  markerLabel,
  markerMatches,
  searchItems,
  type SearchItem,
} from "./service.ts";

interface PlaceRowOptions {
  state: SearchState;
  markerCount: number;
}

function markerRow(state: SearchState, marker: Marker, idx: number): m.Vnode {
  const selector = ui.searchActive === idx
    ? "button.search-result.active"
    : "button.search-result";
  return m(selector, {
    key: `m${idx}`,
    onclick: jumpToMarker.bind(null, state, marker),
    "data-search-result": String(idx),
  }, [
    m(`i.fa.fa-${iconFor(marker.feature ?? "")}`),
    m("span", markerLabel(marker)),
  ]);
}

function placeRow(
  options: PlaceRowOptions,
  place: Place,
  idx: number,
): m.Vnode {
  const combined = options.markerCount + idx;
  const selector = ui.searchActive === combined
    ? "button.search-result.active"
    : "button.search-result";
  return m(selector, {
    key: `p${idx}`,
    onclick: jumpToPlace.bind(null, options.state, place),
    "data-place-result": String(idx),
  }, [m("i.fa.fa-map-marker"), m("span", place.label)]);
}

function resultGroups(state: SearchState, markers: Marker[]): m.Vnode[] {
  const showHeadings = markers.length > 0 && state.places.length > 0;
  const groups: m.Vnode[] = [];
  if (markers.length > 0) {
    if (showHeadings) {
      groups.push(m("div.search-heading", "Markers"));
    }
    groups.push(...markers.map(markerRow.bind(null, state)));
  }
  if (state.places.length > 0) {
    if (showHeadings) {
      groups.push(m("div.search-heading", "Places"));
    }
    const options = { state, markerCount: markers.length };
    groups.push(...state.places.map(placeRow.bind(null, options)));
  }
  return groups;
}

function searchToggle(state: SearchState): m.Vnode {
  return m("button.search-toggle", {
    title: "Search",
    [DOM_ATTRIBUTE.action]: "search-toggle",
    onclick: expandSearch.bind(null, state),
  }, m("i.fa.fa-search"));
}

function searchInput(state: SearchState, items: SearchItem[]): m.Vnode {
  return m("input.search-input", {
    type: "text",
    placeholder: "Search places",
    spellcheck: false,
    value: ui.searchQuery,
    oncreate: focusSearch.bind(null, state),
    onupdate: focusSearch.bind(null, state),
    oninput: updateSearchQuery.bind(null, state),
    onkeydown: onSearchKeyDown.bind(null, state, items),
    [DOM_ATTRIBUTE.role]: "search-input",
  });
}

function loadingIndicator(state: SearchState): m.Vnode[] {
  if (!state.loading) {
    return [];
  }
  return [m("i.fa.fa-spinner.fa-spin.search-spinner", {
    [DOM_ATTRIBUTE.role]: "search-loading",
  })];
}

function clearButton(state: SearchState): m.Vnode[] {
  if (ui.searchQuery === "") {
    return [];
  }
  return [m("button.search-clear", {
    title: "Clear search",
    onclick: clearSearch.bind(null, state),
    [DOM_ATTRIBUTE.action]: "search-clear",
  }, m("i.fa.fa-times"))];
}

function searchBox(state: SearchState, items: SearchItem[]): m.Vnode {
  return m("div.search-box", [
    searchInput(state, items),
    ...loadingIndicator(state),
    ...clearButton(state),
  ]);
}

function searchResults(groups: m.Vnode[]): m.Vnode[] {
  if (groups.length === 0) {
    return [];
  }
  return [m("div.search-results", {
    [DOM_ATTRIBUTE.role]: "search-results",
  }, groups)];
}

export function searchView(live: SearchState): m.Vnode {
  const markers = markerMatches(ui.searchQuery, state.markers ?? []);
  const items = searchItems(markers, live.places);
  const groups = resultGroups(live, markers);
  const selector = ui.searchExpanded ? "div.search.expanded" : "div.search";
  return m(selector, { [DOM_ATTRIBUTE.role]: "search" }, [
    searchToggle(live),
    searchBox(live, items),
    ...searchResults(groups),
  ]);
}
