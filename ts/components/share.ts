// The share panel shown in the toolbar in place of the drawing tools (toggled by
// the header share button). It builds the render.png image link for the current
// map and copies it to the clipboard, so the map can be embedded as an <img>.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { shareQuery, state } from "../state.ts";
import { stateToGeoJSON } from "../geojson.ts";

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

// One labelled row: a caption above its control (matches the options panel).
function row(label: string, control: m.Vnode): m.Vnode {
  return m("label.options-row", [m("span.options-label", label), control]);
}

// Serialise the live map to GeoJSON and trigger a download of lerida.geojson by
// clicking a transient object-URL anchor. No DOM stays behind.
function exportGeoJSON(): void {
  const json = JSON.stringify(stateToGeoJSON(state), null, 2);
  const blob = new Blob([json], { type: "application/geo+json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "lerida.geojson";
  anchor.click();
  URL.revokeObjectURL(href);
}

export function Share(): m.Component {
  let sizeId = SIZES[0].id;
  let qualityId = QUALITIES[0].id;
  let copied = false;
  let embedCopied = false;

  return {
    view() {
      const size = SIZES.find((preset) => preset.id === sizeId) ?? SIZES[0];
      const quality = QUALITIES.find((preset) => preset.id === qualityId) ??
        QUALITIES[0];
      const url = renderUrl(size, quality);
      const snippet = embedSnippet();

      const sizeSelect = m(
        "select.options-input",
        {
          value: sizeId,
          onchange: (event: Event) => {
            sizeId = (event.target as HTMLSelectElement).value;
            copied = false;
          },
          "data-role": "share-size",
        },
        SIZES.map((preset) => m("option", { value: preset.id }, preset.name)),
      );

      const qualitySelect = m(
        "select.options-input",
        {
          value: qualityId,
          onchange: (event: Event) => {
            qualityId = (event.target as HTMLSelectElement).value;
            copied = false;
          },
          "data-role": "share-quality",
        },
        QUALITIES.map((preset) => m("option", { value: preset.id }, preset.name)),
      );

      if (!url) {
        return m("div.options-panel", { "data-role": "share" }, [
          m(
            "p.lock-warning",
            "Add something to the map first, then copy its image link.",
          ),
        ]);
      }

      const urlField = m("input.options-input", {
        type: "text",
        readonly: true,
        value: url,
        onclick: (event: Event) => (event.target as HTMLInputElement).select(),
        "data-role": "render-url",
      });

      const copyButton = m("button.options-button", {
        onclick: async () => {
          await navigator.clipboard.writeText(url);
          copied = true;
          m.redraw();
          setTimeout(() => {
            copied = false;
            m.redraw();
          }, 1500);
        },
        "data-action": "copy-render-url",
      }, copied ? "Copied" : "Copy image link");

      const exportButton = m("button.options-button", {
        onclick: exportGeoJSON,
        "data-action": "export-geojson",
      }, "Export GeoJSON");

      const embedField = m("textarea.options-input", {
        readonly: true,
        rows: 3,
        value: snippet,
        onclick: (event: Event) =>
          (event.target as HTMLTextAreaElement).select(),
        "data-role": "embed-snippet",
      });

      const embedButton = m("button.options-button", {
        onclick: async () => {
          await navigator.clipboard.writeText(snippet);
          embedCopied = true;
          m.redraw();
          setTimeout(() => {
            embedCopied = false;
            m.redraw();
          }, 1500);
        },
        "data-action": "copy-embed",
      }, embedCopied ? "Copied" : "Copy embed code");

      return m("div.options-panel", { "data-role": "share" }, [
        row("Image size", sizeSelect),
        row("Image quality", qualitySelect),
        row("Image link", urlField),
        copyButton,
        row("Data", exportButton),
        row("Embed code", embedField),
        embedButton,
      ]);
    },
  };
}
