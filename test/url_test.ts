// Tests for the URL transport layer: coordinate rounding, always-on compression
// into a single `c=` param, round-tripping, and backward-compatible decoding of
// legacy readable (uncompressed) query strings.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { type StateObject } from "cycle";
import { decodeUrl, encodeUrl } from "../ts/url.ts";
import { codec } from "../ts/schema.ts";
import type { MapState } from "../ts/types.ts";

function enc(state: MapState): string {
  return encodeUrl(state as unknown as StateObject);
}

Deno.test("encodeUrl compresses into a single c= param", () => {
  const url = enc({ markers: [{ lat: 53.349, lng: -6.26 }] });
  assertStringIncludes(url, "c=");
  assert(
    !url.includes("markers.0.lat="),
    "readable params must not leak into the compressed URL",
  );
});

Deno.test("a compressed URL round-trips back to the same state", () => {
  const state: MapState = {
    view: { center: { lat: 53.34399, lng: -6.26221 }, zoom: 13 },
    markers: [{ lat: 53.35, lng: -6.27, feature: "cafe", color: "red" }],
    lines: [{
      points: [{ lat: 53.3, lng: -6.2 }, { lat: 53.31, lng: -6.21 }],
      width: 4,
    }],
  };
  assertEquals(decodeUrl("?" + enc(state)), state);
});

Deno.test("coordinates are rounded to ~1.1 m (5 dp) before encoding", () => {
  const decoded = decodeUrl(
    "?" + enc({
      markers: [{ lat: 53.34399288223422, lng: -6.262207031250001 }],
    }),
  );
  assertEquals(decoded.markers, [{ lat: 53.34399, lng: -6.26221 }]);
});

Deno.test("a legacy readable query (no c=) still decodes", () => {
  const params = codec.encode(
    { markers: [{ lat: 1, lng: 2 }] } as unknown as StateObject,
  ).toString();
  assertEquals(decodeUrl("?" + params), { markers: [{ lat: 1, lng: 2 }] });
});

Deno.test("empty state encodes to an empty query", () => {
  assertEquals(enc({}), "");
});

Deno.test("the compressed form is shorter than the raw params for a busy map", () => {
  const markers = Array.from({ length: 12 }, (_unused, index) => ({
    lat: 53.3 + index * 0.001,
    lng: -6.3 + index * 0.001,
    feature: "cafe",
    color: "blue",
  }));
  const state: MapState = { markers };
  const raw = codec.encode(state as unknown as StateObject).toString();
  assert(
    enc(state).length < raw.length,
    "compressed URL should be shorter than the raw params",
  );
});
