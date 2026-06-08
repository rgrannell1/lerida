// Ephemeral UI state — not encoded in the URL. `tool` is the active drawing tool;
// `selectedFeature` / `selectedColor` are the place-feature and colour applied to
// the next marker the user places.

import { DEFAULT_COLOR, DEFAULT_FEATURE, DEFAULT_LINE_WIDTH, DEFAULT_SIZE } from "./features.ts";

export const ui = {
  tool: "marker",
  selectedFeature: DEFAULT_FEATURE,
  selectedColor: DEFAULT_COLOR,
  selectedSize: DEFAULT_SIZE,
  selectedArrows: false,
  // Stroke weight (px) applied to the next line drawn.
  selectedWidth: DEFAULT_LINE_WIDTH,
  // Whether the feature palette shows the less-common categories (the "…" toggle).
  showAllFeatures: false,
  // Whether the tool palette shows the less-common tools (the "…" toggle).
  showAllTools: false,
  // Whether the "about" overlay (opened from the brand title) is showing.
  showAbout: false,
  // Whether the toolbar is showing the options panel (page title + other meta
  // settings) in place of the drawing tools. Ephemeral, not URL-encoded.
  showOptions: false,
  // The current query in the floating marker-search box (not URL-encoded).
  searchQuery: "",
  // Index of the keyboard-highlighted search result (-1 = none); arrow keys move
  // it, Enter jumps to it. Reset whenever the query changes.
  searchActive: -1,
};
