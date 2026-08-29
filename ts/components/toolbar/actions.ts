// Toolbar updates for tool and feature palette choices.

import { ui } from "../../ui.ts";
import { applyTool } from "../map.ts";
import { clearSelection, selection } from "../map/selection.ts";

export function selectTool(id: string): void {
  ui.tool = id;
  applyTool();
}

export function selectFeature(id: string): void {
  const channel = selection.current?.feature;
  if (channel) {
    channel.set(id);
    return;
  }
  ui.selectedFeature = id;
}

export function selectColor(name: string): void {
  const channel = selection.current?.color;
  if (channel) {
    channel.set(name);
    return;
  }
  ui.selectedColor = name;
}

export function selectSize(id: string): void {
  const channel = selection.current?.size;
  if (channel) {
    channel.set(id);
    return;
  }
  ui.selectedSize = id;
}

export function selectWidth(px: number): void {
  const channel = selection.current?.width;
  if (channel) {
    channel.set(px);
    return;
  }
  ui.selectedWidth = px;
}

export function toggleArrows(): void {
  const channel = selection.current?.arrows;
  if (channel) {
    channel.set(!channel.get());
    return;
  }
  ui.selectedArrows = !ui.selectedArrows;
}

export function toggleMeasure(): void {
  const channel = selection.current?.measure;
  if (channel) {
    channel.set(!channel.get());
    return;
  }
  ui.selectedMeasure = !ui.selectedMeasure;
}

export function toggleHoverLabel(): void {
  const channel = selection.current?.hoverLabel;
  if (channel) {
    channel.set(!channel.get());
    return;
  }
  ui.selectedHoverLabel = !ui.selectedHoverLabel;
}

export function toggleFeatureOverflow(): void {
  ui.showAllFeatures = !ui.showAllFeatures;
}

export function toggleToolOverflow(): void {
  ui.showAllTools = !ui.showAllTools;
}

export function openAbout(): void {
  ui.showAbout = true;
}

export function toggleOptions(): void {
  ui.showOptions = !ui.showOptions;
  if (!ui.showOptions) {
    return;
  }
  ui.showShare = false;
  clearSelection();
}
