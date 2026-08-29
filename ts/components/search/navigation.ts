// Search-result navigation and keyboard updates.

import type { Place } from "../../geocode.ts";
import type { Marker } from "../../types.ts";
import { ui } from "../../ui.ts";
import { mapContext } from "../map/context.ts";
import { clearSearch, type SearchState } from "./actions.ts";
import type { SearchItem } from "./service.ts";

export function jumpToMarker(state: SearchState, marker: Marker): void {
  const map = mapContext.map;
  map?.setView([marker.lat, marker.lng], map.getZoom());
  clearSearch(state);
}

export function jumpToPlace(state: SearchState, place: Place): void {
  const map = mapContext.map;
  if (!map) {
    clearSearch(state);
    return;
  }
  if (place.bounds) {
    map.fitBounds(place.bounds);
  } else {
    map.setView([place.lat, place.lng], 14);
  }
  clearSearch(state);
}

function activate(state: SearchState, item: SearchItem): void {
  if (item.kind === "marker") {
    jumpToMarker(state, item.marker);
  } else {
    jumpToPlace(state, item.place);
  }
}

export function onSearchKeyDown(
  state: SearchState,
  items: SearchItem[],
  event: KeyboardEvent,
): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    ui.searchActive = items.length === 0
      ? -1
      : (ui.searchActive + 1) % items.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    ui.searchActive = items.length === 0
      ? -1
      : (ui.searchActive <= 0 ? items.length : ui.searchActive) - 1;
  } else if (event.key === "Enter") {
    const target = ui.searchActive >= 0 ? items[ui.searchActive] : items[0];
    if (target) {
      activate(state, target);
    }
  } else if (event.key === "Escape") {
    clearSearch(state);
  }
}
