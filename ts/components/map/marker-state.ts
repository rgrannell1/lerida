// Marker collection updates shared by placement and editing.

import { state } from "../../state.ts";
import { ui } from "../../ui.ts";

export function renumberMarkers(): void {
  if (!ui.numberedMode) {
    return;
  }
  const markers = state.markers ?? [];
  for (let idx = 0; idx < markers.length; idx++) {
    markers[idx].label = String(idx + 1);
  }
}
