// Per-map social card meta tags. The site is a SPA whose state lives in ?c=, but
// crawlers don't run JS, so functions/index.ts injects these tags into the HTML
// served for a given ?c=, pointing og:image at the render worker (render.png).
// Pure and portable so it can be unit-tested without the Cloudflare runtime.

// Social cards want a 1.91:1 image; reuse the render worker's 1200x630 preset.
export const SOCIAL_IMAGE = { width: 1200, height: 630 };

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// The render.png URL for a compressed state, sized for a social card. Goes through
// URLSearchParams so the `c` value is correctly percent-encoded.
export function socialImageUrl(origin: string, compressedState: string): string {
  const params = new URLSearchParams({
    c: compressedState,
    w: String(SOCIAL_IMAGE.width),
    h: String(SOCIAL_IMAGE.height),
  });
  return `${origin}/render.png?${params.toString()}`;
}

// The <meta> tags to append to <head> for a shared map at pageUrl.
export function buildSocialMeta(origin: string, compressedState: string, pageUrl: string): string {
  const image = socialImageUrl(origin, compressedState);
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="lerida">`,
    `<meta property="og:description" content="A shared map.">`,
    `<meta property="og:url" content="${escapeAttr(pageUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:image:width" content="${SOCIAL_IMAGE.width}">`,
    `<meta property="og:image:height" content="${SOCIAL_IMAGE.height}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
  ].join("");
}
