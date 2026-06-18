// Toolbar: a tool selector (marker / line / polygon), a Font Awesome icon
// palette (for marker glyphs) and a colour swatch row. Clicking sets the active
// tool, or the icon / colour applied to new features. Selection is UI state
// (ts/ui.ts), not encoded in the URL.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import {
  type ColorSwatch,
  type Feature,
  FEATURES,
  LINE_WIDTHS,
  type LineWidth,
  MARKER_COLORS,
  TEXT_SIZES,
  type TextSize,
} from "../features.ts";
import { ui } from "../ui.ts";
import { state, syncToUrl } from "../state.ts";
import { applyTool } from "./map.ts";
import { clearSelection, selection } from "./map/selection.ts";
import { startToolbarDrag, toolbarStyle } from "./toolbar-drag.ts";
import { Options } from "./options.ts";
import { Share } from "./share.ts";

// One drawing tool: its id, the glyph shown, a hover/title label, and whether it
// is common enough to show before the "…" overflow toggle is expanded.
interface Tool {
  id: string;
  glyph: string;
  title: string;
  common?: boolean;
}

const TOOLS: Tool[] = [
  { id: "marker", glyph: "map-marker", title: "Marker", common: true },
  { id: "line", glyph: "minus", title: "Line", common: true },
  { id: "text", glyph: "font", title: "Text", common: true },
  { id: "eraser", glyph: "eraser", title: "Eraser", common: true },
  { id: "polygon", glyph: "square-o", title: "Polygon" },
];

function selectTool(id: string): void {
  ui.tool = id;
  applyTool();
}

function selectFeature(id: string): void {
  const channel = selection.current?.feature;
  if (channel) {
    channel.set(id);
  } else {
    ui.selectedFeature = id;
  }
}

function selectColor(name: string): void {
  // While a feature is selected the palette recolours it; otherwise it sets the
  // colour for the next feature placed.
  const channel = selection.current?.color;
  if (channel) {
    channel.set(name);
  } else {
    ui.selectedColor = name;
  }
}

function selectSize(id: string): void {
  const channel = selection.current?.size;
  if (channel) {
    channel.set(id);
  } else {
    ui.selectedSize = id;
  }
}

function selectWidth(px: number): void {
  const channel = selection.current?.width;
  if (channel) {
    channel.set(px);
  } else {
    ui.selectedWidth = px;
  }
}

function toggleArrows(): void {
  const channel = selection.current?.arrows;
  if (channel) {
    channel.set(!channel.get());
  } else {
    ui.selectedArrows = !ui.selectedArrows;
  }
}

function toggleMeasure(): void {
  const channel = selection.current?.measure;
  if (channel) {
    channel.set(!channel.get());
  } else {
    ui.selectedMeasure = !ui.selectedMeasure;
  }
}

function toggleShowAllFeatures(): void {
  ui.showAllFeatures = !ui.showAllFeatures;
}

function toggleShowAllTools(): void {
  ui.showAllTools = !ui.showAllTools;
}

function openAbout(): void {
  ui.showAbout = true;
}

// Toggle the options panel (page title + other meta settings). Opening it drops
// any feature selection and closes the share panel so one panel owns the toolbar
// body.
function toggleOptions(): void {
  ui.showOptions = !ui.showOptions;
  if (ui.showOptions) {
    ui.showShare = false;
    clearSelection();
  }
}

// Toggle the share panel (copy the render.png image link). Mutually exclusive
// with the options panel and any feature selection.
function toggleShare(): void {
  ui.showShare = !ui.showShare;
  if (ui.showShare) {
    ui.showOptions = false;
    clearSelection();
  }
}

// Render a Font Awesome glyph button (tool buttons), highlighted when active.
// `data` adds stable data-* attributes so the e2e tests can identify buttons
// without depending on Font Awesome / Leaflet class names.
function glyphButton(
  glyph: string,
  title: string,
  active: boolean,
  onclick: () => void,
  data: Record<string, string> = {},
): m.Vnode {
  const selector = active
    ? "button.icon-button.selected"
    : "button.icon-button";
  return m(selector, { title, onclick, ...data }, m(`i.fa.fa-${glyph}`));
}

