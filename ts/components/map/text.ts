// Free text labels: editable divIcons that render inline markdown when not
// being edited and the raw source while focused.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { leaflet } from "./leaflet.ts";
import { renderMarkdown } from "../../markdown.ts";
import { state } from "../../state.ts";
import { ui } from "../../ui.ts";
import {
  colorHex,
  DEFAULT_COLOR,
  DEFAULT_SIZE,
  fontSizeFor,
} from "../../features.ts";
import type { TextLabel } from "../../types.ts";
import { featureTarget, isEditable } from "./context.ts";
import { TextEditor } from "./text-editor.ts";

function textIcon(): Leaflet.DivIcon {
  return leaflet.divIcon({
    className: "map-text-wrapper",
    html: `<div class="map-text"></div>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function configureTextElement(
  wrapper: HTMLElement,
  editable: HTMLElement,
  textItem: TextLabel,
): void {
  wrapper.setAttribute("data-feature", "text");
  editable.dataset.role = "text-input";
  editable.innerHTML = renderMarkdown(textItem.text);
  editable.style.color = textItem.color ?? colorHex(DEFAULT_COLOR);
  editable.style.fontSize = `${fontSizeFor(textItem.size ?? DEFAULT_SIZE)}px`;
  leaflet.DomEvent.disableClickPropagation(wrapper);
}

// Render a text label as an editable divIcon. `focus` puts the caret in it
// immediately (used when the label is freshly placed).
export function addTextLayer(
  map: Leaflet.Map,
  textItem: TextLabel,
  focus: boolean,
): void {
  const layer = leaflet.marker([textItem.lat, textItem.lng], {
    icon: textIcon(),
  });
  layer.addTo(featureTarget(map));
  const wrapper = layer.getElement();
  const editable = wrapper?.querySelector(".map-text") as HTMLElement | null;
  const lacksElement = !wrapper || !editable;
  if (lacksElement) {
    return;
  }
  configureTextElement(wrapper, editable, textItem);
  if (!isEditable()) {
    return;
  }
  editable.contentEditable = "true";
  editable.spellcheck = false;
  const editor = new TextEditor(textItem, layer, editable);
  editor.wire();
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
