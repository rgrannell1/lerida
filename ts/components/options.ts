// The options panel shown in the toolbar in place of the drawing tools (toggled
// by the header cog). Where the tool palettes place things *on* the map, this
// edits map-level meta settings carried in the URL: the browser page title and
// the read-only lock. Laid out as labelled rows so further meta operations slot
// in.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { state, syncToUrl } from "../state.ts";
import { ui } from "../ui.ts";
import { clearFeatures, rerenderFeatures } from "./map.ts";

// Write the page title into meta (and the live document title), then sync the
// URL. An empty title drops back to the "lerida" default and, since the snapshot
// omits a blank title, leaves no meta in the URL.
function setTitle(value: string): void {
  const title = value.trim();
  state.meta = { ...state.meta, title };
  document.title = title || "lerida";
  syncToUrl();
}

// Lock the map: editable=false hides the whole toolbar (so the read-only share
// link is chrome-free). There is no in-app way back by design; the confirm step
// warns that re-editing means removing editable=false from the URL.
function lockMap(): void {
  state.editable = false;
  ui.showOptions = false;
  syncToUrl();
  // Re-render so features placed while editable lose their editor popups and
  // editable text and become read-only like a freshly-loaded locked map.
  rerenderFeatures();
}

// One labelled settings row: a caption above its control.
function row(label: string, control: m.Vnode): m.Vnode {
  return m("label.options-row", [m("span.options-label", label), control]);
}

export function Options(): m.Component {
  // Two-step lock confirmation, transient to this open panel.
  let confirming = false;
  return {
    view() {
      const titleRow = row(
        "Page title",
        m("input.options-input", {
          type: "text",
          placeholder: "lerida",
          spellcheck: false,
          value: state.meta?.title ?? "",
          oninput: (event: InputEvent) => setTitle((event.target as HTMLInputElement).value),
          "data-role": "title-input",
        }),
      );
      const lockControl = confirming
        ? m("div.lock-confirm", [
          m(
            "p.lock-warning",
            "Locking hides the toolbar. To edit again, remove editable=false from the URL.",
          ),
          m("div.lock-actions", [
            m("button.options-button", {
              onclick: () => {
                confirming = false;
              },
              "data-action": "lock-cancel",
            }, "Cancel"),
            m("button.options-button.danger", {
              onclick: lockMap,
              "data-action": "lock-confirm",
            }, "Lock"),
          ]),
        ])
        : m("button.options-button", {
          onclick: () => {
            confirming = true;
          },
          "data-action": "lock",
        }, "Lock this map");
      return m("div.options-panel", { "data-role": "options" }, [
        titleRow,
        row(
          "Map",
          m("button.options-button.danger", {
            onclick: clearFeatures,
            "data-action": "clear",
          }, "Clear all"),
        ),
        row("Access", lockControl),
      ]);
    },
  };
}
