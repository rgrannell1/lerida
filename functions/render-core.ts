// Image-render logic, independent of Cloudflare bindings so it can be integration-
// tested with a local browser. The Pages Function (render.png.ts) adapts
// @cloudflare/puppeteer to RenderPage; the test suite adapts Playwright. Both run
// the identical assemble -> data URL -> goto -> wait-ready -> screenshot path.

import { assembleRenderHtml, type AssetReader } from "./assemble.ts";

// Output image format. PNG is lossless (large for photographic map tiles); JPEG
// trades a little sharpness for a much smaller file, controlled by `quality`.
export type ImageFormat = "png" | "jpeg";

export interface RenderParams {
  c: string;
  width: number;
  height: number;
  dpr: number;
  format: ImageFormat;
  // JPEG quality (1..100); absent for PNG, which has no quality knob.
  quality?: number;
}

// Allowlisted output sizes and pixel ratios. Each render is a real browser launch,
// so anything off these lists is rejected before any work happens.
export const ALLOWED_SIZES = new Set([
  // 40:21 (the og:image / default). 800x420 and 600x315 are exact scale-downs of
  // 1200x630 (w x 21/40 = integer height), so a smaller render frames the map
  // identically to the default — only the pixel count shrinks. This is the tier
  // to embed in docs; pair with fmt=jpeg&dpr=1 for a light thumbnail.
  "1200x630",
  "800x420",
  "600x315",
  "1200x1200",
  "1080x1080",
  "800x600",
  "600x600",
]);
export const ALLOWED_DPR = new Set([1, 2, 3]);
// Formats we render, and the JPEG quality levels we allow. Both are allowlisted
// (like size/dpr) so the render+cache combinations stay bounded.
export const ALLOWED_FORMATS = new Set<ImageFormat>(["png", "jpeg"]);
export const ALLOWED_QUALITY = new Set([50, 65, 80]);
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;
const DEFAULT_DPR = 2;
// PNG stays the default so existing render.png URLs are byte-for-byte unchanged;
// callers opt into a smaller JPEG with fmt=jpeg. 80 is the default JPEG quality.
const DEFAULT_FORMAT: ImageFormat = "png";
const DEFAULT_QUALITY = 80;
export const READY_TIMEOUT_MS = 25_000;

// The MIME type served for a rendered image of the given format.
export function contentTypeFor(format: ImageFormat): string {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

export type ParseResult =
  | { ok: true; value: RenderParams }
  | { ok: false; error: string };

// Validate and normalise the render query. Returns the typed params or the reason
// to send a 422.
export function parseRenderParams(params: URLSearchParams): ParseResult {
  const c = params.get("c");
  if (!c) {
    return { ok: false, error: "missing required ?c= state" };
  }
  const width = Number(params.get("w") ?? DEFAULT_WIDTH);
  const height = Number(params.get("h") ?? DEFAULT_HEIGHT);
  const dpr = Number(params.get("dpr") ?? DEFAULT_DPR);
  const format = (params.get("fmt") ?? DEFAULT_FORMAT) as ImageFormat;
  if (!ALLOWED_SIZES.has(`${width}x${height}`)) {
    return { ok: false, error: `unsupported size ${width}x${height}` };
  }
  if (!ALLOWED_DPR.has(dpr)) {
    return { ok: false, error: `unsupported dpr ${dpr}` };
  }
  if (!ALLOWED_FORMATS.has(format)) {
    return { ok: false, error: `unsupported format ${format}` };
  }
  const value: RenderParams = { c, width, height, dpr, format };
  // Quality applies only to JPEG; PNG carries none so its cache key stays clean.
  if (format === "jpeg") {
    const quality = Number(params.get("q") ?? DEFAULT_QUALITY);
    if (!ALLOWED_QUALITY.has(quality)) {
      return { ok: false, error: `unsupported quality ${quality}` };
    }
    value.quality = quality;
  }
  return { ok: true, value };
}

// What the encoder needs to take a screenshot: the format and (for JPEG) quality.
export interface ScreenshotOptions {
  format: ImageFormat;
  quality?: number;
}

// The browser surface the render needs. Implemented over puppeteer in the worker
// and over Playwright in tests.
export interface RenderPage {
  setViewport(width: number, height: number, dpr: number): Promise<void>;
  goto(dataUrl: string): Promise<void>;
  waitForReady(timeoutMs: number): Promise<void>;
  screenshot(options: ScreenshotOptions): Promise<Uint8Array>;
}

// Base64-encode a UTF-8 string in chunks (Workers has no `unescape`).
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

// Assemble the self-contained page and encode it as a data: URL.
export async function buildDataUrl(
  read: AssetReader,
  compressedState: string,
): Promise<string> {
  const html = await assembleRenderHtml(read, compressedState);
  return `data:text/html;base64,${utf8ToBase64(html)}`;
}

// Render a map to PNG bytes on the given page.
export async function renderPng(
  page: RenderPage,
  read: AssetReader,
  value: RenderParams,
): Promise<Uint8Array> {
  const dataUrl = await buildDataUrl(read, value.c);
  await page.setViewport(value.width, value.height, value.dpr);
  await page.goto(dataUrl);
  await page.waitForReady(READY_TIMEOUT_MS);
  return await page.screenshot({ format: value.format, quality: value.quality });
}
