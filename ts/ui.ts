// Ephemeral UI state — not encoded in the URL. `tool` is the active drawing tool;
// `selectedFeature` / `selectedColor` are the place-feature and colour applied to
// the next marker the user places.

import { DEFAULT_COLOR, DEFAULT_FEATURE, DEFAULT_SIZE } from "./features.ts";

export const ui = {
  tool: "marker",
  selectedFeature: DEFAULT_FEATURE,
  selectedColor: DEFAULT_COLOR,
  selectedSize: DEFAULT_SIZE,
  selectedArrows: false,
  // Whether the feature palette shows the less-common categories (the "…" toggle).
  showAllFeatures: false,
};
