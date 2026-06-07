// Map state types — the fixed vocabulary lerida renders and encodes into the URL.

// A geographic coordinate.
export interface LatLng {
  lat: number;
  lng: number;
}

// The map viewport: where it is centred and how far it is zoomed.
export interface View {
  center: LatLng;
  zoom: number;
}

// A point marker: a coordinate plus an optional POI category id (rendered as a
// Font Awesome pin), colour and text label.
export interface Marker {
  lat: number;
  lng: number;
  feature?: string;
  color?: string;
  label?: string;
}

// A polyline: an ordered list of vertices with an optional colour, label, and
// directional arrows along its length.
export interface Line {
  points: LatLng[];
  color?: string;
  label?: string;
  arrows?: boolean;
  width?: number;
}

// A polygon region: a list of boundary vertices with an optional colour and label.
export interface Polygon {
  points: LatLng[];
  color?: string;
  label?: string;
}

// A free text label placed directly on the map. (Named TextLabel to avoid the
// DOM `Text` global.)
export interface TextLabel {
  lat: number;
  lng: number;
  text: string;
  color?: string;
  size?: string;
}

// App-level settings carried in the URL (the browser page title, for now).
export interface Meta {
  title?: string;
}

// The whole decoded map state. All fields are optional — an empty URL decodes
// to {} and the map falls back to its defaults. `collapsed` minimises the
// toolbar; `editable` (default true) gates all feature editing; `meta` carries
// app-level settings.
export interface MapState {
  view?: View;
  markers?: Marker[];
  lines?: Line[];
  polygons?: Polygon[];
  texts?: TextLabel[];
  collapsed?: boolean;
  editable?: boolean;
  meta?: Meta;
}
