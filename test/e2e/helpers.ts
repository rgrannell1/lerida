// End-to-end test harness: serve the built `web/` bundle over HTTP and drive it
// with a real Chromium via Playwright. The bundle is self-contained (Leaflet and
// every plugin are inlined), so the only network the app needs is for OSM tiles —
// which these tests never assert on, so they run offline. Every test asserts on
// the URL query string or the DOM, never on tile imagery.

import { serveDir } from "@std/http/file-server";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright";
import LZString from "lz-string";

// Absolute path to the repo's `web/` directory (served as the document root).
const WEB_ROOT = new URL("../../web", import.meta.url).pathname;

// A running static server plus the base URL it listens on.
export interface Server {
  url: string;
  close(): Promise<void>;
}

// Serve `web/` on an ephemeral port. Content types come from serveDir, so the
// ES-module `app.js` is sent as `text/javascript` (a manual handler would risk
// the wrong MIME and a blocked module).
export function startServer(): Server {
  const server = Deno.serve(
    { port: 0, onListen() {} },
    (req) => serveDir(req, { fsRoot: WEB_ROOT, quiet: true }),
  );
  const port = (server.addr as Deno.NetAddr).port;
  return {
    url: `http://localhost:${port}`,
    async close() {
      await server.shutdown();
    },
  };
}

// Locate a Chromium executable without a network download. Playwright 1.60's
// bundled-browser resolution wants a headless-shell that isn't cached here, so we
// resolve an executable ourselves: an explicit override, then a cached
// `ms-playwright` Chromium, then the system Chrome. Returns undefined to let
// Playwright try its own default as a last resort.
export function findChromium(): string | undefined {
  const override = Deno.env.get("LERIDA_CHROMIUM");
  if (override) {
    return override;
  }
  const home = Deno.env.get("HOME");
  if (home) {
    const cache = `${home}/.cache/ms-playwright`;
    try {
      const builds = [...Deno.readDirSync(cache)]
        .filter((entry) =>
          entry.isDirectory && entry.name.startsWith("chromium-")
        )
        .map((entry) => entry.name)
        .sort()
        .reverse();
      for (const build of builds) {
        const exe = `${cache}/${build}/chrome-linux/chrome`;
        if (fileExists(exe)) {
          return exe;
        }
      }
    } catch {
      // No Playwright cache — fall through to the system Chrome.
    }
  }
  for (const candidate of ["/usr/bin/google-chrome", "/usr/bin/chromium"]) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function fileExists(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

// A launched browser plus a fresh page, with everything needed to tear it down.
export interface Harness {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  server: Server;
  close(): Promise<void>;
}

// Start a server, launch Chromium, and open a blank page. Each test gets its own
// harness so state never leaks between tests.
export async function launch(): Promise<Harness> {
  const server = startServer();
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  // Keep the suite offline and deterministic: stub OSM geocoding to no results by
  // default. A test that needs places adds its own page.route (which wins).
  await context.route(
    /nominatim\.openstreetmap\.org/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      }),
  );
  const page = await context.newPage();
  // Fail fast on a genuine hang rather than waiting Playwright's 30s default.
  page.setDefaultTimeout(15_000);
  return {
    browser,
    context,
    page,
    server,
    async close() {
      await context.close();
      await browser.close();
      await server.close();
    },
  };
}

// Open the app at the given query string (e.g. "?editable=false") and wait for
// the Leaflet map to be live — the marker tool only drops a pin once the map
// knows its own size, so we wait for that, not merely for the container element.
export async function openApp(harness: Harness, query = ""): Promise<void> {
  await harness.page.goto(`${harness.server.url}/${query}`);
  await harness.page.waitForSelector("#map.leaflet-container");
  await harness.page.waitForFunction(() => {
    const map = document.querySelector("#map");
    return !!map && map.clientWidth > 0 &&
      map.querySelector(".leaflet-tile-pane") !== null;
  });
}

// The canonical params of the page's current URL. The app always compresses
// state into a single `c=` value, so decompress that back to the readable param
// string; a legacy (uncompressed) query is returned as-is. Either way the result
// is URL-decoded, so tests can assert on substrings like `markers.0.lat=`.
export function currentQuery(page: Page): string {
  const search = new URL(page.url()).search.replace(/^\?/, "");
  const compressed = new URLSearchParams(search).get("c");
  const params = compressed !== null
    ? (LZString.decompressFromEncodedURIComponent(compressed) ?? "")
    : search;
  return decodeURIComponent(params);
}

// Poll the decoded params until `predicate` holds (replaces in-browser
// `location.search.includes(...)` waits, which can't see the compressed state).
export async function waitForParams(
  harness: Harness,
  predicate: (params: string) => boolean,
  timeoutMs = 15_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate(currentQuery(harness.page))) {
      return;
    }
    await harness.page.waitForTimeout(50);
  }
  throw new Error("timed out waiting for URL params to match");
}
