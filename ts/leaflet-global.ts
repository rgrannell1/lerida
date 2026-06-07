// @ts-nocheck: assigns the untyped Leaflet default to globalThis.L for plugins.
// Bundle Leaflet and expose it as the global `L` before any plugin loads — the
// AwesomeMarkers plugin is a global-`L` IIFE and needs it present at import time.
import L from "leaflet";

globalThis.L = L;

export default L;
