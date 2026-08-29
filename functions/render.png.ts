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

import puppeteer, { type Page } from "@cloudflare/puppeteer";
import {
  contentTypeFor,
  parseRenderParams,
  type RenderParams,
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

function cacheKeyFor(url: URL, params: RenderParams): Request {
  const quality = params.quality ?? "";
  const query = `c=${encodeURIComponent(params.c)}` +
    `&w=${params.width}&h=${params.height}&dpr=${params.dpr}` +
    `&fmt=${params.format}&q=${quality}`;
  return new Request(`${url.origin}/render.png?${query}`);
}

class AssetSource {
  assets: Env["ASSETS"];

  constructor(assets: Env["ASSETS"]) {
    this.assets = assets;
  }

  async read(path: string): Promise<Uint8Array> {
    const response = await this.assets.fetch(`https://assets.local/${path}`);
    if (!response.ok) {
      throw new Error(`asset ${path}: ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

class PuppeteerPage implements RenderPage {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async setViewport(width: number, height: number, dpr: number): Promise<void> {
    await this.page.setViewport({ width, height, deviceScaleFactor: dpr });
  }

  async goto(dataUrl: string): Promise<void> {
    await this.page.goto(dataUrl, { waitUntil: "domcontentloaded" });
  }

  async waitForReady(timeoutMs: number): Promise<void> {
    await this.page.waitForFunction("window.__leridaReady === true", {
      timeout: timeoutMs,
    });
  }

  screenshot(options: Parameters<RenderPage["screenshot"]>[0]) {
    const image = options.format === "jpeg"
      ? this.page.screenshot({ type: "jpeg", quality: options.quality })
      : this.page.screenshot({ type: "png" });
    return image as Promise<Uint8Array>;
  }
}

interface FreshRenderOptions {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
  cacheKey: Request;
  params: RenderParams;
}

async function renderFresh(options: FreshRenderOptions): Promise<Response> {
  const browser = await acquireBrowser(options.env.MYBROWSER);
  const page = await browser.newPage();
  try {
    const source = new AssetSource(options.env.ASSETS);
    const adapter = new PuppeteerPage(page);
    const image = await renderPng(
      adapter,
      source.read.bind(source),
      options.params,
    );
    const response = new Response(image, {
      headers: {
        "content-type": contentTypeFor(options.params.format),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
    options.waitUntil(caches.default.put(options.cacheKey, response.clone()));
    return response;
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

const handleRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const url = new URL(request.url);
  const parsed = parseRenderParams(url.searchParams);
  if (!parsed.ok) {
    return new Response(parsed.error, {
      status: 422,
      headers: { "content-type": "text/plain" },
    });
  }
  const cacheKey = cacheKeyFor(url, parsed.value);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return cached;
  }
  return await renderFresh({ env, waitUntil, cacheKey, params: parsed.value });
};

export const onRequestGet: PagesFunction<Env> = handleRequest;
