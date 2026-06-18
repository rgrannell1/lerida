// Root component: the map, the toolbar overlaid on it, and a transient hint
// shown while drawing a multi-point shape.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { MapView } from "./map.ts";
import { Toolbar } from "./toolbar.ts";
import { Search } from "./search.ts";
import { About } from "./about.ts";
import { ui } from "../ui.ts";
import { isEmbed, rendermode } from "../render.ts";

// While a line or polygon is being drawn, remind the user how to finish — the
// gesture (click to add points, Escape to commit) isn't otherwise discoverable.
function drawHint(): m.Vnode | null {
  if (ui.tool !== "line" && ui.tool !== "polygon") {
    return null;
  }
  return m(
    "div.draw-hint",
    { "data-role": "draw-hint" },
    "Click to add points · Esc to finish",
  );
}

export function App(): m.Component {
  return {
    view() {
      // Image-render mode: just the bare map, no editing chrome. Embed mode is
      // the same bare map, but stays interactive (zoom control kept; see index.ts,
      // which only adds the chrome-stripping `.render` class for cloudflare).
      if (rendermode === "cloudflare" || isEmbed) {
        return [m(MapView)];
      }
      return [
        m(MapView),
        m(Toolbar),
        m(Search),
        drawHint(),
        ui.showAbout ? m(About) : null,
      ];
    },
  };
}
