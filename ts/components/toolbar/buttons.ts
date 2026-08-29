// Toolbar button views for drawing tools and marker categories.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import type {
  ColorSwatch,
  Feature,
  LineWidth,
  TextSize,
} from "../../features.ts";
import { ui } from "../../ui.ts";
import { selection } from "../map/selection.ts";
import { DOM_ATTRIBUTE } from "../dom-attributes.ts";
import {
  selectFeature,
  selectColor,
  selectSize,
  selectTool,
  selectWidth,
  toggleFeatureOverflow,
  toggleToolOverflow,
} from "./actions.ts";

export interface Tool {
  id: string;
  glyph: string;
  title: string;
  common?: boolean;
}

export const TOOLS: Tool[] = [
  { id: "marker", glyph: "map-marker", title: "Marker", common: true },
  { id: "line", glyph: "minus", title: "Line", common: true },
  { id: "text", glyph: "font", title: "Text", common: true },
  { id: "eraser", glyph: "eraser", title: "Eraser", common: true },
  { id: "polygon", glyph: "square-o", title: "Polygon" },
];

export function glyphButton(
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

export function toolButton(tool: Tool): m.Vnode {
  return glyphButton(
    tool.glyph,
    tool.title,
    ui.tool === tool.id,
    () => selectTool(tool.id),
    { "data-tool": tool.id },
  );
}

export function featureButton(feature: Feature): m.Vnode {
  const current = selection.current?.feature
    ? selection.current.feature.get()
    : ui.selectedFeature;
  return glyphButton(
    feature.icon,
    feature.name,
    current === feature.id,
    () => selectFeature(feature.id),
    { "data-feature-id": feature.id },
  );
}

export function moreFeaturesButton(): m.Vnode {
  return glyphButton(
    "ellipsis-h",
    "More categories",
    ui.showAllFeatures,
    toggleFeatureOverflow,
    { [DOM_ATTRIBUTE.action]: "more-features" },
  );
}

export function moreToolsButton(): m.Vnode {
  return glyphButton(
    "ellipsis-h",
    "More tools",
    ui.showAllTools,
    toggleToolOverflow,
    { [DOM_ATTRIBUTE.action]: "more-tools" },
  );
}

export function sizeButton(size: TextSize): m.Vnode {
  const current = selection.current?.size
    ? selection.current.size.get()
    : ui.selectedSize;
  const selector = current === size.id
    ? "button.icon-button.selected"
    : "button.icon-button";
  const letter = m("span", {
    style: `font-size:${Math.min(size.px, 22)}px`,
  }, "A");
  return m(selector, {
    title: size.name,
    onmousedown: (event: MouseEvent) => event.preventDefault(),
    onclick: () => selectSize(size.id),
    "data-size": size.id,
  }, letter);
}

export function widthButton(width: LineWidth): m.Vnode {
  const current = selection.current?.width
    ? selection.current.width.get()
    : ui.selectedWidth;
  const selector = current === width.px
    ? "button.icon-button.selected"
    : "button.icon-button";
  const bar = m("span.width-bar", { style: `height:${width.px}px` });
  return m(selector, {
    title: width.name,
    onclick: () => selectWidth(width.px),
    "data-width": String(width.px),
  }, bar);
}

export function colorButton(swatch: ColorSwatch): m.Vnode {
  const current = selection.current?.color
    ? selection.current.color.get()
    : ui.selectedColor;
  const selector = current === swatch.name
    ? "button.color-button.selected"
    : "button.color-button";
  return m(selector, {
    title: swatch.name,
    style: `background:${swatch.hex}`,
    onmousedown: (event: MouseEvent) => event.preventDefault(),
    onclick: () => selectColor(swatch.name),
    "data-color": swatch.name,
  });
}
