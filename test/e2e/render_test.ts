// Integration tests for the image-render worker (functions/render-core.ts).
//
// The Cloudflare Pages Function (render.png.ts) is a thin adapter over this core;
// the only parts it adds are the three Cloudflare bindings (caches.default,
// env.ASSETS, the MYBROWSER connection), which can't run off-platform. Everything
// that decides whether a render is *correct* lives in render-core and is exercised
// here against a real Chromium:
//   - parseRenderParams: the 422 / accept logic.
//   - renderPng: assemble -> data URL -> goto -> wait __leridaReady -> screenshot,
//     asserting the bytes are a PNG of the right pixel size with a bare map (no
//     toolbar/search) and the requested markers drawn.
//
// Tiles are stubbed with a 1x1 PNG so the run is offline and deterministic (the
// real-tile visual check is bs/render-check.ts). Run via bs/test:e2e.zsh.

import { assert, assertEquals } from "@std/assert";
import { chromium, type Page } from "playwright";
import { Buffer } from "node:buffer";
import { findChromium } from "./helpers.ts";
import {
  parseRenderParams,
  type RenderPage,
  renderPng,
} from "../../functions/render-core.ts";
import type { AssetReader } from "../../functions/assemble.ts";
import { encodeUrl } from "../../ts/url.ts";

const WEB_ROOT = new URL("../../web", import.meta.url).pathname;

// Read a built asset from web/ (what env.ASSETS does on Cloudflare).
const readAsset: AssetReader = async (path) =>
  await Deno.readFile(`${WEB_ROOT}/${path}`);

// A 1x1 transparent PNG to satisfy Leaflet's tile <img> loads offline. Must be a
// node Buffer: a Uint8Array body is not sent as binary by route.fulfill, so the
// image fails to decode and the tile-load (hence __leridaReady) never fires.
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// A sample map round-tripped through the app's real encoder, so the test drives
// the genuine decode path.
function sampleState(): string {
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
        label: "Green",
      },
    ],
  };
  return encodeUrl(sample as unknown as Parameters<typeof encodeUrl>[0])
    .replace(/^c=/, "");
}

// Read a PNG's pixel dimensions from its IHDR chunk.
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function isPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return signature.every((value, index) => bytes[index] === value);
}

// A JPEG starts with the SOI marker FF D8 FF and ends with the EOI marker FF D9.
function isJpeg(bytes: Uint8Array): boolean {
  const start = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const end = bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  return start && end;
}

// Adapt a Playwright page to the worker's RenderPage. deviceScaleFactor is fixed
// at context creation in Playwright, so setViewport only sizes the page here.
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
    screenshot: async (options) =>
      await page.screenshot(
        options.format === "jpeg"
          ? { type: "jpeg", quality: options.quality }
          : { type: "png" },
      ),
  };
}

