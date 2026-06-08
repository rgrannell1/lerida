// Drag the toolbar around by its header. The position is deliberately ephemeral
// (a module variable, not URL state), so the box returns to its default
// top-centre spot on every page load — as requested.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";

let dragged: { left: number; top: number } | undefined;

// A resize can leave a dragged toolbar pinned off-screen (e.g. the window shrank
// past its corner), making it go missing. Drop the dragged position on resize so
// it snaps back to the default top-centre, and redraw to re-apply the CSS default.
globalThis.addEventListener("resize", () => {
  if (dragged) {
    dragged = undefined;
    m.redraw();
  }
});

// Inline style for the toolbar root once it has been dragged: pin it to the
// dragged corner and drop the default centring transform. Undefined before any
// drag, so the CSS default (top-centre) applies.
export function toolbarStyle(): string | undefined {
  return dragged ? `left:${dragged.left}px;top:${dragged.top}px;transform:none;` : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Begin dragging from a header pointerdown. Ignores presses on the header's
// buttons (clear / minimise / title) so they still work as buttons.
export function startToolbarDrag(event: PointerEvent): void {
  if ((event.target as HTMLElement).closest("button")) {
    return;
  }
  const header = event.currentTarget as HTMLElement;
  const toolbar = header.closest("#toolbar") as HTMLElement | null;
  if (!toolbar) {
    return;
  }
  event.preventDefault();
  const rect = toolbar.getBoundingClientRect();
  const grabX = event.clientX - rect.left;
  const grabY = event.clientY - rect.top;
  toolbar.style.transform = "none";

  const onMove = (move: PointerEvent): void => {
    const left = clamp(move.clientX - grabX, 0, globalThis.innerWidth - rect.width);
    const top = clamp(move.clientY - grabY, 0, globalThis.innerHeight - rect.height);
    // Drive the DOM directly during the drag (no Mithril redraw) for smoothness;
    // `dragged` keeps the value so any redraw re-applies the same position.
    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    dragged = { left, top };
  };
  const onUp = (): void => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}
