import type { Attribute, ElementNode, RenderNode, UfModule } from "./types.ts";

// Records rather than arrays: `satisfies` rejects a missing or an unknown kind, so a kind added
// to the unions cannot be left out of the lists the coverage gate iterates.
const renderNodeKinds = { Element: true, Text: true } satisfies Record<RenderNode["kind"], true>;
const attributeKinds = { Static: true } satisfies Record<Attribute["kind"], true>;

/** Every kind of render node. The coverage gate requires a corpus case for each. */
export const RENDER_NODE_KINDS: readonly RenderNode["kind"][] = Object.keys(
  renderNodeKinds,
) as RenderNode["kind"][];

/** Every kind of attribute. The coverage gate requires a corpus case for each. */
export const ATTRIBUTE_KINDS: readonly Attribute["kind"][] = Object.keys(
  attributeKinds,
) as Attribute["kind"][];

/** Callbacks for {@link walk}. Returning `false` from `enter` skips the node's children. */
export interface Visitor {
  enter?(node: RenderNode, parent: ElementNode | undefined): void | false;
  leave?(node: RenderNode, parent: ElementNode | undefined): void;
}

/** Walks a render tree depth-first, in document order. */
export function walk(node: RenderNode, visitor: Visitor, parent?: ElementNode): void {
  if (visitor.enter?.(node, parent) === false) return;
  if (node.kind === "Element") {
    for (const child of node.children) walk(child, visitor, node);
  }
  visitor.leave?.(node, parent);
}

/** What a module uses, by kind: the input of capability checks and of the coverage gate. */
export interface ModuleFeatures {
  nodeKinds: Set<RenderNode["kind"]>;
  attributeKinds: Set<Attribute["kind"]>;
}

/** Collects the node and attribute kinds that a module's components use. */
export function collectFeatures(module: UfModule): ModuleFeatures {
  const features: ModuleFeatures = { nodeKinds: new Set(), attributeKinds: new Set() };
  for (const component of module.components) {
    walk(component.render, {
      enter(node) {
        features.nodeKinds.add(node.kind);
        if (node.kind === "Element") {
          for (const attribute of node.attributes) features.attributeKinds.add(attribute.kind);
        }
      },
    });
  }
  return features;
}
