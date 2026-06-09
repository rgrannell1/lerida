// End-to-end tests driving the built app in a real browser. Each test asserts on
// the URL query string (the app's single source of truth) or the DOM — never on
// tile imagery — so the suite runs offline. Run via `bs/test:e2e.zsh`, which
// builds the bundle first; these tests load `web/dist/js/app.js` as-is.
//
// Elements are selected by stable data-* attributes (added in ts/components/),
// never by Font Awesome / Leaflet / AwesomeMarkers class names — those belong to
// third-party libraries and change without notice.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { currentQuery, type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// Selectors keyed off our own data-* attributes.
const PIN = "[data-feature='marker']";
const TEXT_INPUT = "[data-role='text-input']";
const TOOLBAR = "[data-role='toolbar']";

// A central-ish viewport point that clears the toolbar (top) and zoom control
// (bottom-left) — safe to click for placing a feature on the map.
const MAP_POINT = { x: 700, y: 460 };
const MAP_POINT_B = { x: 520, y: 360 };

// The midpoint of a line drawn between MAP_POINT_B and MAP_POINT — lands on the
// rendered polyline, so a click there hits the line itself.
const LINE_MID = {
  x: (MAP_POINT.x + MAP_POINT_B.x) / 2,
  y: (MAP_POINT.y + MAP_POINT_B.y) / 2,
};

// Run `body` against a fresh harness, always tearing it down afterwards.
async function withApp(body: (harness: Harness) => Promise<void>): Promise<void> {
  const harness = await launch();
  try {
    await body(harness);
  } finally {
    await harness.close();
  }
}

// Click the Leaflet zoom-in control (a Leaflet-owned control, so it has no
// data-* attribute of ours) and wait for the zoom to be written to the URL.
async function zoomIn(harness: Harness): Promise<void> {
  await harness.page.locator(".leaflet-control-zoom-in").click();
  await waitForParams(harness, (query) => query.includes("view.zoom="));
}

// Draw a two-vertex line and wait for it to reach the URL. The shape is finished
// with Escape (one deterministic _finishShape call) rather than a double-click,
// whose event timing can otherwise leave two overlapping line layers. Escape also
// returns the tool to marker, so callers can interact with the line immediately.
async function drawLine(harness: Harness): Promise<void> {
  await harness.page.locator("[data-tool='line']").click();
  await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
  await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
  await harness.page.keyboard.press("Escape");
  await waitForParams(harness, (query) => query.includes("lines.0.points.0.lat="));
  await harness.page.waitForSelector("[data-palette='feature']");
}

// Reveal the less-common tools (polygon) hidden behind the "…" overflow.
async function revealTools(harness: Harness): Promise<void> {
  await harness.page.locator("[data-action='more-tools']").click();
  await harness.page.waitForSelector("[data-tool='polygon']");
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
    // The common drawing tools (marker / line / text / eraser) show by default;
    // polygon hides behind the "…" overflow.
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
    await waitForParams(harness, (query) => query.includes("markers.0.label=Home"));
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
    await waitForParams(harness, (query) => query.includes("texts.0.text=Cork"));
    assertStringIncludes(currentQuery(harness.page), "texts.0.text=Cork");
  });
});

Deno.test("the toolbar minimises into the URL and survives a reload", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-action='minimise']").click();
    await waitForParams(harness, (query) => query.includes("collapsed=true"));
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
    await revealTools(harness);
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
    await waitForParams(harness, (query) => query.includes("lines.0.points.0.lat="));
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "lines.0.points.0.lat=");
    assertStringIncludes(query, "lines.0.points.1.lat=");
  });
});

