// End-to-end test for embed mode (TASK-6): `?embed=1` renders an interactive,
// chrome-less map for iframe embedding, and the share panel offers a copyable
// <iframe> snippet pointing at that mode. Runs against the built app in a real
// Chromium. Run via bs/test:e2e.zsh. Mirrors share_test.ts.

import { assert, assertStringIncludes } from "@std/assert";
import { type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// A central-ish point clear of the toolbar (top) and zoom control (bottom-left).
const MAP_POINT = { x: 700, y: 460 };

Deno.test("embed mode shows a bare but interactive map with zoom control", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness, "?embed=1");
    const page = harness.page;

    // The editing chrome is gone.
    assert(
      await page.locator("[data-role='toolbar']").count() === 0,
      "toolbar should be absent in embed mode",
    );
    assert(
      await page.locator(".search").count() === 0,
      "search should be absent in embed mode",
    );

    // The map is live and stays interactive: the zoom control is present (embed
    // must not apply the chrome-stripping `.render` class).
    await page.waitForSelector("#map.leaflet-container");
    await page.waitForSelector(".leaflet-control-zoom");
    assert(
      await page.locator(".leaflet-control-zoom").isVisible(),
      "zoom control should be visible in embed mode",
    );
  } finally {
    await harness.close();
  }
});

Deno.test("share panel builds an embed iframe snippet", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;

    // Place a marker so the map has state to embed.
    await page.locator("#map").click({ position: MAP_POINT });
    await waitForParams(harness, (params) => params.includes("markers"));

    // Open the share panel from the toolbar header.
    await page.locator("[data-action='share']").click();
    await page.waitForSelector("[data-role='share']");

    // The snippet is an iframe pointing at embed mode for the current map.
    const snippet = await page.locator("[data-role='embed-snippet']")
      .inputValue();
    assertStringIncludes(snippet, "<iframe");
    assertStringIncludes(snippet, "embed=1");
  } finally {
    await harness.close();
  }
});
