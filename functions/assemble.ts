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

interface AssetPaths {
  css: string;
  js: string;
}

function findAssetPaths(indexHtml: string): AssetPaths {
  const css = indexHtml.match(/href="([^"]*app-[^"]*\.css)"/)?.[1];
  const js = indexHtml.match(/src="([^"]*app-[^"]*\.js)"/)?.[1];
  const hasAssets = css !== undefined && js !== undefined;
  if (!hasAssets) {
    throw new Error("assemble: could not find hashed css/js in index.html");
  }
  return { css, js };
}

async function inlineFont(css: string, read: AssetReader): Promise<string> {
  const match = css.match(
    /url\("?\.\/(fontawesome-webfont-[^)"?]*\.woff2)[^)]*"?\)/,
  );
  if (!match) {
    return css;
  }
  const fontBytes = await read(`dist/css/${match[1]}`);
  const dataUrl = `url(data:font/woff2;base64,${toBase64(fontBytes)})`;
  return css.replace(match[0], dataUrl);
}

function renderDocument(css: string, js: string, compressedState: string): string {
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

export async function assembleRenderHtml(
  read: AssetReader,
  compressedState: string,
): Promise<string> {
  const decoder = new TextDecoder();
  const indexHtml = decoder.decode(await read("index.html"));
  const paths = findAssetPaths(indexHtml);
  const rawCss = decoder.decode(await read(paths.css.replace(/^\//, "")));
  const css = await inlineFont(rawCss, read);
  const js = decoder.decode(await read(paths.js.replace(/^\//, "")));
  return renderDocument(css, js, compressedState);
}
