// End-to-end test for numbered pin mode: with the toggle on, placed pins carry
// an auto-incrementing global count as their label, and deleting one renumbers
// the rest gap-free. Asserts on the decoded URL (the app's source of truth).
// Mirrors test/e2e/app_test.ts for placing/deleting markers.

import { assert, assertStringIncludes } from "@std/assert";
import {
  currentQuery,
  type Harness,
  launch,
  openApp,
  waitForParams,
} from "./helpers.ts";

// Three distinct viewport points clear of the toolbar and zoom control.
const P1 = { x: 700, y: 460 };
const P2 = { x: 520, y: 360 };
const P3 = { x: 860, y: 300 };

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

// Open the options panel, flip numbered mode on, then close the panel so the map
// accepts clicks again (the panel suppresses placement while it owns the toolbar).
async function enableNumbered(harness: Harness): Promise<void> {
  await harness.page.locator("[data-action='options']").click();
  await harness.page.locator("[data-action='numbered-toggle']").click();
  await harness.page.waitForSelector(
    "[data-action='numbered-toggle'][data-active='true']",
  );
  await harness.page.locator("[data-action='options']").click();
  await harness.page.waitForSelector("[data-palette='tool']");
}

// Click the map and wait for the marker count to reach `expected`.
async function placePin(
  harness: Harness,
  point: { x: number; y: number },
  expected: number,
) {
  await harness.page.mouse.click(point.x, point.y);
  await harness.page.waitForFunction(
    (count) => document.querySelectorAll("[data-feature='marker']").length === count,
    expected,
  );
}

Deno.test("numbered mode labels pins 1..N and renumbers gap-free on delete", async () => {
  await withApp(async (harness) => {
    await openApp(harness);
    await enableNumbered(harness);

    // Place three pins; each gets the next number as its label.
    await placePin(harness, P1, 1);
    await placePin(harness, P2, 2);
    await placePin(harness, P3, 3);
    await waitForParams(
      harness,
      (query) => query.includes("markers.2.label=3"),
    );
    const placed = currentQuery(harness.page);
    assertStringIncludes(placed, "markers.0.label=1");
    assertStringIncludes(placed, "markers.1.label=2");
    assertStringIncludes(placed, "markers.2.label=3");

    // Delete the 2nd pin (placed at P2). The icon tip sits at the latlng and the
    // icon body rises above it, so right-click a little above P2 to hit the icon
    // and fire its contextmenu remove handler.
    await harness.page.mouse.click(P2.x, P2.y - 18, { button: "right" });
    await harness.page.waitForFunction(
      () => document.querySelectorAll("[data-feature='marker']").length === 2,
    );
    await waitForParams(harness, (query) => !query.includes("markers.2."));
    const renumbered = currentQuery(harness.page);
    assertStringIncludes(renumbered, "markers.0.label=1");
    assertStringIncludes(renumbered, "markers.1.label=2");
    assert(
      !renumbered.includes("markers.2."),
      "no third marker should remain after delete",
    );
    assert(!renumbered.includes("label=3"), "the gap label 3 should be gone");
  });
});
