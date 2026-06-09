// Client-side geocoding via OpenStreetMap's Nominatim. It runs entirely in the
// browser (Nominatim sends Access-Control-Allow-Origin: *), so lerida stays
// backend-free: only the typed query leaves, never the map state.
//
// Nominatim's usage policy caps callers at ~1 request/second and forbids
// per-keystroke autocomplete, so callers must debounce. Results are cached here
// so repeats and re-renders cost nothing.

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

// A geocoded place: a display label, its point, and (when Nominatim gives one) a
// bounding box as Leaflet [[south, west], [north, east]] for fitBounds.
export interface Place {
  label: string;
  lat: number;
  lng: number;
  bounds?: [[number, number], [number, number]];
}

// Nominatim's boundingbox is [south, north, west, east] as strings.
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

function toPlace(result: NominatimResult): Place {
  const box = result.boundingbox;
  return {
    label: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon),
    bounds: box
      ? [[Number(box[0]), Number(box[2])], [Number(box[1]), Number(box[3])]]
      : undefined,
  };
}

export interface GeocodeOptions {
  // Cancels an in-flight request when the query moves on.
  signal?: AbortSignal;
  // A "west,north,east,south" box; when set, results are restricted to it
  // (Nominatim viewbox + bounded=1).
  viewbox?: string;
}

const cache = new Map<string, Place[]>();

// Look up `query` against Nominatim, returning up to five places. Cached by the
// query text and the viewbox (results differ per map view).
export async function geocode(query: string, options: GeocodeOptions = {}): Promise<Place[]> {
  const { signal, viewbox } = options;
  const key = `${viewbox ?? ""}|${query.trim().toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  let url = `${ENDPOINT}?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  if (viewbox) {
    url += `&viewbox=${encodeURIComponent(viewbox)}&bounded=1`;
  }
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`geocode failed: ${response.status}`);
  }
  const results = await response.json() as NominatimResult[];
  const places = results.map(toPlace);
  cache.set(key, places);
  return places;
}
