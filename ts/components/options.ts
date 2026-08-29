// The options panel shown in the toolbar in place of the drawing tools (toggled
// by the header cog). Where the tool palettes place things *on* the map, this
// edits map-level meta settings carried in the URL: the browser page title and
// the read-only lock. Laid out as labelled rows so further meta operations slot
// in.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { state } from "../state.ts";
import { ui } from "../ui.ts";
import { clearFeatures } from "./map.ts";
import { optionsRow } from "./options-row.ts";
import { DOM_ATTRIBUTE } from "./dom-attributes.ts";
import {
  cancelLock,
  changeTitle,
  createOptionsState,
  lockMap,
  type OptionsState,
  startLock,
  toggleNumberedMode,
} from "./options-actions.ts";

function titleControl(): m.Vnode {
  return m("input.options-input", {
    type: "text",
    placeholder: "lerida",
    spellcheck: false,
    value: state.meta?.title ?? "",
    oninput: changeTitle,
    [DOM_ATTRIBUTE.role]: "title-input",
  });
}

function lockControl(live: OptionsState): m.Vnode {
  if (!live.confirmingLock) {
    return m("button.options-button", {
      onclick: startLock.bind(null, live),
      [DOM_ATTRIBUTE.action]: "lock",
    }, "Lock this map");
  }
  return m("div.lock-confirm", [
    m(
      "p.lock-warning",
      "Locking hides the toolbar. To edit again, remove editable=false from the URL.",
    ),
    m("div.lock-actions", [
      m("button.options-button", {
        onclick: cancelLock.bind(null, live),
        [DOM_ATTRIBUTE.action]: "lock-cancel",
      }, "Cancel"),
      m("button.options-button.danger", {
        onclick: lockMap.bind(null, live),
        [DOM_ATTRIBUTE.action]: "lock-confirm",
      }, "Lock"),
    ]),
  ]);
}

function numberedControl(): m.Vnode {
  return m("button.options-button", {
    onclick: toggleNumberedMode,
    [DOM_ATTRIBUTE.action]: "numbered-toggle",
    "data-active": ui.numberedMode ? "true" : "false",
  }, ui.numberedMode ? "Numbered: on" : "Numbered: off");
}

function optionsView(live: OptionsState): m.Vnode {
  const clearButton = m("button.options-button.danger", {
    onclick: clearFeatures,
    [DOM_ATTRIBUTE.action]: "clear",
  }, "Clear all");
  return m("div.options-panel", { [DOM_ATTRIBUTE.role]: "options" }, [
    optionsRow("Page title", titleControl()),
    optionsRow("Map", clearButton),
    optionsRow("Pins", numberedControl()),
    optionsRow("Access", lockControl(live)),
  ]);
}

export function Options(): m.Component {
  const live = createOptionsState();
  return { view: optionsView.bind(null, live) };
}
