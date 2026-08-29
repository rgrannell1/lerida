// Editable text behaviour and toolbar selection binding.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import {
  colorHex,
  DEFAULT_SIZE,
  fontSizeFor,
  swatchName,
} from "../../features.ts";
import { renderMarkdown } from "../../markdown.ts";
import { state, syncToUrl } from "../../state.ts";
import type { TextLabel } from "../../types.ts";
import { dropFrom } from "../../commons/array.ts";
import { eraserActive } from "./editor.ts";
import { clearSelection, select, type Selection } from "./selection.ts";

export class TextEditor {
  textItem: TextLabel;
  layer: Leaflet.Marker;
  editable: HTMLElement;

  constructor(
    textItem: TextLabel,
    layer: Leaflet.Marker,
    editable: HTMLElement,
  ) {
    this.textItem = textItem;
    this.layer = layer;
    this.editable = editable;
  }

  syncIfTyped(): void {
    if (this.textItem.text.trim().length > 0) {
      syncToUrl();
    }
  }

  setColor(name: string): void {
    this.textItem.color = colorHex(name);
    this.editable.style.color = this.textItem.color;
    this.syncIfTyped();
  }

  setSize(id: string): void {
    this.textItem.size = id;
    this.editable.style.fontSize = `${fontSizeFor(id)}px`;
    this.syncIfTyped();
  }

  buildSelection(): Selection {
    return {
      kind: "text",
      layer: this.layer,
      color: {
        get: swatchName.bind(null, this.textItem.color),
        set: this.setColor.bind(this),
      },
      size: {
        get: () => this.textItem.size ?? DEFAULT_SIZE,
        set: this.setSize.bind(this),
      },
    };
  }

  remove(): void {
    clearSelection(this.layer);
    state.texts = dropFrom(state.texts, this.textItem);
    this.layer.remove();
    syncToUrl();
  }

  handlePointerDown(event: PointerEvent): void {
    if (!eraserActive()) {
      return;
    }
    event.preventDefault();
    this.remove();
  }

  handleFocus(): void {
    select(this.buildSelection());
    this.editable.textContent = this.textItem.text;
  }

  handleInput(): void {
    this.textItem.text = this.editable.textContent ?? "";
    syncToUrl();
  }

  handleBlur(): void {
    clearSelection(this.layer);
    this.editable.innerHTML = renderMarkdown(this.textItem.text);
    if (this.textItem.text.trim().length === 0) {
      state.texts = dropFrom(state.texts, this.textItem);
      this.layer.remove();
    }
    syncToUrl();
  }

  handleKeyDown(event: KeyboardEvent): void {
    const commitsText = event.key === "Enter" && !event.shiftKey;
    if (!commitsText) {
      return;
    }
    event.preventDefault();
    this.editable.blur();
  }

  handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.remove();
  }

  wire(): void {
    this.editable.addEventListener("pointerdown", this.handlePointerDown.bind(this));
    this.editable.addEventListener("focus", this.handleFocus.bind(this));
    this.editable.addEventListener("input", this.handleInput.bind(this));
    this.editable.addEventListener("blur", this.handleBlur.bind(this));
    this.editable.addEventListener("keydown", this.handleKeyDown.bind(this));
    this.layer.getElement()?.addEventListener(
      "contextmenu",
      this.handleContextMenu.bind(this),
    );
  }
}