Deno.test("zooming writes the view to the URL and a reload restores it", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assert(!currentQuery(harness.page).includes("view."), "no view in the URL initially");
    await zoomIn(harness);
    const zoomed = currentQuery(harness.page);
    // captureView writes the whole viewport — centre and zoom — on a zoom change.
    assertStringIncludes(zoomed, "view.zoom=8");
    assertStringIncludes(zoomed, "view.center.lat=");
    assertStringIncludes(zoomed, "view.center.lng=");
    // The viewport is shareable: a reload opens the map at the same zoom.
    await harness.page.reload();
    await harness.page.waitForSelector("#map.leaflet-container");
    assertStringIncludes(currentQuery(harness.page), "view.zoom=8");
  });
});

Deno.test("the toolbar's selected category and colour apply to a new marker", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-feature-id='cafe']").click();
    await harness.page.locator("[data-color='red']").click();
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForSelector(PIN);
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "markers.0.feature=cafe");
    assertStringIncludes(query, "markers.0.color=red");
  });
});

Deno.test("drawing a polygon (closing on the first vertex) writes it to the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await revealTools(harness);
    await harness.page.locator("[data-tool='polygon']").click();
    // Click three vertices, then click the first again to close the ring.
    const first = { x: 500, y: 350 };
    await harness.page.mouse.click(first.x, first.y);
    await harness.page.mouse.click(720, 360);
    await harness.page.mouse.click(620, 520);
    await harness.page.mouse.click(first.x, first.y);
    await waitForParams(harness, (query) => query.includes("polygons.0.points.0.lat="));
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "polygons.0.points.0.lat=");
    assertStringIncludes(query, "polygons.0.points.2.lat=");
  });
});

Deno.test("toggling directional arrows draws a line with arrows in the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // The arrows toggle only appears once the line tool is active.
    await harness.page.locator("[data-tool='line']").click();
    await harness.page.locator("[data-action='arrows']").click();
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.mouse.dblclick(MAP_POINT.x, MAP_POINT.y);
    await waitForParams(harness, (query) => query.includes("lines.0.arrows=true"));
    assertStringIncludes(currentQuery(harness.page), "lines.0.arrows=true");
  });
});

Deno.test("Escape commits an in-progress line and returns to the marker tool", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='line']").click();
    // Two vertices placed but not finished — Escape should commit them.
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.keyboard.press("Escape");
    await waitForParams(harness, (query) => query.includes("lines.0.points.0.lat="));
    assertStringIncludes(currentQuery(harness.page), "lines.0.points.0.lat=");
    // The tool falls back to marker — its category palette reappears.
    await harness.page.waitForSelector("[data-palette='feature']");
  });
});

Deno.test("clicking a vector feature edits it without dropping a marker on top", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await drawLine(harness);
    // drawLine leaves the marker tool active; clicking the line must edit it…
    await harness.page.mouse.click(LINE_MID.x, LINE_MID.y);
    // The line's editor opens…
    await harness.page.waitForSelector("[data-role='label-input']");
    // …and no stray marker was placed by the propagated map click.
    assertEquals(await harness.page.locator(PIN).count(), 0);
    assert(!currentQuery(harness.page).includes("markers."), "no marker should be added");
  });
});

Deno.test("a line can be labelled via the shared editor", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await drawLine(harness);
    await harness.page.mouse.click(LINE_MID.x, LINE_MID.y);
    const input = harness.page.locator("[data-role='label-input']");
    await input.waitFor();
    await input.fill("Route");
    await input.press("Enter");
    await waitForParams(harness, (query) => query.includes("lines.0.label=Route"));
    assertStringIncludes(currentQuery(harness.page), "lines.0.label=Route");
  });
});

Deno.test("right-clicking a line removes it from the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await drawLine(harness);
    await harness.page.mouse.click(LINE_MID.x, LINE_MID.y, { button: "right" });
    await waitForParams(harness, (query) => !query.includes("lines."));
    assert(!currentQuery(harness.page).includes("lines."), "line should be gone from the URL");
  });
});

