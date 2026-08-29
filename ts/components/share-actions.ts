// Share-panel updates and clipboard effects.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { stateToGeoJSON } from "../geojson.ts";
import { state } from "../state.ts";

export interface ShareState {
  sizeId: string;
  qualityId: string;
  copied: boolean;
  embedCopied: boolean;
}

type CopyFlag = "copied" | "embedCopied";

export function createShareState(sizeId: string, qualityId: string): ShareState {
  return { sizeId, qualityId, copied: false, embedCopied: false };
}

export function changeSize(state: ShareState, event: Event): void {
  state.sizeId = (event.target as HTMLSelectElement).value;
  state.copied = false;
}

export function changeQuality(state: ShareState, event: Event): void {
  state.qualityId = (event.target as HTMLSelectElement).value;
  state.copied = false;
}

function resetCopied(state: ShareState, flag: CopyFlag): void {
  state[flag] = false;
  m.redraw();
}

export async function copyText(
  state: ShareState,
  flag: CopyFlag,
  value: string,
): Promise<void> {
  await navigator.clipboard.writeText(value);
  state[flag] = true;
  m.redraw();
  setTimeout(resetCopied.bind(null, state, flag), 1500);
}

export function exportGeoJSON(): void {
  const json = JSON.stringify(stateToGeoJSON(state), null, 2);
  const blob = new Blob([json], { type: "application/geo+json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "lerida.geojson";
  anchor.click();
  URL.revokeObjectURL(href);
}
