// End-to-end test for the GeoJSON export (TASK-4): the share panel's "Export
// GeoJSON" button downloads the current map as a lerida.geojson file. Runs
// against the built app in a real Chromium. Run via bs/test:e2e.zsh.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// A central-ish point clear of the toolbar (top) and zoom control (bottom-left).
const MAP_POINT = { x: 700, y: 460 };

Deno.test("share panel exports the map as a GeoJSON download", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;

    // Place a marker so the map has state to export.
    await page.locator("#map").click({ position: MAP_POINT });
    await waitForParams(harness, (params) => params.includes("markers"));

    // Open the share panel from the toolbar header.
    await page.locator("[data-action='share']").click();
    await page.waitForSelector("[data-role='share']");

    // Clicking the export button triggers a file download.
    const download = await Promise.all([
      page.waitForEvent("download"),
      page.locator("[data-action='export-geojson']").click(),
    ]).then(([event]) => event);

    assertEquals(download.suggestedFilename(), "lerida.geojson");

    const path = await download.path();
    assert(path, "the download should have a local path");
    const text = await Deno.readTextFile(path);
    const parsed = JSON.parse(text);

    // It parses to a FeatureCollection with a Point feature for the marker.
    assertEquals(parsed.type, "FeatureCollection");
    const points = parsed.features.filter(
      (feature: { geometry: { type: string } }) =>
        feature.geometry.type === "Point",
    );
    assertEquals(points.length, 1);
    const point = points[0];
    // The marker's default category and colour ride along in its properties.
    assertStringIncludes(JSON.stringify(point.properties), "color");
    assertEquals(point.properties.color, "blue");
    assertEquals(point.properties.feature, "place");
    // Coordinates are [lng, lat] order.
    assertEquals(point.geometry.coordinates.length, 2);
  } finally {
    await harness.close();
  }
});