function toolButton(tool: Tool): m.Vnode {
  return glyphButton(
    tool.glyph,
    tool.title,
    ui.tool === tool.id,
    () => selectTool(tool.id),
    {
      "data-tool": tool.id,
    },
  );
}

// Render a POI-category button showing its glyph, highlighted when selected.
function featureButton(feature: Feature): m.Vnode {
  const current = selection.current?.feature
    ? selection.current.feature.get()
    : ui.selectedFeature;
  const active = current === feature.id;
  return glyphButton(
    feature.icon,
    feature.name,
    active,
    () => selectFeature(feature.id),
    {
      "data-feature-id": feature.id,
    },
  );
}

// The "…" toggle that reveals / hides the less-common categories.
function moreFeaturesButton(): m.Vnode {
  return glyphButton(
    "ellipsis-h",
    "More categories",
    ui.showAllFeatures,
    toggleShowAllFeatures,
    {
      "data-action": "more-features",
    },
  );
}

// The "…" toggle that reveals / hides the less-common tools (polygon).
function moreToolsButton(): m.Vnode {
  return glyphButton(
    "ellipsis-h",
    "More tools",
    ui.showAllTools,
    toggleShowAllTools,
    {
      "data-action": "more-tools",
    },
  );
}

// A text-size button showing a scaled "A", highlighted when selected.
function sizeButton(size: TextSize): m.Vnode {
  const current = selection.current?.size
    ? selection.current.size.get()
    : ui.selectedSize;
  const active = current === size.id;
  const selector = active
    ? "button.icon-button.selected"
    : "button.icon-button";
  const letter = m(
    "span",
    { style: `font-size:${Math.min(size.px, 22)}px` },
    "A",
  );
  return m(selector, {
    title: size.name,
    // Keep the focused text label focused so the click can resize it.
    onmousedown: (event: MouseEvent) => event.preventDefault(),
    onclick: () => selectSize(size.id),
    "data-size": size.id,
  }, letter);
}

// A line-thickness button showing a bar at that stroke weight, highlighted when selected.
function widthButton(width: LineWidth): m.Vnode {
  const current = selection.current?.width
    ? selection.current.width.get()
    : ui.selectedWidth;
  const active = current === width.px;
  const selector = active
    ? "button.icon-button.selected"
    : "button.icon-button";
  const bar = m("span.width-bar", { style: `height:${width.px}px` });
  return m(selector, {
    title: width.name,
    onclick: () => selectWidth(width.px),
    "data-width": String(width.px),
  }, bar);
}

function colorButton(swatch: ColorSwatch): m.Vnode {
  // Highlight the selected feature's colour when editing one, else the default.
  const current = selection.current?.color
    ? selection.current.color.get()
    : ui.selectedColor;
  const selected = current === swatch.name;
  const selector = selected
    ? "button.color-button.selected"
    : "button.color-button";
  return m(selector, {
    title: swatch.name,
    style: `background:${swatch.hex}`,
    // Keep a focused text label focused so the click can recolour it.
    onmousedown: (event: MouseEvent) => event.preventDefault(),
    onclick: () => selectColor(swatch.name),
    "data-color": swatch.name,
  });
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
    "data-action": action,
  }, m(`i.fa.fa-${glyph}`));
}

