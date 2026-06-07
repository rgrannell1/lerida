// esbuild bundling. Two passes: the app JS (via the Deno loader, so deno.json
// aliases + npm/jsr specifiers resolve) and the vendor + app CSS (plain esbuild,
// resolving package CSS from node_modules with fonts/images inlined as data URLs).
// All dependencies are bundled — no runtime CDN. Pass --watch to rebuild on
// change. Not an rs command — invoked by bs/build.zsh / bs/dev.zsh.

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

const jsOptions = {
  plugins: denoPlugins({ configPath: CONFIG_PATH }),
  entryPoints: ["ts/index.ts"],
  bundle: true,
  format: "esm" as const,
  outfile: "web/dist/js/app.js",
  minify: true,
  sourcemap: true,
};

const cssOptions = {
  entryPoints: ["ts/vendor.css"],
  bundle: true,
  outfile: "web/dist/css/app.css",
  minify: true,
  loader: ASSET_LOADERS,
};

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
