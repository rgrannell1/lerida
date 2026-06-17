// Cloudflare Pages Function for the SPA entry (/). Serves the static app shell
// unchanged, except when the URL carries map state (?c=): then it injects per-map
// social-card meta tags (og:image -> the render worker) so a shared link previews
// as the actual map. The interactive app is untouched; only <head> grows a few
// crawler-facing tags. All other routes/assets are served statically (this
// function only handles /).

import { buildSocialMeta } from "./social.ts";

interface Env {
  ASSETS: { fetch(input: Request | string): Promise<Response> };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  // Fetch the static shell directly from the asset server (bypasses this function).
  const shell = await env.ASSETS.fetch(`${url.origin}/index.html`);

  const compressedState = url.searchParams.get("c");
  if (!compressedState) {
    return shell;
  }

  const meta = buildSocialMeta(url.origin, compressedState, url.toString());
  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(meta, { html: true });
      },
    })
    .transform(shell);
};
