// Options-panel state and map-setting updates.

import { state, syncToUrl } from "../state.ts";
import { ui } from "../ui.ts";
import { rerenderFeatures } from "./map.ts";

export interface OptionsState {
  confirmingLock: boolean;
}

export function createOptionsState(): OptionsState {
  return { confirmingLock: false };
}

export function changeTitle(event: InputEvent): void {
  const value = (event.target as HTMLInputElement).value;
  const title = value.trim();
  state.meta = { ...state.meta, title };
  document.title = title || "lerida";
  syncToUrl();
}

export function startLock(options: OptionsState): void {
  options.confirmingLock = true;
}

export function cancelLock(options: OptionsState): void {
  options.confirmingLock = false;
}

export function lockMap(options: OptionsState): void {
  options.confirmingLock = false;
  state.editable = false;
  ui.showOptions = false;
  syncToUrl();
  rerenderFeatures();
}

export function toggleNumberedMode(): void {
  ui.numberedMode = !ui.numberedMode;
}