Deno.test("a text label rendered with no text is discarded on blur", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='text']").click();
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    const editable = harness.page.locator(TEXT_INPUT).first();
    await editable.waitFor();
    // Commit immediately without typing — the empty label should not persist.
    await editable.press("Enter");
    await harness.page.waitForSelector(TEXT_INPUT, { state: "detached" });
    assert(!currentQuery(harness.page).includes("texts."), "empty text must be discarded");
  });
});

Deno.test("label markdown renders inline and is sanitised", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='text']").click();
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    const editable = harness.page.locator(TEXT_INPUT).first();
    await editable.waitFor();
    await editable.type(
      "**bold** [j](javascript:alert(1)) [s](https://example.com) <img src=x onerror=alert(1)>",
    );
    await editable.press("Enter");
    const html = await editable.evaluate((node) => node.innerHTML);
    // Bold renders; the javascript: link is stripped; the real link opens safely in
    // a new tab; the image (an XSS vector) is dropped entirely.
    assertStringIncludes(html, "<strong>bold</strong>");
    assert(!html.includes("javascript:"), `javascript: URL should be stripped: ${html}`);
    assertStringIncludes(html, 'href="https://example.com"');
    assertStringIncludes(html, 'rel="noopener noreferrer"');
    assertStringIncludes(html, 'target="_blank"');
    assert(!html.includes("<img"), `images must be stripped: ${html}`);
  });
});

Deno.test("a locked map still pans/zooms and keeps the editable flag", async () => {
  await withApp(async (harness) => {
    await openApp(harness, "?editable=false");
    await zoomIn(harness);
    const query = currentQuery(harness.page);
    assertStringIncludes(query, "view.zoom=8");
    // The lock survives the viewport change so the URL stays read-only.
    assertStringIncludes(query, "editable=false");
  });
});

Deno.test("a locked map renders labels read-only with clickable links", async () => {
  await withApp(async (harness) => {
    const text = encodeURIComponent("[site](https://example.com)");
    await openApp(
      harness,
      `?texts.0.lat=53.3&texts.0.lng=-6.2&texts.0.text=${text}&editable=false`,
    );
    const editable = harness.page.locator(TEXT_INPUT).first();
    await editable.waitFor();
    // The label is not editable, but its sanitised link is present and clickable.
    assertEquals(await editable.evaluate((node) => (node as HTMLElement).isContentEditable), false);
    const href = await editable.locator("a").getAttribute("href");
    assertEquals(href, "https://example.com");
  });
});

Deno.test("the restore button re-expands a collapsed toolbar", async () => {
  await withApp(async (harness) => {
    await openApp(harness, "?collapsed=true");
    await harness.page.waitForSelector("[data-action='restore']");
    assertEquals(await harness.page.locator("[data-palette='tool']").count(), 0);
    await harness.page.locator("[data-action='restore']").click();
    // Expanded again: the tool palette returns and the URL drops the flag.
    await harness.page.waitForSelector("[data-palette='tool']");
    await waitForParams(harness, (query) => !query.includes("collapsed"));
    assert(!currentQuery(harness.page).includes("collapsed"), "collapsed flag should be cleared");
  });
});

Deno.test("the eraser tool removes a feature on click", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Place a marker, then switch to the eraser and click it away.
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await waitForParams(harness, (query) => query.includes("markers.0."));
    await harness.page.locator("[data-tool='eraser']").click();
    await harness.page.locator(PIN).click();
    await waitForParams(harness, (query) => !query.includes("markers.0."));
    assert(!currentQuery(harness.page).includes("markers"), "the marker should be erased");
  });
});

Deno.test("the … toggle reveals the less-common categories", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // A common category shows by default; an uncommon one is hidden until expanded.
    await harness.page.waitForSelector("[data-feature-id='cafe']");
    assertEquals(await harness.page.locator("[data-feature-id='airport']").count(), 0);
    await harness.page.locator("[data-action='more-features']").click();
    await harness.page.waitForSelector("[data-feature-id='airport']");
    assertEquals(await harness.page.locator("[data-feature-id='airport']").count(), 1);
  });
});

