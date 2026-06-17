// End-to-end test for the share panel (TASK-2): the toolbar's share section
// builds the render.png image link for the current map and copies it to the
// clipboard. Runs against the built app in a real Chromium. Run via bs/test:e2e.zsh.

import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { type Harness, launch, openApp, waitForParams } from "./helpers.ts";

// A central-ish point clear of the toolbar (top) and zoom control (bottom-left).
const MAP_POINT = { x: 700, y: 460 };

Deno.test("share panel builds and copies the render.png link", async () => {
  const harness: Harness = await launch();
  // localhost is a secure context, so navigator.clipboard works; grant access.
  await harness.context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    {
      origin: harness.server.url,
    },
  );
  try {
    await openApp(harness);
    const page = harness.page;

    // Place a marker so the map has state to render.
    await page.locator("#map").click({ position: MAP_POINT });
    await waitForParams(harness, (params) => params.includes("markers"));

    // Open the share panel from the toolbar header.
    await page.locator("[data-action='share']").click();
    await page.waitForSelector("[data-role='share']");

    // The link targets the render endpoint with the current state and chosen size.
    const url = await page.locator("[data-role='render-url']").inputValue();
    assertStringIncludes(url, "/render.png?c=");
    assertStringIncludes(url, "w=1200");
    assertStringIncludes(url, "h=630");
    assertStringIncludes(url, "dpr=2");

    // Copy it, and confirm the clipboard holds exactly that link. Poll rather
    // than wait on the transient "Copied" label (it only shows for ~1.5s).
    await page.locator("[data-action='copy-render-url']").click();
    let clipboard = "";
    for (let attempt = 0; attempt < 40 && clipboard !== url; attempt++) {
      clipboard = await page.evaluate(() => navigator.clipboard.readText());
      if (clipboard !== url) {
        await page.waitForTimeout(50);
      }
    }
    assertEquals(clipboard, url);
    assert(clipboard.startsWith(`${harness.server.url}/render.png?c=`));
  } finally {
    await harness.close();
  }
});

Deno.test("share size selector changes the link dimensions", async () => {
  const harness: Harness = await launch();
  try {
    await openApp(harness);
    const page = harness.page;
    await page.locator("#map").click({ position: MAP_POINT });
    await waitForParams(harness, (params) => params.includes("markers"));

    await page.locator("[data-action='share']").click();
    await page.locator("[data-role='share-size']").selectOption("square");

    const url = await page.locator("[data-role='render-url']").inputValue();
    assertStringIncludes(url, "w=1080");
    assertStringIncludes(url, "h=1080");
  } finally {
    await harness.close();
  }
});
