// The feature currently being edited. Clicking a feature selects it (and opens
// its label popup); while a selection is active the toolbar palettes act on it
// instead of setting new-feature defaults — the same "edit the focused thing"
// pattern text-size editing already uses, generalised across feature types.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";

// A live binding to one editable property: read its current value (so the
// palette can highlight it) and write a new one (mutating the feature, restyling
// its layer, and syncing the URL). A feature populates only the channels it has.
// Write defaults to the read type; colour reads as a maybe-name but is always
// written a concrete palette name.
export interface Channel<Read, Write = Read> {
  get: () => Read;
  set: (value: Write) => void;
}

export interface Selection {
  // What kind of feature is being edited — drives which palettes show and the
  // toolbar's "editing" cue.
  kind: "marker" | "line" | "polygon" | "text";
  // The layer being edited — identity, so we only clear on its own popup close.
  layer: Leaflet.Layer;
  // Colour as a palette name (markers store the name; lines/polygons/text store
  // the hex, normalised back to a name via swatchName for the highlight).
  color?: Channel<string | undefined, string>;
  feature?: Channel<string>;
  width?: Channel<number>;
  size?: Channel<string>;
  arrows?: Channel<boolean>;
  measure?: Channel<boolean>;
}

// The active selection, or undefined when nothing is being edited.
export const selection: { current: Selection | undefined } = {
  current: undefined,
};

// Select a feature; redraw so the toolbar reflects its properties.
export function select(next: Selection): void {
  selection.current = next;
  m.redraw();
}

// Clear the selection. With a layer, only clear if it's the selected one (so a
// stale popup-close from an already-replaced selection doesn't wipe the new one).
export function clearSelection(layer?: Leaflet.Layer): void {
  if (layer && selection.current?.layer !== layer) {
    return;
  }
  if (selection.current) {
    selection.current = undefined;
    m.redraw();
  }
}
