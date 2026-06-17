// Visual check of the image-render pipeline: runs the real render-core path
// (functions/render-core.ts) against a local Chromium with live OSM tiles and
// writes /tmp/render-check.png to eyeball. The automated, offline assertions live
// in test/e2e/render_test.ts; this is just for looking at a real result.
//
// Run: deno run -A bs/render-check.ts

import { chromium, type Page } from "playwright";
import { findChromium } from "../test/e2e/helpers.ts";
import {
  parseRenderParams,
  type RenderPage,
  renderPng,
} from "../functions/render-core.ts";
import type { AssetReader } from "../functions/assemble.ts";
import { encodeUrl } from "../ts/url.ts";

const WEB_ROOT = new URL("../web", import.meta.url).pathname;
const readAsset: AssetReader = async (path) =>
  await Deno.readFile(`${WEB_ROOT}/${path}`);

function playwrightRenderPage(page: Page): RenderPage {
  return {
    setViewport: async (width, height) => {
      await page.setViewportSize({ width, height });
    },
    goto: async (dataUrl) => {
      await page.goto(dataUrl, { waitUntil: "domcontentloaded" });
    },
    waitForReady: async (timeoutMs) => {
      await page.waitForFunction("window.__leridaReady === true", undefined, {
        timeout: timeoutMs,
      });
    },
    screenshot: async () =>
      await page.screenshot({ path: "/tmp/render-check.png" }),
  };
}

const sample = {
  view: { center: { lat: 53.3498, lng: -6.2603 }, zoom: 13 },
  markers: [
    {
      lat: 53.3498,
      lng: -6.2603,
      feature: "restaurant",
      color: "red",
      label: "City centre",
    },
    {
      lat: 53.3438,
      lng: -6.2546,
      feature: "info",
      color: "blue",
      label: "St Stephen's Green",
    },
  ],
  lines: [{
    points: [{ lat: 53.3498, lng: -6.2603 }, { lat: 53.3438, lng: -6.2546 }],
    color: "green",
    arrows: true,
  }],
};

const compressedState = encodeUrl(
  sample as unknown as Parameters<typeof encodeUrl>[0],
).replace(/^c=/, "");
const params = parseRenderParams(
  new URLSearchParams(`c=${compressedState}&w=1200&h=630&dpr=2`),
);
if (!params.ok) {
  throw new Error(params.error);
}

const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(25_000);

try {
  await renderPng(playwrightRenderPage(page), readAsset, params.value);
  console.log(
    "markers:",
    await page.locator("[data-feature='marker']").count(),
  );
  console.log("toolbar:", await page.locator("[data-role='toolbar']").count());
  console.log("screenshot: /tmp/render-check.png");
} finally {
  await context.close();
  await browser.close();
}