Deno.test("parseRenderParams rejects bad requests and accepts good ones", () => {
  assertEquals(parseRenderParams(new URLSearchParams("")).ok, false); // missing c
  assertEquals(
    parseRenderParams(new URLSearchParams("c=abc&w=9&h=9")).ok,
    false,
  ); // bad size
  assertEquals(parseRenderParams(new URLSearchParams("c=abc&dpr=7")).ok, false); // bad dpr

  // Unknown / disallowed format and quality are rejected before any render.
  assertEquals(
    parseRenderParams(new URLSearchParams("c=abc&fmt=gif")).ok,
    false,
  );
  assertEquals(
    parseRenderParams(new URLSearchParams("c=abc&fmt=jpeg&q=99")).ok,
    false,
  );

  // The 40:21 scale-downs of the default are accepted; an off-ratio pair at the
  // same width is not (guards against a smaller render silently re-framing).
  assert(parseRenderParams(new URLSearchParams("c=abc&w=800&h=420")).ok);
  assert(parseRenderParams(new URLSearchParams("c=abc&w=600&h=315")).ok);
  assertEquals(
    parseRenderParams(new URLSearchParams("c=abc&w=800&h=315")).ok,
    false,
  );

  const good = parseRenderParams(
    new URLSearchParams("c=abc&w=1200&h=630&dpr=2"),
  );
  assert(good.ok);
  // No fmt given -> PNG, and PNG carries no quality.
  assertEquals(good.value, {
    c: "abc",
    width: 1200,
    height: 630,
    dpr: 2,
    format: "png",
  });

  const jpeg = parseRenderParams(new URLSearchParams("c=abc&fmt=jpeg&q=65"));
  assert(jpeg.ok);
  assertEquals(jpeg.value, {
    c: "abc",
    width: 1200,
    height: 630,
    dpr: 2,
    format: "jpeg",
    quality: 65,
  });

  const defaulted = parseRenderParams(new URLSearchParams("c=abc"));
  assert(defaulted.ok);
  assertEquals(defaulted.value, {
    c: "abc",
    width: 1200,
    height: 630,
    dpr: 2,
    format: "png",
  });

  // fmt=jpeg with no q defaults the quality to 80.
  const jpegDefault = parseRenderParams(new URLSearchParams("c=abc&fmt=jpeg"));
  assert(jpegDefault.ok);
  assertEquals(jpegDefault.value.quality, 80);
});

Deno.test("renderPng produces a correctly-sized PNG of a bare map", async () => {
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  // Stub OSM tiles so Leaflet's tile loads (and thus __leridaReady) fire offline.
  await context.route(
    /tile\.openstreetmap\.org/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  try {
    const params = parseRenderParams(
      new URLSearchParams(`c=${sampleState()}&w=1200&h=630&dpr=2`),
    );
    assert(params.ok);

    const png = await renderPng(
      playwrightRenderPage(page),
      readAsset,
      params.value,
    );

    // Valid PNG of the requested size (CSS pixels x deviceScaleFactor).
    assert(isPng(png), "output is a PNG");
    assertEquals(pngSize(png), { width: 2400, height: 1260 });

    // The rendered DOM is a bare map: chrome dropped, markers drawn.
    assertEquals(await page.locator("[data-role='toolbar']").count(), 0);
    assertEquals(await page.locator(".search").count(), 0);
    // The zoom control is hidden by CSS (still in the DOM), so assert it isn't visible.
    assertEquals(
      await page.locator(".leaflet-control-zoom").isVisible(),
      false,
    );
    assertEquals(await page.locator("[data-feature='marker']").count(), 2);
    assertEquals(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});

Deno.test("fmt=jpeg renders a valid JPEG of the same map", async () => {
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
  });
  await context.route(
    /tile\.openstreetmap\.org/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: ONE_PX_PNG,
      }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);

  try {
    const base = `c=${sampleState()}&w=1200&h=630&dpr=2`;
    const pngParams = parseRenderParams(new URLSearchParams(base));
    const jpegParams = parseRenderParams(
      new URLSearchParams(`${base}&fmt=jpeg&q=80`),
    );
    assert(pngParams.ok && jpegParams.ok);

    const png = await renderPng(playwrightRenderPage(page), readAsset, pngParams.value);
    const jpeg = await renderPng(
      playwrightRenderPage(page),
      readAsset,
      jpegParams.value,
    );

    // Both are valid images of the requested format. (The offline tile stub is a
    // near-uniform image, which PNG compresses better than JPEG, so we assert the
    // format is honoured rather than a byte-size ordering; the real size win comes
    // from JPEG on photographic map tiles.)
    assert(isPng(png), "png output is a PNG");
    assert(isJpeg(jpeg), "jpeg output is a JPEG");
    // Surface both sizes as run evidence.
    console.log(`  render sizes: png=${png.length}B jpeg=${jpeg.length}B`);
  } finally {
    await context.close();
    await browser.close();
  }
});
