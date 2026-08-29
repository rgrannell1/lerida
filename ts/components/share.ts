// The share panel shown in the toolbar in place of the drawing tools (toggled by
// the header share button). It builds the render.png image link for the current
// map and copies it to the clipboard, so the map can be embedded as an <img>.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { shareQuery } from "../state.ts";
import { optionsRow } from "./options-row.ts";
import { DOM_ATTRIBUTE } from "./dom-attributes.ts";
import {
  changeQuality,
  changeSize,
  copyText,
  createShareState,
  exportGeoJSON,
  type ShareState,
} from "./share-actions.ts";

// Offered image sizes. Must stay within the worker's allowlist (functions/render-core.ts).
interface SizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

const SIZES: SizePreset[] = [
  { id: "card", name: "Card (1200×630)", width: 1200, height: 630 },
  { id: "square", name: "Square (1080×1080)", width: 1080, height: 1080 },
  { id: "small", name: "Small (800×600)", width: 800, height: 600 },
];

// Image quality presets. Photographic map tiles make a lossless PNG heavy, so the
// default is a JPEG: much smaller for a small loss of sharpness. `params` is the
// extra render.png query (fmt/q); PNG adds nothing so old-style links still work.
interface QualityPreset {
  id: string;
  name: string;
  params: string;
}

const QUALITIES: QualityPreset[] = [
  { id: "standard", name: "Standard — JPEG (smaller)", params: "&fmt=jpeg&q=80" },
  { id: "small", name: "Small — JPEG (smallest)", params: "&fmt=jpeg&q=50" },
  { id: "sharp", name: "Sharp — PNG (largest)", params: "" },
];

// Retina by default — crisp on most screens.
const DPR = 2;

// The render.png URL for the current map at the given size and quality, or "" when
// the map is empty (no state to render).
function renderUrl(size: SizePreset, quality: QualityPreset): string {
  const query = shareQuery();
  if (!query) {
    return "";
  }
  const origin = globalThis.location.origin;
  const dimensions = `w=${size.width}&h=${size.height}&dpr=${DPR}`;
  return `${origin}/render.png?${query}&${dimensions}${quality.params}`;
}

// An <iframe> snippet that embeds the current map as an interactive, chrome-less
// view (the embed mode), or "" when the map is empty.
function embedSnippet(): string {
  const query = shareQuery();
  if (!query) {
    return "";
  }
  const src = `${globalThis.location.origin}/?${query}&embed=1`;
  return `<iframe src="${src}" width="600" height="450" style="border:0" loading="lazy"></iframe>`;
}

function selectedSize(id: string): SizePreset {
  for (const preset of SIZES) {
    if (preset.id === id) {
      return preset;
    }
  }
  return SIZES[0];
}

function selectedQuality(id: string): QualityPreset {
  for (const preset of QUALITIES) {
    if (preset.id === id) {
      return preset;
    }
  }
  return QUALITIES[0];
}

function sizeSelect(live: ShareState): m.Vnode {
  return m("select.options-input", {
    value: live.sizeId,
    onchange: changeSize.bind(null, live),
    [DOM_ATTRIBUTE.role]: "share-size",
  }, SIZES.map((preset) => m("option", { value: preset.id }, preset.name)));
}

function qualitySelect(live: ShareState): m.Vnode {
  return m("select.options-input", {
    value: live.qualityId,
    onchange: changeQuality.bind(null, live),
    [DOM_ATTRIBUTE.role]: "share-quality",
  }, QUALITIES.map((preset) => m("option", { value: preset.id }, preset.name)));
}

function selectText(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  target.select();
}

function emptyShare(): m.Vnode {
  return m("div.options-panel", { [DOM_ATTRIBUTE.role]: "share" }, [
    m(
      "p.lock-warning",
      "Add something to the map first, then copy its image link.",
    ),
  ]);
}

function imageControls(live: ShareState, url: string): m.Vnode[] {
  const urlField = m("input.options-input", {
    type: "text",
    readonly: true,
    value: url,
    onclick: selectText,
    [DOM_ATTRIBUTE.role]: "render-url",
  });
  const copyButton = m("button.options-button", {
    onclick: copyText.bind(null, live, "copied", url),
    [DOM_ATTRIBUTE.action]: "copy-render-url",
  }, live.copied ? "Copied" : "Copy image link");
  const exportButton = m("button.options-button", {
    onclick: exportGeoJSON,
    [DOM_ATTRIBUTE.action]: "export-geojson",
  }, "Export GeoJSON");
  return [
    optionsRow("Image size", sizeSelect(live)),
    optionsRow("Image quality", qualitySelect(live)),
    optionsRow("Image link", urlField),
    copyButton,
    optionsRow("Data", exportButton),
  ];
}

function embedControls(live: ShareState, snippet: string): m.Vnode[] {
  const field = m("textarea.options-input", {
    readonly: true,
    rows: 3,
    value: snippet,
    onclick: selectText,
    [DOM_ATTRIBUTE.role]: "embed-snippet",
  });
  const button = m("button.options-button", {
    onclick: copyText.bind(null, live, "embedCopied", snippet),
    [DOM_ATTRIBUTE.action]: "copy-embed",
  }, live.embedCopied ? "Copied" : "Copy embed code");
  return [optionsRow("Embed code", field), button];
}

function shareView(live: ShareState): m.Vnode {
  const size = selectedSize(live.sizeId);
  const quality = selectedQuality(live.qualityId);
  const url = renderUrl(size, quality);
  if (!url) {
    return emptyShare();
  }
  const controls = imageControls(live, url);
  controls.push(...embedControls(live, embedSnippet()));
  return m("div.options-panel", { [DOM_ATTRIBUTE.role]: "share" }, controls);
}

export function Share(): m.Component {
  const live = createShareState(SIZES[0].id, QUALITIES[0].id);
  return { view: shareView.bind(null, live) };
}
