// Cloudflare Pages Function: GET /render.png?c=...&w=...&h=...&dpr=...
//
// Renders a shared map to a PNG so it can be embedded with a plain <img> tag (and
// reused as the og:image social card). It never touches the live frontend: the
// core (render-core.ts) assembles a self-contained page from the built assets
// (env.ASSETS), encodes it as a data URL, and screenshots it in a Browser
// Rendering session. A given c+size+dpr is deterministic, so results are cached
// immutably. This file is only the Cloudflare wiring; all logic is in render-core.
//
// Bindings required (see wrangler.toml / Pages dashboard):
//   MYBROWSER  Browser Rendering
//   ASSETS     built-in Pages static-asset binding

import puppeteer from "@cloudflare/puppeteer";
import { type AssetReader } from "./assemble.ts";
import {
  contentTypeFor,
  parseRenderParams,
  type RenderPage,
  renderPng,
} from "./render-core.ts";

interface Env {
  MYBROWSER: Fetcher;
  ASSETS: { fetch(input: Request | string): Promise<Response> };
}

// Browser Rendering rate-limits *launching* browsers, so a launch-per-request
// worker 1101s under any burst of uncached renders. Instead, reuse an idle
// session when one is open and only launch when none is free; keep_alive leaves
// the browser warm for the next request (and reaps it after the idle window).
const KEEP_ALIVE_MS = 60_000;

async function acquireBrowser(endpoint: Fetcher) {
  const sessions = await puppeteer.sessions(endpoint);
  const free = sessions.find((session) => !session.connectionId);
  if (free) {
    try {
      return await puppeteer.connect(endpoint, free.sessionId);
    } catch {
      // The session was taken or closed between listing and connect; launch below.
    }
  }
  return await puppeteer.launch(endpoint, { keep_alive: KEEP_ALIVE_MS });
}

export const onRequestGet: PagesFunction<Env> = async (
  { request, env, waitUntil },
) => {
  const url = new URL(request.url);

  const parsed = parseRenderParams(url.searchParams);
  if (!parsed.ok) {
    return new Response(parsed.error, {
      status: 422,
      headers: { "content-type": "text/plain" },
    });
  }
  const { c, width, height, dpr, format, quality } = parsed.value;

  // Cache on the normalised render parameters: identical params, identical image.
  // Format and quality are part of the key so a PNG and a JPEG of the same map
  // don't collide.
  const cacheKey = new Request(
    `${url.origin}/render.png?c=${
      encodeURIComponent(c)
    }&w=${width}&h=${height}&dpr=${dpr}&fmt=${format}&q=${quality ?? ""}`,
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const readAsset: AssetReader = async (path) => {
    const response = await env.ASSETS.fetch(`https://assets.local/${path}`);
    if (!response.ok) {
      throw new Error(`asset ${path}: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  };

  const browser = await acquireBrowser(env.MYBROWSER);
  const page = await browser.newPage();
  try {
    const renderPage: RenderPage = {
      setViewport: (width, height, deviceScaleFactor) =>
        page.setViewport({ width, height, deviceScaleFactor }),
      goto: async (dataUrl) => {
        await page.goto(dataUrl, { waitUntil: "domcontentloaded" });
      },
      waitForReady: async (timeoutMs) => {
        await page.waitForFunction("window.__leridaReady === true", {
          timeout: timeoutMs,
        });
      },
      // puppeteer rejects a `quality` on a PNG shot, so only pass it for JPEG.
      screenshot: (options) =>
        page.screenshot(
          options.format === "jpeg"
            ? { type: "jpeg", quality: options.quality }
            : { type: "png" },
        ) as Promise<Uint8Array>,
    };

    const image = await renderPng(renderPage, readAsset, parsed.value);
    const response = new Response(image, {
      headers: {
        "content-type": contentTypeFor(format),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } finally {
    // Close only the page and disconnect: the browser stays alive (keep_alive)
    // so the next request reuses it instead of launching a fresh one.
    await page.close();
    await browser.disconnect();
  }
};
