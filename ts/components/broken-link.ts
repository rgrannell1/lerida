// Broken-link view shown when the URL state cannot be decoded.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";

interface BrokenLinkAttrs {
  blankMapPath: string;
}

export function BrokenLink(): m.Component<BrokenLinkAttrs> {
  return {
    view(vnode) {
      return m("div.broken-link", [
        m("h1", "This map link does not work"),
        m("p", "The map data in the link is incomplete or damaged."),
        m("p", "Make sure the full URL was copied, then try again."),
        m("p", m("a", { href: vnode.attrs.blankMapPath }, "Open a blank map")),
      ]);
    },
  };
}
