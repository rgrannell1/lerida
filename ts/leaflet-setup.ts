// @ts-nocheck: side-effect imports of untyped Leaflet plugins (AwesomeMarkers).
// Load Leaflet (as global L) and its plugins, in order. Imported for side
// effects only — the plugins attach themselves to the global L. CSS is bundled
// separately (ts/vendor.css) so the type-checker never sees CSS imports.
import "./leaflet-global.ts";
import "leaflet.awesome-markers";
import "@geoman-io/leaflet-geoman-free";
import "leaflet-polylinedecorator";
