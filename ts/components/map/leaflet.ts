// Typed access to the bundled Leaflet runtime and the plugins that augment it
// (AwesomeMarkers, the polyline decorator, Geoman). Importing leaflet-setup here
// guarantees Leaflet + plugins are loaded (as global L) before anything reads them.

import "../../leaflet-setup.ts";
// @deno-types="npm:@types/leaflet@^1.9.12"
import type * as Leaflet from "leaflet";

// The Leaflet runtime: the global L populated by leaflet-setup.ts (all bundled).
export const leaflet = (globalThis as unknown as { L: typeof Leaflet }).L;

// ---- AwesomeMarkers (no bundled types) ----
interface AwesomeIconOptions {
  icon: string;
  prefix: string;
  markerColor: string;
}

interface AwesomeMarkersStatic {
  icon(options: AwesomeIconOptions): Leaflet.Icon;
}

export const awesomeMarkers =
  (globalThis as unknown as { L: { AwesomeMarkers: AwesomeMarkersStatic } })
    .L.AwesomeMarkers;

// ---- Leaflet-Geoman (the plugin augments each map with `.pm`) ----
interface GeomanPathStyle {
  color: string;
  fillColor?: string;
  weight?: number;
}

export interface GeomanDrawOptions {
  templineStyle?: GeomanPathStyle;
  hintlineStyle?: GeomanPathStyle;
  pathOptions?: GeomanPathStyle;
}

// A Geoman draw handler; `_finishShape` commits the in-progress shape.
interface GeomanDrawInstance {
  _finishShape?: () => void;
}

export interface GeomanMap {
  enableDraw(shape: string, options?: GeomanDrawOptions): void;
  disableDraw(shape?: string): void;
  Draw?: Record<string, GeomanDrawInstance>;
}

// Geoman's pm:create event: the finished shape kind and its layer.
export interface PmCreateEvent {
  shape: string;
  layer: Leaflet.Polyline;
}

export function geoman(map: Leaflet.Map): GeomanMap | undefined {
  return (map as unknown as { pm?: GeomanMap }).pm;
}

// ---- leaflet-polylinedecorator (directional arrowheads along a line) ----
interface ArrowSymbolOptions {
  pixelSize?: number;
  polygon?: boolean;
  pathOptions?: {
    color: string;
    weight?: number;
    fillOpacity?: number;
    stroke?: boolean;
  };
}

interface DecoratorPattern {
  offset?: string | number;
  repeat?: string | number;
  symbol: unknown;
}

interface DecoratorOptions {
  patterns: DecoratorPattern[];
}

interface PolylineDecoratorPlugin {
  Symbol: { arrowHead(options: ArrowSymbolOptions): unknown };
  polylineDecorator(
    line: Leaflet.Polyline,
    options: DecoratorOptions,
  ): Leaflet.Layer;
}

export const decorators = leaflet as unknown as PolylineDecoratorPlugin;
