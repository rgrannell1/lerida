// Assemble a fully self-contained HTML document for image rendering: the app's
// CSS and JS inlined, the Font Awesome woff2 inlined as a data URL, and the
// compressed map state injected as __LERIDA_RENDER__. The only network the page
// then needs is OSM tiles, so it renders the same offline as on the live site.
//
// Portable (Web APIs only: TextDecoder, btoa, RegExp) so both the Cloudflare
// worker (render.png.ts) and the local verification harness can use it. Read the
// asset bytes however each environment prefers (env.ASSETS / the filesystem).

// Read a built asset by its path relative to web/ (e.g. "index.html" or
// "dist/js/app-X.js") and return its bytes.
export type AssetReader = (path: string) => Promise<Uint8Array>;

// Base64-encode bytes in chunks (avoids blowing the argument limit on large
// fonts when spreading into String.fromCharCode).
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

export async function assembleRenderHtml(
  read: AssetReader,
  compressedState: string,
): Promise<string> {
  const decoder = new TextDecoder();
  const indexHtml = decoder.decode(await read("index.html"));

  // The bundle is content-hashed, so discover the current filenames from the
  // generated index.html rather than hard-coding hashes.
  const cssPath = indexHtml.match(/href="([^"]*app-[^"]*\.css)"/)?.[1];
  const jsPath = indexHtml.match(/src="([^"]*app-[^"]*\.js)"/)?.[1];
  if (!cssPath || !jsPath) {
    throw new Error("assemble: could not find hashed css/js in index.html");
  }

  let css = decoder.decode(await read(cssPath.replace(/^\//, "")));
  const js = decoder.decode(await read(jsPath.replace(/^\//, "")));

  // Inline the Font Awesome woff2 (Chromium prefers woff2) so marker pins render
  // without a network fetch. Other formats in the @font-face are left as dead
  // relative URLs; Chromium never reaches for them once woff2 resolves.
  const fontMatch = css.match(
    /url\("?\.\/(fontawesome-webfont-[^)"?]*\.woff2)[^)]*"?\)/,
  );
  if (fontMatch) {
    const fontBytes = await read(`dist/css/${fontMatch[1]}`);
    css = css.replace(
      fontMatch[0],
      `url(data:font/woff2;base64,${toBase64(fontBytes)})`,
    );
  }

  // Guard against a literal </script> inside the bundle prematurely closing the
  // inlined module (safe: only matters inside string literals, where it is
  // equivalent).
  const inlineJs = js.replace(/<\/script>/gi, "<\\/script>");
  const injected = JSON.stringify({ c: compressedState });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>globalThis.__LERIDA_RENDER__=${injected};</script>
<script type="module">${inlineJs}</script>
</body>
</html>`;
}