Deno.test("the category palette has a fashion category and no parking one", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-action='more-features']").click();
    await harness.page.waitForSelector("[data-feature-id='fashion']");
    assertEquals(await harness.page.locator("[data-feature-id='fashion']").count(), 1);
    assertEquals(await harness.page.locator("[data-feature-id='parking']").count(), 0);
  });
});

Deno.test("the toolbar can be dragged and resets to its default spot on reload", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    const toolbar = harness.page.locator(TOOLBAR);
    const before = (await toolbar.boundingBox())!;
    // Grab the header in its empty middle (clear of the title / action buttons).
    const header = (await harness.page.locator(".toolbar-header").boundingBox())!;
    const grabX = header.x + header.width / 2;
    const grabY = header.y + header.height / 2;
    await harness.page.mouse.move(grabX, grabY);
    await harness.page.mouse.down();
    await harness.page.mouse.move(grabX - 150, grabY + 120, { steps: 8 });
    await harness.page.mouse.up();
    const after = (await toolbar.boundingBox())!;
    assert(Math.abs(after.x - before.x) > 50, "toolbar should have moved horizontally");
    assert(after.y - before.y > 50, "toolbar should have moved down");
    // The position is ephemeral — a reload returns it to the default spot.
    await harness.page.reload();
    await harness.page.waitForSelector(TOOLBAR);
    const reloaded = (await toolbar.boundingBox())!;
    assert(Math.abs(reloaded.x - before.x) < 5, "toolbar x should reset on reload");
    assert(Math.abs(reloaded.y - before.y) < 5, "toolbar y should reset on reload");
  });
});

Deno.test("the meta.title setting sets the page title", async () => {
  await withApp(async (harness) => {
    await openApp(harness, "?meta.title=My%20Trip");
    assertEquals(await harness.page.title(), "My Trip");
  });
});

Deno.test("the size palette resizes the focused text label", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='text']").click();
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const editable = harness.page.locator(TEXT_INPUT).first();
    await editable.waitFor();
    await editable.type("hi");
    // The label is still focused; picking a size resizes it in place.
    await harness.page.locator("[data-size='xlarge']").click();
    await waitForParams(harness, (query) => query.includes("texts.0.size=xlarge"));
    assertStringIncludes(currentQuery(harness.page), "texts.0.size=xlarge");
  });
});

Deno.test("resizing a not-yet-typed label does not write an empty label to the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='text']").click();
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.locator(TEXT_INPUT).first().waitFor();
    // Pick a size before typing anything — the empty label must not reach the URL.
    await harness.page.locator("[data-size='large']").click();
    await harness.page.waitForTimeout(150);
    assert(!currentQuery(harness.page).includes("texts."), "empty label must not be encoded");
  });
});

Deno.test("the toolbar shows the lerida brand title", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assertEquals(await harness.page.locator(".toolbar-title").textContent(), "lerida");
  });
});

Deno.test("the … toggle reveals the less-common tools", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Polygon is hidden until the overflow is expanded.
    assertEquals(await harness.page.locator("[data-tool='polygon']").count(), 0);
    await revealTools(harness);
    assertEquals(await harness.page.locator("[data-tool='polygon']").count(), 1);
  });
});

Deno.test("a draw hint shows while drawing a line and clears when the tool changes", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assertEquals(await harness.page.locator("[data-role='draw-hint']").count(), 0);
    await harness.page.locator("[data-tool='line']").click();
    await harness.page.waitForSelector("[data-role='draw-hint']");
    await harness.page.locator("[data-tool='marker']").click();
    await harness.page.waitForFunction(() => !document.querySelector("[data-role='draw-hint']"));
    assertEquals(await harness.page.locator("[data-role='draw-hint']").count(), 0);
  });
});

