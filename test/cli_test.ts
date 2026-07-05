// Tests for the CLI's pure buildUrl(): valid states must produce a URL whose
// query decodes back to an equivalent state (a real round-trip), and invalid
// states must be rejected by the schema with useful errors.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { buildUrl, decodeState } from "../ts/cli.ts";
import { decodeUrl } from "../ts/url.ts";
import type { MapState } from "../ts/types.ts";

// Pull the `c=...` query back off a full URL so we can decode it independently
// of whatever base was used.
function queryOf(url: string): string {
  return url.slice(url.indexOf("?"));
}

interface ValidCase {
  name: string;
  state: MapState;
}

const VALID_CASES: ValidCase[] = [
  {
    name: "view and a marker",
    state: {
      view: { center: { lat: 53.34399, lng: -6.26221 }, zoom: 13 },
      markers: [{ lat: 53.35, lng: -6.27, feature: "cafe", color: "red" }],
    },
  },
  {
    name: "line with width and a polygon",
    state: {
      lines: [{ points: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], width: 4 }],
      polygons: [{
        points: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
        color: "green",
      }],
    },
  },
  {
    name: "flags and meta",
    state: { collapsed: true, editable: false, meta: { title: "Trip" } },
  },
];

interface InvalidCase {
  name: string;
  state: unknown;
  // A fragment we expect to see in one of the reported errors.
  expect: string;
}

const INVALID_CASES: InvalidCase[] = [
  {
    name: "wrong type for a boolean field",
    state: { collapsed: "yes" },
    expect: "boolean",
  },
  {
    name: "unknown property (additionalProperties:false)",
    state: { markers: [{ lat: 1, lng: 2, bogus: 3 }] },
    expect: "additional properties",
  },
  {
    name: "unknown top-level key",
    state: { nonsense: true },
    expect: "additional properties",
  },
];

Deno.test("valid states are accepted and round-trip through the URL", () => {
  for (const testCase of VALID_CASES) {
    const result = buildUrl(testCase.state, "https://example.test");
    assert(result.ok, `${testCase.name} should be accepted`);
    assertStringIncludes(result.url, "https://example.test/?c=", testCase.name);
    assertEquals(decodeUrl(queryOf(result.url)), testCase.state, testCase.name);
  }
});

Deno.test("an empty state is valid and yields the bare base URL", () => {
  const result = buildUrl({}, "https://example.test");
  assert(result.ok);
  assertEquals(result.url, "https://example.test/");
});

Deno.test("the default base is used when none is given", () => {
  const result = buildUrl({ collapsed: true });
  assert(result.ok);
  assertStringIncludes(result.url, "https://lerida.rho.ie/?c=");
});

Deno.test("invalid states are rejected with schema errors", () => {
  for (const testCase of INVALID_CASES) {
    const result = buildUrl(testCase.state, "https://example.test");
    assert(!result.ok, `${testCase.name} should be rejected`);
    assert(result.errors.length > 0, `${testCase.name} should report errors`);
    const joined = result.errors.join("\n").toLowerCase();
    assertStringIncludes(joined, testCase.expect, testCase.name);
  }
});

Deno.test("decodeState recovers the state encoded by buildUrl (round-trip)", () => {
  for (const testCase of VALID_CASES) {
    const built = buildUrl(testCase.state, "https://example.test");
    assert(built.ok, `${testCase.name} should encode`);
    const decoded = decodeState(built.url);
    assert(decoded.ok, `${testCase.name} should decode`);
    assertEquals(decoded.state, testCase.state, testCase.name);
  }
});

Deno.test("decodeState accepts a full URL, a bare query, and a raw c= value", () => {
  const built = buildUrl({ collapsed: true }, "https://example.test");
  assert(built.ok);
  const query = queryOf(built.url); // "?c=..."
  const raw = query.slice(1); // "c=..."
  for (const form of [built.url, query, raw]) {
    const decoded = decodeState(form);
    assert(decoded.ok, `should decode ${form}`);
    assertEquals(decoded.state, { collapsed: true });
  }
});

Deno.test("an empty query decodes to an empty state", () => {
  const decoded = decodeState("https://example.test/");
  assert(decoded.ok);
  assertEquals(decoded.state, {});
});
