// Root component: the map plus the marker palette overlaid on it.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { MapView } from "./map.ts";
import { Toolbar } from "./toolbar.ts";

export function App(): m.Component {
  return {
    view() {
      return [m(MapView), m(Toolbar)];
    },
  };
}
