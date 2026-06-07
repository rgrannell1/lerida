// Free text labels: editable divIcons that render inline markdown when not
// being edited and the raw source while focused.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { leaflet } from "./leaflet.ts";
import { renderMarkdown } from "../../markdown.ts";
import { state, syncToUrl } from "../../state.ts";
import { ui } from "../../ui.ts";
import { colorHex, DEFAULT_COLOR, DEFAULT_SIZE, fontSizeFor } from "../../features.ts";
import type { TextLabel } from "../../types.ts";
import { dropFrom, eraserActive } from "./editor.ts";
import { featureTarget, isEditable } from "./context.ts";

// The text label currently being edited, so the size palette can resize it.
let focusedText: { item: TextLabel; element: HTMLElement } | undefined;

// Apply a size to the text label currently being edited (if any). Called by the
// toolbar's size palette.
export function resizeFocusedText(sizeId: string): void {
  if (!focusedText) {
    return;
  }
  focusedText.item.size = sizeId;
  focusedText.element.style.fontSize = `${fontSizeFor(sizeId)}px`;
  // A not-yet-typed label isn't committed to the URL until it has text — don't
  // let a resize write an empty label (blur discards it).
  if (focusedText.item.text.trim().length > 0) {
    syncToUrl();
  }
}

// Commit a text label on blur: drop it if it ended up empty, then write the URL.
function commitText(textItem: TextLabel, layer: Leaflet.Marker): void {
  if (textItem.text.trim().length === 0) {
    state.texts = dropFrom(state.texts, textItem);
    layer.remove();
  }
  syncToUrl();
}

// Render a text label as an editable divIcon. `focus` puts the caret in it
// immediately (used when the label is freshly placed).
export function addTextLayer(map: Leaflet.Map, textItem: TextLabel, focus: boolean): void {
  const icon = leaflet.divIcon({
    className: "map-text-wrapper",
    html: `<div class="map-text"></div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
  const layer = leaflet.marker([textItem.lat, textItem.lng], { icon });
  layer.addTo(featureTarget(map));
  const wrapper = layer.getElement();
  const editable = wrapper?.querySelector(".map-text") as HTMLElement | null;
  if (!wrapper || !editable) {
    return;
  }
  wrapper.setAttribute("data-feature", "text");
  editable.dataset.role = "text-input";
  editable.innerHTML = renderMarkdown(textItem.text);
  editable.style.color = textItem.color ?? colorHex(DEFAULT_COLOR);
  editable.style.fontSize = `${fontSizeFor(textItem.size ?? DEFAULT_SIZE)}px`;
  // Clicks on the text shouldn't pan/zoom the map or place new features.
  leaflet.DomEvent.disableClickPropagation(wrapper);
  if (!isEditable()) {
    return;
  }
  editable.contentEditable = "true";
  editable.spellcheck = false;
  // Remove this label from state and the map.
  const removeTextItem = () => {
    if (focusedText?.item === textItem) {
      focusedText = undefined;
    }
    state.texts = dropFrom(state.texts, textItem);
    layer.remove();
    syncToUrl();
  };
  // The eraser tool removes a label on press (before it can focus for editing).
  editable.addEventListener("pointerdown", (event) => {
    if (eraserActive()) {
      event.preventDefault();
      removeTextItem();
    }
  });
  // Edit the raw markdown source on focus; show the rendered result on blur.
  editable.addEventListener("focus", () => {
    focusedText = { item: textItem, element: editable };
    editable.textContent = textItem.text;
  });
  editable.addEventListener("input", () => {
    textItem.text = editable.textContent ?? "";
    syncToUrl();
  });
  editable.addEventListener("blur", () => {
    if (focusedText?.element === editable) {
      focusedText = undefined;
    }
    editable.innerHTML = renderMarkdown(textItem.text);
    commitText(textItem, layer);
  });
  editable.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      editable.blur();
    }
  });
  wrapper.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    removeTextItem();
  });
  if (focus) {
    editable.focus();
  }
}

// Place an empty text label at the clicked point and focus it for typing. The
// URL is written once the user types (empty labels are discarded on blur).
export function placeText(map: Leaflet.Map, point: Leaflet.LatLng): void {
  const textItem: TextLabel = {
    lat: point.lat,
    lng: point.lng,
    text: "",
    color: colorHex(ui.selectedColor),
    size: ui.selectedSize,
  };
  state.texts = state.texts ?? [];
  state.texts.push(textItem);
  addTextLayer(map, textItem, true);
}