Deno.test("the line-width palette sets the stroke width of a new line", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-tool='line']").click();
    // Pick the thick (8px) width, then draw a two-vertex line.
    await harness.page.locator("[data-width='8']").click();
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.keyboard.press("Escape");
    await waitForParams(harness, (query) => query.includes("lines.0.width=8"));
    assertStringIncludes(currentQuery(harness.page), "lines.0.width=8");
  });
});

Deno.test("clicking the brand title opens the about view, and it closes again", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assertEquals(await harness.page.locator("[data-role='about']").count(), 0);
    await harness.page.locator("[data-action='about']").click();
    await harness.page.waitForSelector("[data-role='about']");
    assertStringIncludes(
      (await harness.page.locator("[data-role='about']").textContent()) ?? "",
      "Make your own maps.",
    );
    // The brand title links out to the namesake Wikipedia article.
    assertStringIncludes(
      (await harness.page.locator(".about-title a").getAttribute("href")) ?? "",
      "en.wikipedia.org/wiki/On_Exactitude_in_Science",
    );
    // The close button dismisses it.
    await harness.page.locator("[data-action='about-close']").click();
    await harness.page.waitForFunction(() => !document.querySelector("[data-role='about']"));
    assertEquals(await harness.page.locator("[data-role='about']").count(), 0);
  });
});

Deno.test("the eraser tool puts the map into eraser-cursor mode", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    assertEquals(await harness.page.locator("#map.eraser-mode").count(), 0);
    await harness.page.locator("[data-tool='eraser']").click();
    await harness.page.waitForSelector("#map.eraser-mode");
    // Switching to another tool clears the eraser cursor.
    await harness.page.locator("[data-tool='marker']").click();
    await harness.page.waitForFunction(() => !document.querySelector("#map.eraser-mode"));
    assertEquals(await harness.page.locator("#map.eraser-mode").count(), 0);
  });
});

Deno.test("editing a placed marker recolours it via the toolbar", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Place a marker (the default colour is blue), then click it to edit.
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForSelector(PIN);
    await waitForParams(harness, (query) => query.includes("markers.0.color=blue"));
    await harness.page.locator(PIN).click();
    // The toolbar switches to editing-the-marker mode and exposes the palettes.
    await harness.page.waitForSelector("[data-role='editing'][data-editing='marker']");
    await harness.page.locator("[data-color='red']").click();
    await waitForParams(harness, (query) => query.includes("markers.0.color=red"));
    assertStringIncludes(currentQuery(harness.page), "markers.0.color=red");
  });
});

Deno.test("editing a placed line changes its width via the toolbar", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await drawLine(harness);
    // Click the line to select it; the width palette then targets it.
    await harness.page.mouse.click(LINE_MID.x, LINE_MID.y);
    await harness.page.waitForSelector("[data-role='editing'][data-editing='line']");
    await harness.page.locator("[data-width='8']").click();
    await waitForParams(harness, (query) => query.includes("lines.0.width=8"));
    assertStringIncludes(currentQuery(harness.page), "lines.0.width=8");
  });
});

Deno.test("the search box filters markers by label and jumps to a pick", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Place a marker and label it "Home".
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const pin = harness.page.locator(PIN).first();
    await pin.waitFor();
    await pin.click();
    const labelInput = harness.page.locator("[data-role='label-input']");
    await labelInput.waitFor();
    await labelInput.fill("Home");
    await labelInput.press("Enter");
    await waitForParams(harness, (query) => query.includes("markers.0.label=Home"));
    // Searching its label surfaces exactly one result naming it.
    const search = harness.page.locator("[data-role='search-input']");
    await search.fill("home");
    const result = harness.page.locator("[data-search-result]");
    await result.first().waitFor();
    assertEquals(await result.count(), 1);
    assertStringIncludes((await result.first().textContent()) ?? "", "Home");
    // Picking it clears the box (and pans the map via setView).
    await result.first().click();
    await harness.page.waitForFunction(() => {
      const box = document.querySelector("[data-role='search-input']") as HTMLInputElement | null;
      return !!box && box.value === "";
    });
    // A query that matches nothing shows no results dropdown.
    await search.fill("nowhere-xyz");
    assertEquals(await harness.page.locator("[data-role='search-results']").count(), 0);
  });
});

