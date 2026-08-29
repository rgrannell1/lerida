// Labelled control row shared by toolbar panels.

// @deno-types="npm:@types/mithril@^2.2.7"
import m from "mithril";

export function optionsRow(label: string, control: m.Vnode): m.Vnode {
  return m("label.options-row", [m("span.options-label", label), control]);
}
