import { listBoxSize, walk } from "@unframework/ir";
import type { Attribute, RenderNode, Span, UfModule } from "@unframework/ir";

import type { CapabilityName } from "./target.ts";

// Records, so that a node or attribute kind added to the IR cannot be left without a capability.
const NODE_CAPABILITIES: Readonly<Record<RenderNode["kind"], CapabilityName>> = {
  Element: "element",
  Text: "text",
};
const ATTRIBUTE_CAPABILITIES: Readonly<Record<Attribute["kind"], CapabilityName>> = {
  Static: "static-attribute",
};

/**
 * The capabilities a module uses, derived from its IR, each with the span where it is first
 * used, in that order. The compiler's capability check (P4) reports there a capability a target
 * cannot support, and the render-parity kit leaves out on a target the cases that use one: one
 * derivation, so what the compiler rejects and what the tests skip cannot disagree.
 */
export function requiredCapabilities(module: UfModule): ReadonlyMap<CapabilityName, Span> {
  const required = new Map<CapabilityName, Span>();
  const use = (capability: CapabilityName, span: Span) => {
    if (!required.has(capability)) required.set(capability, span);
  };
  for (const component of module.components) {
    walk(component.render, {
      enter(node) {
        use(NODE_CAPABILITIES[node.kind], node.span);
        if (node.kind !== "Element") return;
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
