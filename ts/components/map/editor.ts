// Shared label, tooltip and removal handlers reused across markers, lines and
// polygons.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { ui } from "../../ui.ts";
import { isEditable, mapContext } from "./context.ts";
import { clearSelection, select, type Selection } from "./selection.ts";
import {
  applyTooltip,
  LabelEditor,
  type Labelled,
} from "./label-editor.ts";

export { applyTooltip } from "./label-editor.ts";

// True when the eraser tool is active: clicking any feature removes it instead
// of editing it. The single source of the eraser rule, shared by every feature
// type's interaction handler.
export function eraserActive(): boolean {
  return ui.tool === "eraser";
}

// Any feature carrying a text label. `hoverLabel` is marker-only (lines/polygons
// never set it) and, when true, makes the tooltip show on hover instead of
// permanently; threading it through the target keeps setLabel and re-binds
// honouring the flag without a separate source of truth.
// Open a popup with a text field bound to the feature's label, plus a delete
// button. The field syncs the label live; Enter commits (closes the popup);
// the delete button removes the feature.
export function openEditor(
  target: Labelled,
  layer: Leaflet.Layer,
  remove: () => void,
): void {
  const editor = new LabelEditor(target, layer, remove);
  editor.open();
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

interface FeatureWireOptions {
  layer: Leaflet.Layer;
  target: Labelled;
  remove: () => void;
  consumesClick: boolean;
  buildSelection?: () => Selection;
}

class FeatureEvents {
  options: FeatureWireOptions;

  constructor(options: FeatureWireOptions) {
    this.options = options;
  }

  closePopup(): void {
    clearSelection(this.options.layer);
  }

  click(event: Leaflet.LeafletEvent): void {
    if (!isEditable()) {
      return;
    }
    if (eraserActive()) {
      this.options.remove();
      return;
    }
    if (this.options.consumesClick) {
      mapContext.consumedClick =
        (event as Leaflet.LeafletMouseEvent).originalEvent;
    }
    openEditor(
      this.options.target,
      this.options.layer,
      this.options.remove,
    );
    if (this.options.buildSelection) {
      select(this.options.buildSelection());
    }
  }

  openContextMenu(event: Leaflet.LeafletEvent): void {
    if (!isEditable()) {
      return;
    }
    (event as Leaflet.LeafletMouseEvent).originalEvent.preventDefault();
    this.options.remove();
  }

  wire(): void {
    applyTooltip(this.options.layer, this.options.target);
    this.options.layer.on("popupclose", this.closePopup.bind(this));
    this.options.layer.on("click", this.click.bind(this));
    this.options.layer.on("contextmenu", this.openContextMenu.bind(this));
  }
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
  const events = new FeatureEvents({
    layer,
    target,
    remove,
    consumesClick,
    buildSelection,
  });
  events.wire();
}
