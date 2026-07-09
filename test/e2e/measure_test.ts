// End-to-end test for the measure tool (TASK-3, revised): measure is now a toggle
// within the line tool, not a tool of its own. A measured line is a normal line
// tagged `measure`, showing permanent per-segment lengths; the total only appears
// once there is more than one segment. Asserts on the decoded URL (source of
// truth) and the rendered labels. Mirrors the line-drawing pattern in app_test.ts.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// Distinct viewport points clear of the toolbar (top) and zoom control.
const POINT_A = { x: 520, y: 360 };
const POINT_B = { x: 760, y: 470 };
const POINT_C = { x: 560, y: 540 };

// Select the line tool and turn the measure toggle on.
async function startMeasuredLine(harness: Harness): Promise<void> {
  await harness.page.locator("[data-tool='line']").click();
  await harness.page.locator("[data-action='measure']").click();
}

Deno.test("measure toggle draws a measured line with per-segment labels and a total", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;

    await startMeasuredLine(harness);
    // Two segments: POINT_A->POINT_B->POINT_C.
    await page.mouse.click(POINT_A.x, POINT_A.y);
    await page.mouse.click(POINT_B.x, POINT_B.y);
    await page.mouse.click(POINT_C.x, POINT_C.y);
    await page.keyboard.press("Escape");

    // The committed line is a normal line tagged measure, saved in the URL.
    await waitForParams(
      harness,
      (query) => query.includes("lines.0.measure=true"),
    );

    // Two segments -> two segment labels and a total, shown on the map.
    await page.waitForSelector(".measure-total");
    assertEquals(
      await page.locator(".measure-label").count(),
      2,
      "one label per segment",
    );
    const total = await page.locator(".measure-total").innerText();
    assertStringIncludes(total, "Total");
    assert(
      /\d+(\.\d+)?\s*(m|km)/.test(total),
      `total carries a distance: ${total}`,
    );
  } finally {
    await harness.close();
  }
});

Deno.test("a single-segment measured line shows its length but no total", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;

    await startMeasuredLine(harness);
    // One segment: POINT_A->POINT_B.
    await page.mouse.click(POINT_A.x, POINT_A.y);
    await page.mouse.click(POINT_B.x, POINT_B.y);
    await page.keyboard.press("Escape");

    await waitForParams(
      harness,
      (query) => query.includes("lines.0.measure=true"),
    );

    // The one segment's length renders, but no total (it would just repeat it).
    await page.waitForSelector(".measure-label");
    assertEquals(
      await page.locator(".measure-label").count(),
      1,
      "one segment, one label",
    );
    assertEquals(
      await page.locator(".measure-total").count(),
      0,
      "no total for a single segment",
    );
  } finally {
    await harness.close();
  }
});
