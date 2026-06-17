// Inline markdown rendering for text labels (marked + DOMPurify, bundled). We
// render inline-only and sanitise the result.

import { marked } from "marked";
import DOMPurify from "dompurify";

// Inline tags / attributes allowed in rendered labels (no images or block tags).
const MARKDOWN_TAGS = ["a", "b", "i", "strong", "em", "code", "del", "s", "br"];
const MARKDOWN_ATTR = ["href", "title", "target", "rel"];

// Open sanitised links in a new tab, safely.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// Render a raw markdown string to sanitised inline HTML.
export function renderMarkdown(raw: string): string {
  const html = marked.parseInline(raw) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MARKDOWN_TAGS,
    ALLOWED_ATTR: MARKDOWN_ATTR,
  });
}
