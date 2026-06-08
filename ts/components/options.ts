// The options panel shown in the toolbar in place of the drawing tools (toggled
// by the header cog). Where the tool palettes place things *on* the map, this
// edits map-level meta settings carried in the URL. v1 sets the browser page
// title; it's laid out as labelled rows so further meta operations slot in.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { state, syncToUrl } from "../state.ts";

// Write the page title into meta (and the live document title), then sync the
// URL. An empty title drops back to the "lerida" default and, since the snapshot
// omits a blank title, leaves no meta in the URL.
function setTitle(value: string): void {
  const title = value.trim();
  state.meta = { ...state.meta, title };
  document.title = title || "lerida";
  syncToUrl();
}

// One labelled settings row: a caption above its control.
function row(label: string, control: m.Vnode): m.Vnode {
  return m("label.options-row", [m("span.options-label", label), control]);
}

export function Options(): m.Component {
  return {
    view() {
      return m("div.options-panel", { "data-role": "options" }, [
        row(
          "Page title",
          m("input.options-input", {
            type: "text",
            placeholder: "lerida",
            spellcheck: false,
            value: state.meta?.title ?? "",
            oninput: (event: InputEvent) => setTitle((event.target as HTMLInputElement).value),
            "data-role": "title-input",
          }),
        ),
      ]);
    },
  };
}
