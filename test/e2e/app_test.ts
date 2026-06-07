// End-to-end tests driving the built app in a real browser. Each test asserts on
// the URL query string (the app's single source of truth) or the DOM — never on
// tile imagery — so the suite runs offline. Run via `bs/test:e2e.zsh`, which
// builds the bundle first; these tests load `web/dist/js/app.js` as-is.
//
// Elements are selected by stable data-* attributes (added in ts/components/),
// never by Font Awesome / Leaflet / AwesomeMarkers class names — those belong to
// third-party libraries and change without notice.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { currentQuery, type Harness, launch, openApp } from "./helpers.ts";

// Selectors keyed off our own data-* attributes.
const PIN = "[data-feature='marker']";
const TEXT_INPUT = "[data-role='text-input']";
const TOOLBAR = "[data-role='toolbar']";

// A central-ish viewport point that clears the toolbar (top) and zoom control
// (bottom-left) — safe to click for placing a feature on the map.
const MAP_POINT = { x: 700, y: 460 };
const MAP_POINT_B = { x: 520, y: 360 };

// Run `body` against a fresh harness, always tearing it down afterwards.
async function withApp(body: (harness: Harness) => Promise<void>): Promise<void> {
  const harness = await launch();
  try {
    await body(harness);
  } finally {
    await harness.close();
  }
}

Deno.test("app loads and renders the map without console errors", async () => {
  await withApp(async (harness) => {
    const errors: string[] = [];
    harness.page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    harness.page.on("pageerror", (error) => errors.push(error.message));
    await openApp(harness);
    await harness.page.waitForSelector(TOOLBAR);
    // The four drawing tools (marker / line / polygon / text) are present.
    assertEquals(await harness.page.locator("[data-tool]").count(), 4);
    // Offline tile / favicon fetches 404 — those aside, nothing should error.
    const ignore = /tile|openstreetmap|net::|404|Failed to load/i;
    const real = errors.filter((text) => !ignore.test(text));
    assertEquals(real, [], `unexpected console errors: ${real.join("; ")}`);
  });
});

Deno.test("clicking the map in marker mode places a marker and writes the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assertEquals(await harness.page.locator(PIN).count(), 0);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForSelector(PIN);
    assertEquals(await harness.page.locator(PIN).count(), 1);
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "markers.0.lat=");
    assertStringIncludes(query, "markers.0.lng=");
    // The toolbar's default category + colour are encoded with the new marker.
    assertStringIncludes(query, "markers.0.feature=place");
  });
});

Deno.test("a marker round-trips: opening its URL restores it", async () => {
  await withApp(async (harness) => {
    const query = "?view.center.lat=53.35&view.center.lng=-6.26&view.zoom=7&" +
      "markers.0.lat=53.35&markers.0.lng=-6.26&markers.0.feature=cafe&markers.0.color=red";
    await openApp(harness, query);
    await harness.page.waitForSelector(PIN);
    assertEquals(await harness.page.locator(PIN).count(), 1);
    // The URL is untouched on load (no spurious re-encode).
    assertStringIncludes(currentQuery(harness.page), "markers.0.feature=cafe");
  });
});

Deno.test("right-clicking a marker removes it from the map and the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const pin = harness.page.locator(PIN).first();
    await pin.waitFor();
    assertStringIncludes(currentQuery(harness.page), "markers.0.lat=");
    await pin.click({ button: "right" });
    await harness.page.waitForSelector(PIN, { state: "detached" });
    assertEquals(await harness.page.locator(PIN).count(), 0);
    assert(!currentQuery(harness.page).includes("markers."), "marker should be gone from the URL");
  });
});

Deno.test("clicking a marker opens the label editor; Enter commits the label", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const pin = harness.page.locator(PIN).first();
    await pin.waitFor();
    await pin.click();
    const input = harness.page.locator("[data-role='label-input']");
    await input.waitFor();
    await input.fill("Home");
    await input.press("Enter");
    await harness.page.waitForFunction(() => location.search.includes("markers.0.label=Home"));
    assertStringIncludes(currentQuery(harness.page), "markers.0.label=Home");
  });
});

