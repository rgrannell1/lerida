// The "about" overlay: a dismissable card explaining what lerida is, opened by
// clicking the brand title in the toolbar. Pure UI — not encoded in the URL.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";
import { ui } from "../ui.ts";
import { DOM_ATTRIBUTE } from "./dom-attributes.ts";

const REPO_URL = "https://github.com/rgrannell1/lerida";
const OSM_URL = "https://www.openstreetmap.org/copyright";
// The name nods to Borges' one-paragraph fable of a map as large as its empire.
const WIKI_URL = "https://en.wikipedia.org/wiki/On_Exactitude_in_Science";

function closeAbout(): void {
  ui.showAbout = false;
}

// An external link that opens safely in a new tab.
function externalLink(href: string, text: string): m.Vnode {
  return m("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }
  closeAbout();
  m.redraw();
}

function addKeyHandler(): void {
  document.addEventListener("keydown", handleKeyDown);
}

function removeKeyHandler(): void {
  document.removeEventListener("keydown", handleKeyDown);
}

function stopClick(event: MouseEvent): void {
  event.stopPropagation();
}

function aboutCopy(): m.Vnode[] {
  return [
    m("h1.about-title", externalLink(WIKI_URL, "lerida")),
    m("p.about-tagline", "Make your own maps."),
    m(
      "p",
      "lerida turns an annotated map into a URL. Add markers, text, " +
        "and lines to your map.",
    ),
    m(
      "p",
      "Share or bookmark that link and whoever opens it sees exactly the same map. " +
        "Your data is not shared with a server; your map lives entirely in the URL.",
    ),
  ];
}

function attribution(): m.Vnode {
  return m("p.about-foot", [
    "Map data © ",
    externalLink(OSM_URL, "OpenStreetMap"),
    " contributors · ",
    externalLink(REPO_URL, "source"),
  ]);
}

function aboutCard(): m.Vnode {
  return m("div.about-card", {
    role: "dialog",
    "aria-modal": "true",
    onclick: stopClick,
  }, [
    m("button.about-close", {
      title: "Close",
      onclick: closeAbout,
      [DOM_ATTRIBUTE.action]: "about-close",
    }, m("i.fa.fa-times")),
    ...aboutCopy(),
    attribution(),
  ]);
}

function aboutView(): m.Vnode {
  return m("div.about-backdrop", {
    [DOM_ATTRIBUTE.role]: "about",
    onclick: closeAbout,
  }, aboutCard());
}

export function About(): m.Component {
  return {
    oncreate: addKeyHandler,
    onremove: removeKeyHandler,
    view: aboutView,
  };
}