Deno.test("the search box shows on a locked map (navigation, not editing)", async () => {
  await withApp(async (harness) => {
    await openApp(harness, "?editable=false");
    assertEquals(await harness.page.locator(TOOLBAR).count(), 0);
    assertEquals(await harness.page.locator("[data-role='search']").count(), 1);
  });
});

Deno.test("search supports category:* syntax and the × button clears it", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // A café marker, then a default "place" marker elsewhere.
    await harness.page.locator("[data-feature-id='cafe']").click();
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    await harness.page.waitForSelector(PIN);
    await waitForParams(harness, (query) => query.includes("markers.0.feature=cafe"));
    await harness.page.locator("[data-feature-id='place']").click();
    await harness.page.mouse.click(MAP_POINT_B.x, MAP_POINT_B.y);
    await waitForParams(harness, (query) => query.includes("markers.1."));
    // "cafe:*" matches every café and nothing else.
    const search = harness.page.locator("[data-role='search-input']");
    await search.fill("cafe:*");
    const results = harness.page.locator("[data-search-result]");
    await results.first().waitFor();
    assertEquals(await results.count(), 1);
    // The × button clears the query and closes the dropdown.
    await harness.page.locator("[data-action='search-clear']").click();
    assertEquals(await search.inputValue(), "");
    assertEquals(await harness.page.locator("[data-role='search-results']").count(), 0);
  });
});

Deno.test("arrow keys move the search highlight and Enter jumps to it", async () => {
  await withApp(async (harness) => {
    // Seed two markers (labels both fuzzy-match "ca") directly via the URL, so the
    // test is deterministic and doesn't depend on the slower click-and-label flow.
    await openApp(
      harness,
      "?markers.0.lat=53.35&markers.0.lng=-6.26&markers.0.label=Cafe" +
        "&markers.1.lat=53.34&markers.1.lng=-6.25&markers.1.label=Camden",
    );
    const search = harness.page.locator("[data-role='search-input']");
    await search.fill("ca");
    const results = harness.page.locator("[data-search-result]");
    await results.first().waitFor();
    assertEquals(await results.count(), 2);
    // ArrowDown highlights the first result, again the second.
    await search.press("ArrowDown");
    assertEquals(await harness.page.locator("[data-search-result].active").count(), 1);
    assertEquals(
      await harness.page.locator("[data-search-result='0'].active").count(),
      1,
    );
    await search.press("ArrowDown");
    assertEquals(
      await harness.page.locator("[data-search-result='1'].active").count(),
      1,
    );
    // Enter on the highlighted result jumps to it and clears the box.
    await search.press("Enter");
    await harness.page.waitForFunction(() => {
      const box = document.querySelector("[data-role='search-input']") as HTMLInputElement | null;
      return !!box && box.value === "";
    });
  });
});

Deno.test("the options panel sets the page title into the URL and document", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // The cog opens the options panel in place of the drawing tools.
    assertEquals(await harness.page.locator("[data-palette='tool']").count(), 1);
    await harness.page.locator("[data-action='options']").click();
    await harness.page.waitForSelector("[data-role='options']");
    assertEquals(await harness.page.locator("[data-palette='tool']").count(), 0);
    // Typing a title updates the document title and the URL.
    await harness.page.locator("[data-role='title-input']").fill("Holiday");
    await waitForParams(harness, (query) => query.includes("meta.title=Holiday"));
    assertEquals(await harness.page.title(), "Holiday");
    // While options is open, clicking the map places nothing.
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    assertEquals(await harness.page.locator(PIN).count(), 0);
    // Closing the panel restores the tool palette.
    await harness.page.locator("[data-action='options']").click();
    await harness.page.waitForSelector("[data-palette='tool']");
  });
});

