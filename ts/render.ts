// Render mode: the single seam between the app and the Cloudflare image worker
// (design.md line 16). When the worker renders a map to a PNG it builds a
// self-contained page and injects __LERIDA_RENDER__ before this bundle runs; the
// live site never sets it. Everything else in the app only reads `rendermode`
// and `stateQuery()`, so no worker-specific logic leaks further in.

// Injected by the worker. The render page has no URL query, so the compressed
// state (`c`) the worker wants drawn is carried here instead.
interface RenderConfig {
  c: string;
}

const config =
  (globalThis as { __LERIDA_RENDER__?: RenderConfig }).__LERIDA_RENDER__;

export type RenderMode = "website" | "cloudflare";

// "cloudflare" when the worker injected a config, "website" otherwise.
export const rendermode: RenderMode = config ? "cloudflare" : "website";

// The query string to load map state from: the real URL on the live site, or a
// reconstructed `?c=...` under the worker (whose page has no query of its own).
export function stateQuery(): string {
  return config ? `?c=${config.c}` : globalThis.location.search;
}

// Embed mode: an interactive, chrome-less map for iframe embedding. Distinct from
// the cloudflare render mode (which is a static screenshot). The single seam for
// the `?embed` flag; nothing else reads location.search for it.
export const isEmbed = new URLSearchParams(globalThis.location.search).has(
  "embed",
);
