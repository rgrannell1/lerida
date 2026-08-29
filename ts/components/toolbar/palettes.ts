// Toolbar palette views selected by the active tool or edited feature.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { FEATURES, LINE_WIDTHS, MARKER_COLORS, TEXT_SIZES } from "../../features.ts";
import { ui } from "../../ui.ts";
import { selection } from "../map/selection.ts";
import { DOM_ATTRIBUTE } from "../dom-attributes.ts";
import {
  toggleArrows,
  toggleHoverLabel,
  toggleMeasure,
} from "./actions.ts";
import {
  colorButton,
  featureButton,
  glyphButton,
  moreFeaturesButton,
  moreToolsButton,
  sizeButton,
  toolButton,
  TOOLS,
  widthButton,
} from "./buttons.ts";

function showsPalette(hasChannel: boolean, toolId: string): boolean {
  const selected = selection.current;
  return selected ? hasChannel : ui.tool === toolId;
}

function isShownTool(tool: typeof TOOLS[number]): boolean {
  return tool.common === true || ui.showAllTools || ui.tool === tool.id;
}

function toolPalette(): m.Vnode {
  const selected = selection.current;
  if (selected) {
    return m("div.editing-banner", {
      [DOM_ATTRIBUTE.role]: "editing",
      "data-editing": selected.kind,
    }, `Editing ${selected.kind}`);
  }
  const tools = TOOLS.filter(isShownTool);
  return m("div.palette.tool-palette", { [DOM_ATTRIBUTE.palette]: "tool" }, [
    ...tools.map(toolButton),
    moreToolsButton(),
  ]);
}

function appendFeaturePalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsFeatures = showsPalette(!!selected?.feature, "marker");
  if (!showsFeatures) {
    return;
  }
  const features = FEATURES.filter((feature) => {
    return feature.common === true || ui.showAllFeatures;
  });
  rows.push(m("div.palette.feature-palette", {
    [DOM_ATTRIBUTE.palette]: "feature",
  }, [...features.map(featureButton), moreFeaturesButton()]));
}

function appendHoverPalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsHover = showsPalette(!!selected?.hoverLabel, "marker");
  if (!showsHover) {
    return;
  }
  const active = selected?.hoverLabel
    ? selected.hoverLabel.get()
    : ui.selectedHoverLabel;
  const button = glyphButton(
    "eye",
    "Label on hover only",
    active,
    toggleHoverLabel,
    { [DOM_ATTRIBUTE.action]: "hover-label" },
  );
  rows.push(m("div.palette.hover-label-palette", {
    [DOM_ATTRIBUTE.palette]: "hover-label",
  }, button));
}

function appendSizePalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsSize = showsPalette(!!selected?.size, "text");
  if (!showsSize) {
    return;
  }
  rows.push(m("div.palette.size-palette", {
    [DOM_ATTRIBUTE.palette]: "size",
  }, TEXT_SIZES.map(sizeButton)));
}

function showsLinePalette(hasChannel: boolean): boolean {
  const selected = selection.current;
  return selected ? hasChannel : ui.tool === "line";
}

function appendWidthPalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsWidth = showsLinePalette(!!selected?.width);
  if (!showsWidth) {
    return;
  }
  rows.push(m("div.palette.width-palette", {
    [DOM_ATTRIBUTE.palette]: "width",
  }, LINE_WIDTHS.map(widthButton)));
}

function appendArrowsPalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsArrows = showsLinePalette(!!selected?.arrows);
  if (!showsArrows) {
    return;
  }
  const active = selected?.arrows
    ? selected.arrows.get()
    : ui.selectedArrows;
  const button = glyphButton(
    "long-arrow-right",
    "Directional arrows",
    active,
    toggleArrows,
    { [DOM_ATTRIBUTE.action]: "arrows" },
  );
  rows.push(m("div.palette.arrows-palette", {
    [DOM_ATTRIBUTE.palette]: "arrows",
  }, button));
}

function appendMeasurePalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsMeasure = showsLinePalette(!!selected?.measure);
  if (!showsMeasure) {
    return;
  }
  const active = selected?.measure
    ? selected.measure.get()
    : ui.selectedMeasure;
  const button = glyphButton(
    "arrows-h",
    "Measure distances",
    active,
    toggleMeasure,
    { [DOM_ATTRIBUTE.action]: "measure" },
  );
  rows.push(m("div.palette.measure-palette", {
    [DOM_ATTRIBUTE.palette]: "measure",
  }, button));
}

function appendColorPalette(rows: m.Vnode[]): void {
  const selected = selection.current;
  const showsColor = selected ? !!selected.color : ui.tool !== "eraser";
  if (!showsColor) {
    return;
  }
  rows.push(m("div.palette.color-palette", {
    [DOM_ATTRIBUTE.palette]: "color",
  }, MARKER_COLORS.map(colorButton)));
}

export function toolbarPalettes(): m.Vnode[] {
  const rows = [toolPalette()];
  appendFeaturePalette(rows);
  appendHoverPalette(rows);
  appendSizePalette(rows);
  appendWidthPalette(rows);
  appendArrowsPalette(rows);
  appendMeasurePalette(rows);
  appendColorPalette(rows);
  return rows;
}
