// End-to-end test for the measure tool (TASK-3): it draws a normal line tagged
// with `measure`, and shows permanent per-segment lengths plus a total on the
// map. Asserts on the decoded URL (the source of truth) and the rendered labels.
// Mirrors the line-drawing pattern in test/e2e/app_test.ts.

import { assert, assertStringIncludes } from "@std/assert";
import { type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// Two distinct viewport points clear of the toolbar (top) and zoom control.
const A = { x: 520, y: 360 };
const B = { x: 760, y: 470 };

Deno.test("measure tool draws a measured line with permanent distance labels", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;

    await page.locator("[data-tool='measure']").click();
    await page.mouse.click(A.x, A.y);
    await page.mouse.click(B.x, B.y);
    await page.keyboard.press("Escape");

    // The committed line is a normal line tagged measure, saved in the URL.
    await waitForParams(
      harness,
      (query) => query.includes("lines.0.measure=true"),
    );

    // Permanent labels: at least one segment length and a total, shown on the map.
    await page.waitForSelector(".measure-total");
    assert(
      (await page.locator(".measure-label").count()) >= 1,
      "has a segment label",
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
