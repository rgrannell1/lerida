// Shared label, tooltip and removal handlers reused across markers, lines and
// polygons.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { renderMarkdown } from "../../markdown.ts";
import { isEditable, mapContext } from "./context.ts";
import { clearSelection, select, type Selection } from "./selection.ts";

// True when the eraser tool is active: clicking any feature removes it instead
// of editing it. The single source of the eraser rule, shared by every feature
// type's interaction handler.
export function eraserActive(): boolean {
  return ui.tool === "eraser";
}

// Any feature carrying a text label.
export interface Labelled {
  label?: string;
}

// Bind (or clear) a feature's permanent label tooltip from its current label.
// Leaflet renders a string tooltip via innerHTML, and the label arrives from the
// (shareable) URL, so it must be sanitised first — renderMarkdown runs it through
// DOMPurify, matching how text labels are rendered.
export function applyTooltip(layer: Leaflet.Layer, target: Labelled): void {
  layer.unbindTooltip();
  const label = target.label;
  if (label && label.trim().length > 0) {
    layer.bindTooltip(renderMarkdown(label), {
      permanent: true,
      direction: "top",
    });
  }
}

// Update a feature's label from editor input, refresh tooltip, write the URL.
function setLabel(target: Labelled, layer: Leaflet.Layer, text: string): void {
  target.label = text.trim().length > 0 ? text : undefined;
  applyTooltip(layer, target);
  syncToUrl();
}

// Open a popup with a text field bound to the feature's label, plus a delete
// button. The field syncs the label live; Enter commits (closes the popup);
// the delete button removes the feature.
export function openEditor(
  target: Labelled,
  layer: Leaflet.Layer,
  remove: () => void,
): void {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "marker-label-input";
  input.dataset.role = "label-input";
  input.spellcheck = false;
  input.placeholder = "Label";
  input.value = target.label ?? "";
  input.addEventListener("input", () => setLabel(target, layer, input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      layer.closePopup();
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "label-delete";
  deleteButton.dataset.role = "label-delete";
  deleteButton.title = "Delete";
  deleteButton.innerHTML = '<i class="fa fa-trash"></i>';
  deleteButton.addEventListener("click", remove);

  const editor = document.createElement("div");
  editor.className = "label-editor";
  editor.dataset.role = "label-editor";
  editor.append(input, deleteButton);

  layer.unbindPopup();
  layer.bindPopup(editor).openPopup();
  input.focus();
}

// Return a copy of `items` without `item` (identity match).
export function dropFrom<Item>(items: Item[] | undefined, item: Item): Item[] {
  return (items ?? []).filter((each) => each !== item);
}

// Tag a feature's rendered element with data-feature so the e2e tests (and any
// external tooling) can select it without depending on Leaflet / AwesomeMarkers
// class names. Markers and text expose getElement(); vector paths (line /
// polygon) render as an SVG element at `_path`. Call after the layer is added.
export function markElement(layer: Leaflet.Layer, kind: string): void {
  const candidate = layer as unknown as {
    getElement?: () => Element | null | undefined;
    _path?: SVGElement;
  };
  const fromMarker = typeof candidate.getElement === "function"
    ? candidate.getElement()
    : undefined;
  const element = fromMarker ?? candidate._path;
  element?.setAttribute("data-feature", kind);
}

// Wire a feature layer: tooltip, tap-to-edit, and right-click / long-press remove.
// Vector features (consumesClick) also flag the click so the map handler skips
// placing a marker on top of them.
// `buildSelection` (optional) yields the property bindings the toolbar palettes
// edit while this feature's editor is open; the selection clears on popup close.
export function wireFeature(
  layer: Leaflet.Layer,
  target: Labelled,
  remove: () => void,
  consumesClick: boolean,
  buildSelection?: () => Selection,
): void {
  applyTooltip(layer, target);
  layer.on("popupclose", () => clearSelection(layer));
  layer.on("click", (event) => {
    if (!isEditable()) {
      return;
    }
    // The eraser tool removes the feature instead of opening its editor.
    if (eraserActive()) {
      remove();
      return;
    }
    if (consumesClick) {
      mapContext.consumedClick =
        (event as Leaflet.LeafletMouseEvent).originalEvent;
    }
    openEditor(target, layer, remove);
    if (buildSelection) {
      select(buildSelection());
    }
  });
  layer.on("contextmenu", (event) => {
    if (!isEditable()) {
      return;
    }
    (event as Leaflet.LeafletMouseEvent).originalEvent.preventDefault();
    remove();
  });
}
