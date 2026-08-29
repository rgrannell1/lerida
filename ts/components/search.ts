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
import { createSearchState } from "./search/actions.ts";
import { searchView } from "./search/view.ts";

export function Search(): m.Component {
  const live = createSearchState();
  return { view: searchView.bind(null, live) };
}
