// End-to-end test for TASK-7: per-marker hover-only labels. A marker placed with
// the marker tool's hover-label toggle on shows its label only on hover (Leaflet
// permanent:false, so no tooltip sits in the DOM until the pin is hovered); a
// normal marker keeps the always-visible permanent tooltip. Numbered mode supplies
// deterministic labels ("1", "2") so the tooltips have content without any typing.
// Asserts on the rendered tooltips and the decoded URL (the source of truth), and
// that the flag survives a reload. Mirrors test/e2e/numbered_test.ts.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  currentQuery,
  type Harness,
  launch,
  openApp,
  waitForParams,
} from "./helpers.ts";

const MARKER = "[data-feature='marker']";

// Two viewport points clear of the toolbar (top-left) and the zoom control, plus
// a neutral resting spot clear of every pin so nothing is hovered.
const HOVER_POINT = { x: 700, y: 460 };
const PERMANENT_POINT = { x: 520, y: 360 };
const NEUTRAL_POINT = { x: 1050, y: 650 };

// Wait until exactly `expected` permanent tooltips sit in the DOM. A hover tooltip
// closes asynchronously on mouseout, so poll rather than read once.
function waitForTooltipCount(
  harness: Harness,
  expected: number,
): Promise<unknown> {
  return harness.page.waitForFunction(
    (count) => document.querySelectorAll(".leaflet-tooltip").length === count,
    expected,
  );
}

async function withApp(
  body: (harness: Harness) => Promise<void>,
): Promise<void> {
  const harness = await launch();
  try {
    await body(harness);
  } finally {
    await harness.close();
  }
}

// Turn numbered mode on (via the options panel) so placed pins get "1".."N" labels
// with no manual typing, then close the panel so the map accepts clicks again.
async function enableNumbered(harness: Harness): Promise<void> {
  await harness.page.locator("[data-action='options']").click();
  await harness.page.locator("[data-action='numbered-toggle']").click();
  await harness.page.waitForSelector(
    "[data-action='numbered-toggle'][data-active='true']",
  );
  await harness.page.locator("[data-action='options']").click();
  await harness.page.waitForSelector("[data-palette='tool']");
}

// Flip the marker tool's hover-label toggle so its selected state matches `on`.
async function setHoverLabel(harness: Harness, on: boolean): Promise<void> {
  const button = harness.page.locator("[data-action='hover-label']");
  const selected = await button.evaluate((node) =>
    node.classList.contains("selected")
  );
  if (selected !== on) {
    await button.click();
  }
  await harness.page.waitForFunction((want) => {
    const element = document.querySelector("[data-action='hover-label']");
    return !!element && element.classList.contains("selected") === want;
  }, on);
}

// Click the map and wait for the rendered marker count to reach `expected`.
async function placePin(
  harness: Harness,
  point: { x: number; y: number },
  expected: number,
): Promise<void> {
  await harness.page.mouse.click(point.x, point.y);
  await harness.page.waitForFunction(
    (args) =>
      document.querySelectorAll(args.selector).length === args.expected,
    { selector: MARKER, expected },
  );
}

// The trimmed text of every permanent tooltip currently in the DOM. A hover-only
// marker contributes nothing here until it is actually hovered.
function tooltipTexts(harness: Harness): Promise<string[]> {
  return harness.page.evaluate(() =>
    Array.from(document.querySelectorAll(".leaflet-tooltip")).map((element) =>
      (element.textContent ?? "").trim()
    )
  );
}

// Wait for the reloaded map to be live and its markers re-rendered from the URL.
async function waitForReload(harness: Harness, markerCount: number) {
  await harness.page.waitForSelector("#map.leaflet-container");
  await harness.page.waitForFunction(() => {
    const map = document.querySelector("#map");
    return !!map && map.clientWidth > 0 &&
      map.querySelector(".leaflet-tile-pane") !== null;
  });
  await harness.page.waitForFunction(
    (args) => document.querySelectorAll(args.selector).length === args.count,
    { selector: MARKER, count: markerCount },
  );
}

Deno.test("hover-only markers hide their label until hover; normal markers keep it", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await enableNumbered(harness);

    // Marker 0 is hover-only. The pin is placed under the cursor, so Leaflet opens
    // its non-permanent tooltip on that hover; moving the mouse off the pin must
    // make the label vanish, proving it is hover-gated rather than permanent.
    await setHoverLabel(harness, true);
    await placePin(harness, HOVER_POINT, 1);
    await harness.page.mouse.move(NEUTRAL_POINT.x, NEUTRAL_POINT.y);
    await waitForTooltipCount(harness, 0);
    assertEquals(
      await tooltipTexts(harness),
      [],
      "a hover-only marker shows no label once the mouse leaves it",
    );

    // Marker 1 is normal: its label ("2") is a permanent tooltip that stays put
    // after the mouse leaves, while the hover-only marker's label stays hidden.
    await setHoverLabel(harness, false);
    await placePin(harness, PERMANENT_POINT, 2);
    await harness.page.mouse.move(NEUTRAL_POINT.x, NEUTRAL_POINT.y);
    await waitForTooltipCount(harness, 1);
    assertEquals(
      await tooltipTexts(harness),
      ["2"],
      "only the normal marker shows a permanent tooltip",
    );

    // The flag rides in the URL on the hover-only marker only.
    await waitForParams(
      harness,
      (query) => query.includes("markers.0.hoverLabel=true"),
    );
    const placed = currentQuery(harness.page);
    assertStringIncludes(placed, "markers.0.label=1");
    assertStringIncludes(placed, "markers.1.label=2");
    assert(
      !placed.includes("markers.1.hoverLabel"),
      "the normal marker carries no hoverLabel flag",
    );

    // Reload from the URL: the flag survives, so the hover-only marker still hides
    // its label (only the normal marker's tooltip is permanent).
    await harness.page.reload();
    await waitForReload(harness, 2);
    await waitForTooltipCount(harness, 1);
    assertEquals(
      await tooltipTexts(harness),
      ["2"],
      "after reload only the normal marker's tooltip is permanent",
    );
    assertStringIncludes(
      currentQuery(harness.page),
      "markers.0.hoverLabel=true",
      "the hoverLabel flag survives the reload",
    );

    // Hovering the hover-only marker reveals its label ("1") on demand.
    await harness.page.locator(MARKER).first().hover();
    await harness.page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".leaflet-tooltip")).some(
        (element) => (element.textContent ?? "").trim() === "1"
      )
    );
  });
});
