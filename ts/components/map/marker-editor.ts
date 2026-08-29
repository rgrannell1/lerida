// Marker editing, removal, and toolbar selection binding.

// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";
import { DEFAULT_FEATURE, swatchName } from "../../features.ts";
import { state, syncToUrl } from "../../state.ts";
import type { Marker } from "../../types.ts";
import { ui } from "../../ui.ts";
import { dropFrom } from "../../commons/array.ts";
import { rerenderFeatures } from "../map.ts";
import { applyTooltip, wireFeature } from "./editor.ts";
import { renumberMarkers } from "./marker-state.ts";
import type { Selection } from "./selection.ts";

export class MarkerEditor {
  layer: Leaflet.Marker;
  marker: Marker;
  makeIcon: () => Leaflet.Icon;

  constructor(
    layer: Leaflet.Marker,
    marker: Marker,
    makeIcon: () => Leaflet.Icon,
  ) {
    this.layer = layer;
    this.marker = marker;
    this.makeIcon = makeIcon;
  }

  restyle(): void {
    this.layer.setIcon(this.makeIcon());
  }

  setColor(name: string): void {
    this.marker.color = name;
    this.restyle();
    syncToUrl();
  }

  setFeature(id: string): void {
    this.marker.feature = id;
    this.restyle();
    syncToUrl();
  }

  setHoverLabel(on: boolean): void {
    if (on) {
      this.marker.hoverLabel = true;
    } else {
      delete this.marker.hoverLabel;
    }
    applyTooltip(this.layer, this.marker);
    syncToUrl();
  }

  buildSelection(): Selection {
    return {
      kind: "marker",
      layer: this.layer,
      color: {
        get: swatchName.bind(null, this.marker.color),
        set: this.setColor.bind(this),
      },
      feature: {
        get: () => this.marker.feature ?? DEFAULT_FEATURE,
        set: this.setFeature.bind(this),
      },
      hoverLabel: {
        get: () => this.marker.hoverLabel ?? false,
        set: this.setHoverLabel.bind(this),
      },
    };
  }

  remove(): void {
    state.markers = dropFrom(state.markers, this.marker);
    this.layer.remove();
    if (ui.numberedMode) {
      renumberMarkers();
      rerenderFeatures();
    }
    syncToUrl();
  }

  wire(): void {
    wireFeature(
      this.layer,
      this.marker,
      this.remove.bind(this),
      false,
      this.buildSelection.bind(this),
    );
  }
}
