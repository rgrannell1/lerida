// Entry point: load state from the URL, then mount the map application onto #app.

// Load Leaflet + plugins (as global L) before anything reads them.
import "./leaflet-setup.ts";
// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { App } from "./components/app.ts";
import { loadFromUrl } from "./state.ts";

loadFromUrl();

const root = document.getElementById("app");
if (root) {
  m.mount(root, App);
}
