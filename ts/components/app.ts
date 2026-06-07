// Root component: the map, the toolbar overlaid on it, and a transient hint
// shown while drawing a multi-point shape.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { MapView } from "./map.ts";
import { Toolbar } from "./toolbar.ts";
import { ui } from "../ui.ts";

// While a line or polygon is being drawn, remind the user how to finish — the
// gesture (click to add points, Escape to commit) isn't otherwise discoverable.
function drawHint(): m.Vnode | null {
  if (ui.tool !== "line" && ui.tool !== "polygon") {
    return null;
  }
  return m("div.draw-hint", { "data-role": "draw-hint" }, "Click to add points · Esc to finish");
}

export function App(): m.Component {
  return {
    view() {
      return [m(MapView), m(Toolbar), drawHint()];
    },
  };
}
