// Tool control: Geoman draw mode, the Escape-to-finish gesture, and clearing all
// features.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { geoman, type GeomanDrawOptions } from "./leaflet.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { colorHex } from "../../features.ts";
import { isEditable, mapContext } from "./context.ts";

// Style new shapes in the selected colour while drawing.
function drawOptions(): GeomanDrawOptions {
  const style = { color: colorHex(ui.selectedColor) };
  return { templineStyle: style, hintlineStyle: style, pathOptions: style };
}

// Switch Geoman draw mode to match the toolbar's active tool.
export function applyTool(): void {
  const map = mapContext.map;
  if (!map) {
    return;
  }
  const pm = geoman(map);
  if (!pm) {
    return;
  }
  pm.disableDraw();
  if (ui.tool === "line") {
    pm.enableDraw("Line", drawOptions());
  } else if (ui.tool === "polygon") {
    pm.enableDraw("Polygon", drawOptions());
  }
}

// Escape while drawing: commit the in-progress line/polygon (Geoman fires
// pm:create) and return to the marker tool.
function finishDrawingToMarker(): void {
  const map = mapContext.map;
  if (!map) {
    return;
  }
  const shapeName = ui.tool === "line" ? "Line" : "Polygon";
  const draw = geoman(map)?.Draw?.[shapeName];
  if (draw?._finishShape) {
    try {
      draw._finishShape();
    } catch {
      // Too few vertices to finish — fall through and just cancel the shape.
    }
  }
  ui.tool = "marker";
  applyTool();
  m.redraw();
}

// Remove every marker, line, polygon and text label from the map and the URL.
export function clearFeatures(): void {
  mapContext.featureLayers?.clearLayers();
  state.markers = [];
  state.lines = [];
  state.polygons = [];
  state.texts = [];
  syncToUrl();
}

// Document-level key handler: Escape finishes an in-progress line/polygon.
export function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !isEditable()) {
    return;
  }
  if (ui.tool === "line" || ui.tool === "polygon") {
    finishDrawingToMarker();
  }
}