Deno.test("the options lock confirms, then hides the toolbar and locks the URL", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await harness.page.locator("[data-action='options']").click();
    await harness.page.waitForSelector("[data-role='options']");
    // Lock is a two-step confirm; Cancel backs out without locking.
    await harness.page.locator("[data-action='lock']").click();
    await harness.page.waitForSelector("[data-action='lock-confirm']");
    await harness.page.locator("[data-action='lock-cancel']").click();
    await harness.page.waitForSelector("[data-action='lock']");
    assertEquals(await harness.page.locator(TOOLBAR).count(), 1);
    // Confirming locks: the toolbar disappears and editable=false enters the URL.
    await harness.page.locator("[data-action='lock']").click();
    await harness.page.locator("[data-action='lock-confirm']").click();
    await harness.page.waitForSelector(TOOLBAR, { state: "detached" });
    await waitForParams(harness, (query) => query.includes("editable=false"));
    // The search box (navigation, not editing) still shows on the locked map.
    assertEquals(await harness.page.locator("[data-role='search']").count(), 1);
  });
});

Deno.test("locking makes an already-edited pin read-only (no editor on click)", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    // Place and label a marker — labelling binds its editor popup to the layer.
    await harness.page.mouse.click(MAP_POINT.x, MAP_POINT.y);
    const pin = harness.page.locator(PIN).first();
    await pin.waitFor();
    await pin.click();
    const label = harness.page.locator("[data-role='label-input']");
    await label.waitFor();
    await label.fill("Home");
    await label.press("Enter");
    await waitForParams(harness, (query) => query.includes("markers.0.label=Home"));
    // Lock via the options panel. dispatchEvent fires the DOM click directly:
    // after a Leaflet popup auto-pan, Playwright's actionable-click path stalls
    // for seconds on this sequence even though the buttons are present and live
    // (verified: a raw DOM click opens the panel in ~16ms).
    await harness.page.locator("[data-action='options']").dispatchEvent("click");
    await harness.page.locator("[data-action='lock']").dispatchEvent("click");
    await harness.page.locator("[data-action='lock-confirm']").dispatchEvent("click");
    await harness.page.waitForSelector(TOOLBAR, { state: "detached" });
    // Clicking the re-rendered pin no longer opens the label editor.
    await harness.page.locator(PIN).first().dispatchEvent("click");
    await harness.page.waitForTimeout(300);
    assertEquals(await harness.page.locator("[data-role='label-input']").count(), 0);
  });
});

Deno.test("OSM place search shows results and jumps to a picked place", async () => {
  await withApp(async (harness) => {
    // Fixture for the geocoder; this page.route wins over the harness default.
    // Capture the request URL to confirm the bounds constraint is sent.
    let requested = "";
    await harness.page.route(/nominatim\.openstreetmap\.org/, (route) => {
      requested = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          display_name: "Lleida, Catalunya, España",
          lat: "41.6147",
          lon: "0.6267",
          boundingbox: ["41.51", "41.71", "0.52", "0.72"],
        }]),
      });
    });
    await openApp(harness);
    const search = harness.page.locator("[data-role='search-input']");
    await search.fill("lleida");
    // No local markers match, so only the debounced OSM place appears.
    const place = harness.page.locator("[data-place-result]");
    await place.first().waitFor();
    assertEquals(await place.count(), 1);
    assertStringIncludes((await place.first().textContent()) ?? "", "Lleida");
    // The lookup is constrained to the current map bounds.
    assertStringIncludes(requested, "viewbox=");
    assertStringIncludes(requested, "bounded=1");
    // Picking it fits the viewport there, writing the view to the URL, and clears.
    await place.first().click();
    await waitForParams(harness, (query) => query.includes("view.center.lat="));
    assertEquals(await search.inputValue(), "");
  });
});
