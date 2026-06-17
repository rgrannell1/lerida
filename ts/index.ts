// Entry point: load state from the URL, then mount the map application onto #app.

// Load Leaflet + plugins (as global L) before anything reads them.
import "./leaflet-setup.ts";
// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { App } from "./components/app.ts";
import { loadFromQuery, state } from "./state.ts";
import { rendermode, stateQuery } from "./render.ts";

loadFromQuery(stateQuery());
// Apply the meta page title from the URL (an empty title falls back too).
document.title = state.meta?.title || "lerida";

// In the image worker, tag the document so CSS strips remaining map chrome (the
// zoom control); the toolbar/search/about are dropped by the App component.
if (rendermode === "cloudflare") {
  document.documentElement.classList.add("render");
}

const root = document.getElementById("app");
if (root) {
  m.mount(root, App);
}