export function Toolbar(): m.Component {
  return {
    view() {
      // Locked (read-only) maps show no toolbar at all.
      if (state.editable === false) {
        return null;
      }
      if (state.collapsed) {
        return m("div#toolbar.collapsed", {
          "data-role": "toolbar",
          "data-collapsed": "true",
          style: toolbarStyle(),
        }, toggleButton("sliders", "Show tools", "restore"));
      }
      // While a feature is selected the palettes target it — show those it
      // exposes; otherwise they follow the active tool (for the next feature).
      const sel = selection.current;
      const shows = (
        has: boolean,
        toolId: string,
      ) => (sel ? has : ui.tool === toolId);
      // Width, arrows and the measure toggle apply to the line tool (and to a
      // selected line).
      const showsLine = (has: boolean) =>
        sel ? has : ui.tool === "line";
      // Active non-common tool stays visible even when the overflow is collapsed.
      const shownTools = TOOLS.filter((tool) =>
        tool.common || ui.showAllTools || ui.tool === tool.id
      );
      const rows = [
        m("div.toolbar-header", { onpointerdown: startToolbarDrag }, [
          m("button.toolbar-title", {
            title: "About lerida",
            onclick: openAbout,
            "data-action": "about",
          }, "lerida"),
          m("div.toolbar-actions", [
            glyphButton("share-alt", "Share image", ui.showShare, toggleShare, {
              "data-action": "share",
            }),
            glyphButton("cog", "Options", ui.showOptions, toggleOptions, {
              "data-action": "options",
            }),
            toggleButton("chevron-up", "Minimise", "minimise"),
          ]),
        ]),
      ];
      // The options panel takes over the toolbar body, replacing the drawing
      // tools and their palettes with map-level meta settings.
      if (ui.showOptions) {
        rows.push(m(Options));
        return m("div#toolbar", {
          "data-role": "toolbar",
          style: toolbarStyle(),
        }, rows);
      }
      // The share panel likewise takes over the body, with the image link to copy.
      if (ui.showShare) {
        rows.push(m(Share));
        return m("div#toolbar", {
          "data-role": "toolbar",
          style: toolbarStyle(),
        }, rows);
      }
      // Editing a feature replaces the tool palette with a cue naming it; the
      // palettes below act on the selection. Closing its editor restores tools.
      if (sel) {
        rows.push(
          m("div.editing-banner", {
            "data-role": "editing",
            "data-editing": sel.kind,
          }, `Editing ${sel.kind}`),
        );
      } else {
        rows.push(
          m("div.palette.tool-palette", { "data-palette": "tool" }, [
            ...shownTools.map(toolButton),
            moreToolsButton(),
          ]),
        );
      }
      // The category palette applies to markers; size to text; width + arrows to
      // lines. Less-common categories hide behind a "…" toggle.
      if (shows(!!sel?.feature, "marker")) {
        const shown = FEATURES.filter((feature) =>
          feature.common || ui.showAllFeatures
        );
        rows.push(
          m("div.palette.feature-palette", {
            "data-palette": "feature",
          }, [...shown.map(featureButton), moreFeaturesButton()]),
        );
      }
      if (shows(!!sel?.size, "text")) {
        rows.push(
          m(
            "div.palette.size-palette",
            { "data-palette": "size" },
            TEXT_SIZES.map(sizeButton),
          ),
        );
      }
      if (showsLine(!!sel?.width)) {
        rows.push(
          m(
            "div.palette.width-palette",
            { "data-palette": "width" },
            LINE_WIDTHS.map(widthButton),
          ),
        );
      }
      if (showsLine(!!sel?.arrows)) {
        const arrowsActive = sel?.arrows ? sel.arrows.get() : ui.selectedArrows;
        const arrowsBtn = glyphButton(
          "long-arrow-right",
          "Directional arrows",
          arrowsActive,
          toggleArrows,
          { "data-action": "arrows" },
        );
        rows.push(
          m(
            "div.palette.arrows-palette",
            { "data-palette": "arrows" },
            arrowsBtn,
          ),
        );
      }
      if (showsLine(!!sel?.measure)) {
        const measureActive = sel?.measure
          ? sel.measure.get()
          : ui.selectedMeasure;
        const measureBtn = glyphButton(
          "arrows-h",
          "Measure distances",
          measureActive,
          toggleMeasure,
          { "data-action": "measure" },
        );
        rows.push(
          m(
            "div.palette.measure-palette",
            { "data-palette": "measure" },
            measureBtn,
          ),
        );
      }
      // Colour applies to any selection and to every feature-creating tool (not the eraser).
      if (sel ? !!sel.color : ui.tool !== "eraser") {
        rows.push(
          m("div.palette.color-palette", {
            "data-palette": "color",
          }, MARKER_COLORS.map(colorButton)),
        );
      }
      return m("div#toolbar", {
        "data-role": "toolbar",
        "data-editing": sel?.kind ?? "",
        style: toolbarStyle(),
      }, rows);
    },
  };
}
