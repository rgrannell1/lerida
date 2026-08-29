// Toolbar: a tool selector (marker / line / polygon), a Font Awesome icon
// palette (for marker glyphs) and a colour swatch row. Clicking sets the active
// tool, or the icon / colour applied to new features. Selection is UI state
// (ts/ui.ts), not encoded in the URL.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { ui } from "../ui.ts";
import { state, syncToUrl } from "../state.ts";
import { clearSelection, selection } from "./map/selection.ts";
import { startToolbarDrag, toolbarStyle } from "./toolbar-drag.ts";
import { Options } from "./options.ts";
import { Share } from "./share.ts";
import {
  openAbout,
  toggleOptions,
} from "./toolbar/actions.ts";
import {
  glyphButton,
} from "./toolbar/buttons.ts";
import { toolbarPalettes } from "./toolbar/palettes.ts";
import { DOM_ATTRIBUTE } from "./dom-attributes.ts";

// Toggle the share panel (copy the render.png image link). Mutually exclusive
// with the options panel and any feature selection.
function toggleShare(): void {
  ui.showShare = !ui.showShare;
  if (ui.showShare) {
    ui.showOptions = false;
    clearSelection();
  }
}

// Toggle the minimised state; reflected in the URL via syncToUrl.
function toggleCollapsed(): void {
  state.collapsed = !state.collapsed;
  syncToUrl();
}

// A button that minimises / restores the toolbar. `action` ("minimise" /
// "restore") is exposed as data-action for the tests.
function toggleButton(glyph: string, title: string, action: string): m.Vnode {
  return m("button.icon-button", {
    title,
    onclick: toggleCollapsed,
    [DOM_ATTRIBUTE.action]: action,
  }, m(`i.fa.fa-${glyph}`));
}

function toolbarHeader(): m.Vnode {
  return m("div.toolbar-header", { onpointerdown: startToolbarDrag }, [
    m("button.toolbar-title", {
      title: "About lerida",
      onclick: openAbout,
      [DOM_ATTRIBUTE.action]: "about",
    }, "lerida"),
    m("div.toolbar-actions", [
      glyphButton("share-alt", "Share image", ui.showShare, toggleShare, {
        [DOM_ATTRIBUTE.action]: "share",
      }),
      glyphButton("cog", "Options", ui.showOptions, toggleOptions, {
        [DOM_ATTRIBUTE.action]: "options",
      }),
      toggleButton("chevron-up", "Minimise", "minimise"),
    ]),
  ]);
}

function collapsedToolbar(): m.Vnode {
  return m("div#toolbar.collapsed", {
    [DOM_ATTRIBUTE.role]: "toolbar",
    "data-collapsed": "true",
    style: toolbarStyle(),
  }, toggleButton("sliders", "Show tools", "restore"));
}

function toolbarFrame(rows: m.Vnode[], editing = ""): m.Vnode {
  return m("div#toolbar", {
    [DOM_ATTRIBUTE.role]: "toolbar",
    "data-editing": editing,
    style: toolbarStyle(),
  }, rows);
}

export function Toolbar(): m.Component {
  return {
    view() {
      // Locked (read-only) maps show no toolbar at all.
      if (state.editable === false) {
        return null;
      }
      if (state.collapsed) {
        return collapsedToolbar();
      }
      const sel = selection.current;
      const rows = [toolbarHeader()];
      // The options panel takes over the toolbar body, replacing the drawing
      // tools and their palettes with map-level meta settings.
      if (ui.showOptions) {
        rows.push(m(Options));
        return toolbarFrame(rows);
      }
      // The share panel likewise takes over the body, with the image link to copy.
      if (ui.showShare) {
        rows.push(m(Share));
        return toolbarFrame(rows);
      }
      rows.push(...toolbarPalettes());
      return toolbarFrame(rows, sel?.kind ?? "");
    },
  };
}
