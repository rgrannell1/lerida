// Marker appearance vocabulary: the semantic point-of-interest categories shown
// in the toolbar palette (each mapped to a Font Awesome 4 glyph), and the colour
// swatches. The URL stores the category id (e.g. `cafe`); the glyph is looked up.

import type { Maybe } from "./maybe.ts";

// A selectable POI category: a semantic id, a display name, and its FA4 glyph.
// `common` categories show in the palette by default; the rest live behind a
// "more" (…) toggle.
export interface Feature {
  id: string;
  name: string;
  icon: string;
  common?: boolean;
}

// Curated POI categories. The URL accepts any category id; the picker shows this
// set. `place` is the neutral default.
export const FEATURES: Feature[] = [
  { id: "place", name: "Place", icon: "map-marker", common: true },
  { id: "favourite", name: "Favourite", icon: "star", common: true },
  { id: "cafe", name: "Café", icon: "coffee", common: true },
  { id: "restaurant", name: "Restaurant", icon: "cutlery", common: true },
  { id: "hotel", name: "Hotel", icon: "bed", common: true },
  { id: "shop", name: "Shop", icon: "shopping-cart", common: true },
  { id: "museum", name: "Museum", icon: "university", common: true },
  { id: "park", name: "Park", icon: "tree", common: true },
  { id: "bar", name: "Bar", icon: "glass" },
  { id: "fashion", name: "Fashion", icon: "shopping-bag" },
  { id: "gallery", name: "Gallery", icon: "paint-brush" },
  { id: "theatre", name: "Theatre", icon: "film" },
  { id: "beach", name: "Beach", icon: "umbrella" },
  { id: "viewpoint", name: "Viewpoint", icon: "camera" },
  { id: "hospital", name: "Hospital", icon: "medkit" },
  { id: "pharmacy", name: "Pharmacy", icon: "plus-square" },
  { id: "bank", name: "Bank", icon: "credit-card" },
  { id: "school", name: "School", icon: "graduation-cap" },
  { id: "library", name: "Library", icon: "book" },
  { id: "airport", name: "Airport", icon: "plane" },
  { id: "train", name: "Train Station", icon: "train" },
  { id: "bus", name: "Bus Stop", icon: "bus" },
  { id: "info", name: "Info", icon: "info" },
];

// Feature id used when a marker declares none.
export const DEFAULT_FEATURE = "place";

// A selectable text size: a semantic id, display name, and font size in pixels.
export interface TextSize {
  id: string;
  name: string;
  px: number;
}

// Text label sizes offered in the text-tool palette.
export const TEXT_SIZES: TextSize[] = [
  { id: "normal", name: "Normal", px: 14 },
  { id: "large", name: "Large", px: 19 },
  { id: "xlarge", name: "Extra Large", px: 26 },
];

// Size id used when a text label declares none.
export const DEFAULT_SIZE = "normal";

// One line-thickness choice: its label and the stroke weight (px) it applies.
export interface LineWidth {
  name: string;
  px: number;
}

// Stroke widths offered in the line-tool palette, thin → thick.
export const LINE_WIDTHS: LineWidth[] = [
  { name: "Thin", px: 2 },
  { name: "Medium", px: 4 },
  { name: "Thick", px: 8 },
];

// Stroke weight (px) used when a line declares none.
export const DEFAULT_LINE_WIDTH = 4;

// Font size (px) for a text-size id, falling back to the normal size.
export function fontSizeFor(sizeId: string): number {
  return TEXT_SIZES.find((each) => each.id === sizeId)?.px ?? 14;
}

// Font Awesome glyph for a feature id, falling back to a generic pin.
const ICON_BY_FEATURE: Record<string, string> = Object.fromEntries(
  FEATURES.map((feature) => [feature.id, feature.icon]),
);

export function iconFor(featureId: string): string {
  return ICON_BY_FEATURE[featureId] ?? "map-marker";
}

// Display name for a feature id, falling back to the raw id.
const NAME_BY_FEATURE: Record<string, string> = Object.fromEntries(
  FEATURES.map((feature) => [feature.id, feature.name]),
);

export function nameFor(featureId: string): string {
  return NAME_BY_FEATURE[featureId] ?? featureId;
}

// A selectable pin colour: an AwesomeMarkers palette name plus the hex used for
// line / polygon paths.
export interface ColorSwatch {
  name: string;
  hex: string;
}

// Curated pin colours (AwesomeMarkers palette names). The URL accepts any name;
// the picker shows this set.
export const MARKER_COLORS: ColorSwatch[] = [
  { name: "red", hex: "#d63e2a" },
  { name: "orange", hex: "#f69730" },
  { name: "green", hex: "#72b026" },
  { name: "blue", hex: "#38aadd" },
  { name: "purple", hex: "#d252b9" },
  { name: "lightblue", hex: "#8adaff" },
  { name: "pink", hex: "#ff91ea" },
  { name: "black", hex: "#575757" },
];

// Colour used when a feature declares none.
export const DEFAULT_COLOR = "blue";

// Resolve a palette colour name to its hex (for line/polygon paths). Unknown
// names pass through so the URL can carry any CSS colour.
export function colorHex(name: string): string {
  const swatch = MARKER_COLORS.find((each) => each.name === name);
  return swatch ? swatch.hex : name;
}

// Reverse of colorHex for the colour palette's highlight: given a feature's
// stored colour (a palette name for markers, a hex for lines/polygons/text),
// return the matching swatch name, or undefined if it isn't a palette colour.
export function swatchName(color: Maybe<string>): Maybe<string> {
  if (!color) {
    return undefined;
  }
  const match = MARKER_COLORS.find((each) =>
    each.name === color || each.hex.toLowerCase() === color.toLowerCase()
  );
  return match?.name;
}
