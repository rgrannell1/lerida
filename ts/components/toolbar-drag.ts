// Drag the toolbar around by its header. The position is deliberately ephemeral
// (a module variable, not URL state), so the box returns to its default
// top-centre spot on every page load — as requested.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import type { Maybe } from "../maybe.ts";

let dragged: Maybe<{ left: number; top: number }>;

function resetPosition(): void {
  if (dragged) {
    dragged = undefined;
    m.redraw();
  }
}

globalThis.addEventListener("resize", resetPosition);

// Inline style for the toolbar root once it has been dragged: pin it to the
// dragged corner and drop the default centring transform. Undefined before any
// drag, so the CSS default (top-centre) applies.
export function toolbarStyle(): Maybe<string> {
  return dragged
    ? `left:${dragged.left}px;top:${dragged.top}px;transform:none;`
    : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

class ToolbarDrag {
  header: HTMLElement;
  toolbar: HTMLElement;
  rect: DOMRect;
  grabX: number;
  grabY: number;
  moveHandler: (event: PointerEvent) => void;
  upHandler: () => void;

  constructor(header: HTMLElement, toolbar: HTMLElement, event: PointerEvent) {
    this.header = header;
    this.toolbar = toolbar;
    this.rect = toolbar.getBoundingClientRect();
    this.grabX = event.clientX - this.rect.left;
    this.grabY = event.clientY - this.rect.top;
    this.moveHandler = this.move.bind(this);
    this.upHandler = this.finish.bind(this);
  }

  move(event: PointerEvent): void {
    const left = clamp(
      event.clientX - this.grabX,
      0,
      globalThis.innerWidth - this.rect.width,
    );
    const top = clamp(
      event.clientY - this.grabY,
      0,
      globalThis.innerHeight - this.rect.height,
    );
    this.toolbar.style.left = `${left}px`;
    this.toolbar.style.top = `${top}px`;
    dragged = { left, top };
  }

  finish(): void {
    this.header.removeEventListener("pointermove", this.moveHandler);
    this.header.removeEventListener("pointerup", this.upHandler);
  }

  start(event: PointerEvent): void {
    event.preventDefault();
    this.header.setPointerCapture(event.pointerId);
    this.toolbar.style.transform = "none";
    this.header.addEventListener("pointermove", this.moveHandler);
    this.header.addEventListener("pointerup", this.upHandler);
  }
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
  const drag = new ToolbarDrag(header, toolbar, event);
  drag.start(event);
}
