// Table-driven round-trip tests for lerida's canonical schema. Each case asserts
// the bijection in both directions: encode(state) === params (canonical) and
// decode(params) === state.

import { assertEquals } from "@std/assert";
import { type StateObject } from "cycle";
import { codec } from "../ts/schema.ts";
import type { MapState } from "../ts/types.ts";

interface Case {
  name: string;
  state: MapState;
  params: string;
}

const CASES: Case[] = [
  {
    name: "empty state ↔ empty query",
    state: {},
    params: "",
  },
  {
    name: "view only",
    state: { view: { center: { lat: 53.35, lng: -6.26 }, zoom: 7 } },
    params: "view.center.lat=53.35&view.center.lng=-6.26&view.zoom=7",
  },
  {
    name: "markers only",
    state: { markers: [{ lat: 1.5, lng: 2.25 }] },
    params: "markers.0.lat=1.5&markers.0.lng=2.25",
  },
  {
    name: "marker with a POI category",
    state: { markers: [{ lat: 1, lng: 2, feature: "cafe" }] },
    params: "markers.0.lat=1&markers.0.lng=2&markers.0.feature=cafe",
  },
  {
    name: "marker with feature, colour and label",
    state: { markers: [{ lat: 1, lng: 2, feature: "museum", color: "red", label: "Home" }] },
    params: "markers.0.lat=1&markers.0.lng=2&markers.0.feature=museum&" +
      "markers.0.color=red&markers.0.label=Home",
  },
  {
    name: "line with two vertices and a colour",
    state: { lines: [{ points: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], color: "blue" }] },
    params: "lines.0.points.0.lat=1&lines.0.points.0.lng=2&" +
      "lines.0.points.1.lat=3&lines.0.points.1.lng=4&lines.0.color=blue",
  },
  {
    name: "line with directional arrows",
    state: { lines: [{ points: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], arrows: true }] },
    params: "lines.0.points.0.lat=1&lines.0.points.0.lng=2&" +
      "lines.0.points.1.lat=3&lines.0.points.1.lng=4&lines.0.arrows=true",
  },
  {
    name: "text label with size",
    state: { texts: [{ lat: 1, lng: 2, text: "Hi", color: "blue", size: "large" }] },
    params: "texts.0.lat=1&texts.0.lng=2&texts.0.text=Hi&texts.0.color=blue&texts.0.size=large",
  },
  {
    name: "collapsed toolbar flag",
    state: { collapsed: true },
    params: "collapsed=true",
  },
  {
    name: "meta page title",
    state: { meta: { title: "Trip" } },
    params: "meta.title=Trip",
  },
  {
    name: "non-editable (locked) flag",
    state: { editable: false },
    params: "editable=false",
  },
  {
    name: "polygon with three vertices, colour and label",
    state: {
      polygons: [{
        points: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
        color: "green",
        label: "Zone",
      }],
    },
    params: "polygons.0.points.0.lat=0&polygons.0.points.0.lng=0&" +
      "polygons.0.points.1.lat=0&polygons.0.points.1.lng=1&" +
      "polygons.0.points.2.lat=1&polygons.0.points.2.lng=1&" +
      "polygons.0.color=green&polygons.0.label=Zone",
  },
  {
    name: "view and multiple markers, in schema order",
    state: {
      view: { center: { lat: 51.9, lng: -8.47 }, zoom: 12 },
      markers: [{ lat: 51.9, lng: -8.47 }, { lat: 51.85, lng: -8.4 }],
    },
    params: "view.center.lat=51.9&view.center.lng=-8.47&view.zoom=12&" +
      "markers.0.lat=51.9&markers.0.lng=-8.47&markers.1.lat=51.85&markers.1.lng=-8.4",
  },
];

function encodeState(state: MapState): string {
  return codec.encode(state as unknown as StateObject).toString();
}

function decodeParams(params: string): MapState {
  return codec.decode(params) as MapState;
}

Deno.test("encode produces canonical params", () => {
  for (const testCase of CASES) {
    assertEquals(encodeState(testCase.state), testCase.params, testCase.name);
  }
});

Deno.test("decode parses params back to state", () => {
  for (const testCase of CASES) {
    assertEquals(decodeParams(testCase.params), testCase.state, testCase.name);
  }
});

Deno.test("round-trips losslessly", () => {
  for (const testCase of CASES) {
    const roundTripped = decodeParams(encodeState(testCase.state));
    assertEquals(roundTripped, testCase.state, testCase.name);
  }
});
