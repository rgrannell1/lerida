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
  MARKER_COLORS,
  type TextSize,
  TEXT_SIZES,
} from "../features.ts";
import { ui } from "../ui.ts";
import { state, syncToUrl } from "../state.ts";
import { applyTool, clearFeatures } from "./map.ts";
import { resizeFocusedText } from "./map/text.ts";

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
  ui.selectedFeature = id;
}

function selectColor(name: string): void {
  ui.selectedColor = name;
}

function selectSize(id: string): void {
  ui.selectedSize = id;
  // Also resize the text label currently being edited, if any.
  resizeFocusedText(id);
}

function toggleArrows(): void {
  ui.selectedArrows = !ui.selectedArrows;
}

function toggleShowAllFeatures(): void {
  ui.showAllFeatures = !ui.showAllFeatures;
}

function toggleShowAllTools(): void {
  ui.showAllTools = !ui.showAllTools;
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
  const selector = active ? "button.icon-button.selected" : "button.icon-button";
  return m(selector, { title, onclick, ...data }, m(`i.fa.fa-${glyph}`));
}

function toolButton(tool: Tool): m.Vnode {
  return glyphButton(tool.glyph, tool.title, ui.tool === tool.id, () => selectTool(tool.id), {
    "data-tool": tool.id,
  });
}

// Render a POI-category button showing its glyph, highlighted when selected.
function featureButton(feature: Feature): m.Vnode {
  const active = ui.selectedFeature === feature.id;
  return glyphButton(feature.icon, feature.name, active, () => selectFeature(feature.id), {
    "data-feature-id": feature.id,
  });
}

// The "…" toggle that reveals / hides the less-common categories.
function moreFeaturesButton(): m.Vnode {
  return glyphButton("ellipsis-h", "More categories", ui.showAllFeatures, toggleShowAllFeatures, {
    "data-action": "more-features",
  });
}

// The "…" toggle that reveals / hides the less-common tools (polygon).
function moreToolsButton(): m.Vnode {
  return glyphButton("ellipsis-h", "More tools", ui.showAllTools, toggleShowAllTools, {
    "data-action": "more-tools",
  });
}

// A text-size button showing a scaled "A", highlighted when selected.
function sizeButton(size: TextSize): m.Vnode {
  const active = ui.selectedSize === size.id;
  const selector = active ? "button.icon-button.selected" : "button.icon-button";
  const letter = m("span", { style: `font-size:${Math.min(size.px, 22)}px` }, "A");
  return m(selector, {
    title: size.name,
    // Keep the focused text label focused so the click can resize it.
    onmousedown: (event: MouseEvent) => event.preventDefault(),
    onclick: () => selectSize(size.id),
    "data-size": size.id,
  }, letter);
}

function colorButton(swatch: ColorSwatch): m.Vnode {
  const selected = ui.selectedColor === swatch.name;
  const selector = selected ? "button.color-button.selected" : "button.color-button";
  return m(selector, {
    title: swatch.name,
    style: `background:${swatch.hex}`,
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
        return m("div#toolbar.collapsed", { "data-role": "toolbar", "data-collapsed": "true" },
          toggleButton("sliders", "Show tools", "restore"));
      }
      // Active non-common tool stays visible even when the overflow is collapsed.
      const shownTools = TOOLS.filter((tool) =>
        tool.common || ui.showAllTools || ui.tool === tool.id
      );
      const rows = [
        m("div.toolbar-header", [
          m("span.toolbar-title", "Lerida"),
          m("div.toolbar-actions", [
            glyphButton("trash", "Clear all", false, clearFeatures, { "data-action": "clear" }),
            toggleButton("chevron-up", "Minimise", "minimise"),
          ]),
        ]),
        m("div.palette.tool-palette", { "data-palette": "tool" }, [
          ...shownTools.map(toolButton),
          moreToolsButton(),
        ]),
      ];
      // The category palette only applies to markers; the size palette to text.
      // Less-common categories hide behind a "…" toggle.
      if (ui.tool === "marker") {
        const shown = FEATURES.filter((feature) => feature.common || ui.showAllFeatures);
        rows.push(
          m("div.palette.feature-palette", {
            "data-palette": "feature",
          }, [...shown.map(featureButton), moreFeaturesButton()]),
        );
      }
      if (ui.tool === "text") {
        rows.push(
          m("div.palette.size-palette", { "data-palette": "size" }, TEXT_SIZES.map(sizeButton)),
        );
      }
      // The line tool offers a directional-arrows toggle.
      if (ui.tool === "line") {
        const arrowsBtn = glyphButton(
          "long-arrow-right",
          "Directional arrows",
          ui.selectedArrows,
          toggleArrows,
          { "data-action": "arrows" },
        );
        rows.push(m("div.palette.arrows-palette", { "data-palette": "arrows" }, arrowsBtn));
      }
      // Colour applies to every tool that creates a feature — but not the eraser.
      if (ui.tool !== "eraser") {
        rows.push(
          m("div.palette.color-palette", {
            "data-palette": "color",
          }, MARKER_COLORS.map(colorButton)),
        );
      }
      return m("div#toolbar", { "data-role": "toolbar" }, rows);
    },
  };
}
