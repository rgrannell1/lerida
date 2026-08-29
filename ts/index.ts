// Entry point: load state from the URL, then mount the map application onto #app.

// Load Leaflet + plugins (as global L) before anything reads them.
import "./leaflet-setup.ts";
// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { App } from "./components/app.ts";
import { BrokenLink } from "./components/broken-link.ts";
import { loadFromQuery, state } from "./state.ts";
import { rendermode, stateQuery } from "./render.ts";

function showBrokenLink(root: Element | null): void {
  if (root) {
    m.mount(root, {
      view: () => m(BrokenLink, { blankMapPath: globalThis.location.pathname }),
    });
  }
}

function startApp(root: Element | null): void {
  try {
    loadFromQuery(stateQuery());
  } catch {
    showBrokenLink(root);
    return;
  }

  document.title = state.meta?.title || "lerida";
  if (rendermode === "cloudflare") {
    document.documentElement.classList.add("render");
  }

  if (root) {
    m.mount(root, App);
  }
}

startApp(document.getElementById("app"));
