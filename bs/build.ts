// esbuild bundling. Two passes: the app JS (via the Deno loader, so deno.json
// aliases + npm/jsr specifiers resolve) and the vendor + app CSS (plain esbuild,
// resolving package CSS from node_modules with fonts emitted as files, sprites
// inlined). All dependencies are bundled — no runtime CDN. Outputs are
// content-hashed (app-<hash>.js / app-<hash>.css) for cache busting. After each
// build, web/index.html and the PWA service worker (web/sw.js) are generated from
// their templates with the hashed filenames injected. Pass --watch to rebuild on
// change. Not an rs command — invoked by bs/build.zsh.

import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";

// Absolute path to the import map cycle/npm/jsr specifiers resolve against.
const CONFIG_PATH = `${Deno.cwd()}/deno.json`;

// Fonts are emitted as separate files (so the browser only fetches woff2);
// small sprite images are inlined as data URLs.
const ASSET_LOADERS = {
  ".woff": "file",
  ".woff2": "file",
  ".ttf": "file",
  ".eot": "file",
  ".svg": "file",
  ".png": "dataurl",
  ".gif": "dataurl",
} as const;

// The hashed entry outputs (relative to web/) for the HTML, and the full per-pass
// output lists (relative to web/) for the service-worker precache.
const entry = { js: "dist/js/app.js", css: "dist/css/app.css" };
const outputs: { js: string[]; css: string[] } = { js: [], css: [] };

const HTML_TEMPLATE = await Deno.readTextFile("web/index.template.html");
const SW_TEMPLATE = await Deno.readTextFile("web/sw.template.js");

function toAbsolute(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

// Regenerate web/index.html with the current hashed asset names.
function writeHtml(): void {
  const html = HTML_TEMPLATE.replace("{{CSS}}", entry.css).replace("{{JS}}", entry.js);
  Deno.writeTextFileSync("web/index.html", html);
}

// Regenerate web/sw.js: precache the app shell (index, hashed js/css, woff2 fonts)
// with a cache version derived from the content hashes.
// Extract the content hash from a hashed output path (app-<hash>.ext).
function hashOf(path: string): string {
  return path.replace(/.*app-([A-Za-z0-9]+)\.[a-z]+$/, "$1");
}

function writeServiceWorker(): void {
  const fonts = outputs.css.filter((path) => path.endsWith(".woff2"));
  const precache = ["/", "/index.html", entry.js, entry.css, ...fonts].map(toAbsolute);
  // Version changes whenever either bundle's hash changes, invalidating the cache.
  const version = `${hashOf(entry.js)}-${hashOf(entry.css)}`;
  const serviceWorker = SW_TEMPLATE
    .replace("lerida-__VERSION__", `lerida-${version}`)
    .replace('["__PRECACHE__"]', JSON.stringify(precache));
  Deno.writeTextFileSync("web/sw.js", serviceWorker);
}

// esbuild plugin: after each build, record the hashed outputs and regenerate the
// HTML + service worker so the page always points at the current bundle.
function recordAssets(kind: "js" | "css"): esbuild.Plugin {
  return {
    name: `record-${kind}`,
    setup(build) {
      build.onEnd((result) => {
        const list: string[] = [];
        for (const path of Object.keys(result.metafile?.outputs ?? {})) {
          const rel = path.replace(/^web\//, "");
          if (rel.endsWith(".map")) {
            continue;
          }
          list.push(rel);
          if (rel.endsWith(`.${kind}`)) {
            entry[kind] = rel;
          }
        }
        outputs[kind] = list;
        writeHtml();
        writeServiceWorker();
      });
    },
  };
}

const jsOptions = {
  plugins: [...denoPlugins({ configPath: CONFIG_PATH }), recordAssets("js")],
  entryPoints: { app: "ts/index.ts" },
  bundle: true,
  format: "esm" as const,
  outdir: "web/dist/js",
  entryNames: "[name]-[hash]",
  minify: true,
  treeShaking: true,
  sourcemap: true,
  metafile: true,
};

const cssOptions = {
  plugins: [recordAssets("css")],
  entryPoints: { app: "css/vendor.css" },
  bundle: true,
  outdir: "web/dist/css",
  entryNames: "[name]-[hash]",
  minify: true,
  loader: ASSET_LOADERS,
  metafile: true,
};

// Clear stale hashed outputs before a fresh build.
try {
  Deno.removeSync("web/dist", { recursive: true });
} catch {
  // First run — nothing to remove.
}

if (Deno.args.includes("--watch")) {
  const jsContext = await esbuild.context(jsOptions);
  const cssContext = await esbuild.context(cssOptions);
  await jsContext.watch();
  await cssContext.watch();
  console.log("esbuild: watching for changes…");
  await new Promise(() => {});
} else {
  await esbuild.build(jsOptions);
  await esbuild.build(cssOptions);
  await esbuild.stop();
}
