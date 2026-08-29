// Feature labels, tooltips, and popup editor rendering.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { renderMarkdown } from "../../markdown.ts";
import { syncToUrl } from "../../state.ts";

export interface Labelled {
  label?: string;
  hoverLabel?: boolean;
}

export function applyTooltip(layer: Leaflet.Layer, target: Labelled): void {
  layer.unbindTooltip();
  const label = target.label;
  const hasLabel = label !== undefined && label.trim().length > 0;
  if (!hasLabel) {
    return;
  }
  layer.bindTooltip(renderMarkdown(label), {
    permanent: !target.hoverLabel,
    direction: "top",
  });
}

export class LabelEditor {
  target: Labelled;
  layer: Leaflet.Layer;
  remove: () => void;
  input: HTMLInputElement;

  constructor(target: Labelled, layer: Leaflet.Layer, remove: () => void) {
    this.target = target;
    this.layer = layer;
    this.remove = remove;
    this.input = document.createElement("input");
  }

  updateLabel(): void {
    const text = this.input.value;
    this.target.label = text.trim().length > 0 ? text : undefined;
    applyTooltip(this.layer, this.target);
    syncToUrl();
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    this.layer.closePopup();
  }

  makeDeleteButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "label-delete";
    button.dataset.role = "label-delete";
    button.title = "Delete";
    button.innerHTML = '<i class="fa fa-trash"></i>';
    button.addEventListener("click", this.remove);
    return button;
  }

  open(): void {
    this.input.type = "text";
    this.input.className = "marker-label-input";
    this.input.dataset.role = "label-input";
    this.input.spellcheck = false;
    this.input.placeholder = "Label";
    this.input.value = this.target.label ?? "";
    this.input.addEventListener("input", this.updateLabel.bind(this));
    this.input.addEventListener("keydown", this.handleKeyDown.bind(this));
    const editor = document.createElement("div");
    editor.className = "label-editor";
    editor.dataset.role = "label-editor";
    editor.append(this.input, this.makeDeleteButton());
    this.layer.unbindPopup();
    this.layer.bindPopup(editor).openPopup();
    this.input.focus();
  }
}
