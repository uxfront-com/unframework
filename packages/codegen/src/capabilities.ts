import { listBoxSize, walk } from "@unframework/ir";
import type { Attribute, Span, UfModule, VisitedNode } from "@unframework/ir";

import type { CapabilityName } from "./target.ts";

// Records, so that a node or attribute kind added to the IR cannot be left without a capability.
// A root fragment is a node `walk` visits, and needs the `fragment` capability.
const NODE_CAPABILITIES: Readonly<Record<VisitedNode["kind"], CapabilityName>> = {
  Element: "element",
  Text: "text",
  Interpolation: "interpolation",
  If: "conditional",
  For: "list",
  Fragment: "fragment",
};
const ATTRIBUTE_CAPABILITIES: Readonly<Record<Attribute["kind"], CapabilityName>> = {
  Static: "static-attribute",
  Bound: "bound-attribute",
  Class: "class-binding",
  Style: "style-binding",
  Spread: "attribute-spread",
};

/**
 * The capabilities a module uses, derived from its IR, each with the span where it is first
 * used, in that order. The compiler's capability check (P4) reports there a capability a target
 * cannot support, and the render-parity kit leaves out on a target the cases that use one: one
 * derivation, so what the compiler rejects and what the tests skip cannot disagree.
 *
 * Besides the node and attribute kinds: `props` where a component that takes props declares its
 * parameter, `svg` at an `<svg>`, and `listbox` at what may make a `<select>` a single-selection
 * list box (`listBoxSize`).
 */
export function requiredCapabilities(module: UfModule): ReadonlyMap<CapabilityName, Span> {
  const required = new Map<CapabilityName, Span>();
  const use = (capability: CapabilityName, span: Span) => {
    if (!required.has(capability)) required.set(capability, span);
  };
  for (const component of module.components) {
    const [first] = component.props;
    if (first) use("props", component.propsParameter?.span ?? first.span);
    walk(component.render, {
      enter(node) {
        use(NODE_CAPABILITIES[node.kind], node.span);
        if (node.kind !== "Element") return;
        if (node.tag === "svg") use("svg", node.span);
        for (const attribute of node.attributes) {
          use(ATTRIBUTE_CAPABILITIES[attribute.kind], attribute.span);
        }
        const size = listBoxSize(node);
        if (size) use("listbox", size.span);
      },
    });
  }
  return required;
}