Deno.test("the label editor's delete button removes the feature", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const pin = harness.page.locator(PIN).first();
    await pin.waitFor();
    await pin.click();
    await harness.page.locator("[data-role='label-delete']").click();
    await harness.page.waitForSelector(PIN, { state: "detached" });
    assert(!currentQuery(harness.page).includes("markers."), "marker should be gone from the URL");
  });
});

Deno.test("the text tool places an editable label; typing writes it to the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='text']").click();
    // The size palette appears in text mode; the category palette is hidden.
    await harness.page.waitForSelector("[data-palette='size']");
    assertEquals(await harness.page.locator("[data-palette='feature']").count(), 0);
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    const editable = harness.page.locator(TEXT_INPUT).first();
    await editable.waitFor();
    await editable.type("Cork");
    await editable.press("Enter");
    await harness.page.waitForFunction(() => location.search.includes("texts.0.text=Cork"));
    assertStringIncludes(currentQuery(harness.page), "texts.0.text=Cork");
  });
});

Deno.test("the toolbar minimises into the URL and survives a reload", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-action='minimise']").click();
    await harness.page.waitForFunction(() => location.search.includes("collapsed=true"));
    assertStringIncludes(currentQuery(harness.page), "collapsed=true");
    // Collapsed → only the restore button is shown, the palettes are gone.
    await harness.page.waitForSelector("[data-action='restore']");
    assertEquals(await harness.page.locator("[data-palette='tool']").count(), 0);
    // The minimised state is shareable: a reload restores it.
    await harness.page.reload();
    await harness.page.waitForSelector("[data-action='restore']");
    assertStringIncludes(currentQuery(harness.page), "collapsed=true");
  });
});

Deno.test("a locked map (editable=false) hides the toolbar and ignores edits", async () => {
  await withApp(async (harness) => {
    await openApp(harness, "?editable=false");
    assertEquals(await harness.page.locator(TOOLBAR).count(), 0);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForTimeout(200);
    assertEquals(await harness.page.locator(PIN).count(), 0);
    assert(!currentQuery(harness.page).includes("markers."), "locked map must not place markers");
  });
});

Deno.test("the category palette shows for markers and hides for line/polygon", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Marker is the default tool → category palette visible.
    assertEquals(await harness.page.locator("[data-palette='feature']").count(), 1);
    await harness.page.locator("[data-tool='line']").click();
    assertEquals(await harness.page.locator("[data-palette='feature']").count(), 0);
    await harness.page.locator("[data-tool='polygon']").click();
    assertEquals(await harness.page.locator("[data-palette='feature']").count(), 0);
    await harness.page.locator("[data-tool='marker']").click();
    assertEquals(await harness.page.locator("[data-palette='feature']").count(), 1);
  });
});

Deno.test("the clear button removes every feature from the map and the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Place two markers, waiting for each so the clicks aren't coalesced.
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForFunction(
      () => document.querySelectorAll("[data-feature='marker']").length === 1,
    );
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await harness.page.waitForFunction(
      () => document.querySelectorAll("[data-feature='marker']").length === 2,
    );
    assertStringIncludes(currentQuery(harness.page), "markers.1.lat=");
    await harness.page.locator("[data-action='clear']").click();
    await harness.page.waitForSelector(PIN, { state: "detached" });
    assertEquals(await harness.page.locator(PIN).count(), 0);
    assert(!currentQuery(harness.page).includes("markers."), "clear should empty the URL");
  });
});

Deno.test("drawing a line writes a polyline into the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='line']").click();
    // Geoman draw: click two vertices, then double-click to finish.
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.mouse.dblclick(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForFunction(() => location.search.includes("lines.0.points.0.lat="));
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "lines.0.points.0.lat=");
    assertStringIncludes(query, "lines.0.points.1.lat=");
  });
});
