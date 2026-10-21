// The scope attributes the shared builders print (ADR-0063): every element a styled component
// renders carries `data-uf-<scopeId>`, a child component's tag carries its styled parent's (the
// child-root rule), and the content a parent fills into a child whose sheets use `:slotted()`
// carries `data-uf-<childScopeId>-s`. A target owns only how its child takes them (P6).
import type { ComponentStylesApi, RenderNode, Span, UfComponent, UfModule } from "@unframework/ir";

import { scopeStylesheet } from "./scoper.ts";

/** The attribute that scopes a component's elements to its sheets, `data-uf-<scopeId>`. */
export function scopeAttribute(scopeId: string): string {
  return `data-uf-${scopeId}`;
}

/** The attribute a child's `:slotted()` rules match, `data-uf-<scopeId>-s`. */
export function slottedAttribute(scopeId: string): string {
  return `data-uf-${scopeId}-s`;
}

/**
 * The nodes a component's root is, where the scope attributes of the styled parents that render
 * it land (the child-root rule): the ones Vue's attribute fallthrough reaches, since Vue passes
 * them as attributes. That is the root element, component or `<component is>`, or one of those
 * that a branch of a root conditional renders alone. Any other root is a fragment to Vue, which
 * takes none: several nodes, a list, a slot, text, or a branch that holds a conditional (Vue's
 * `<template v-if>`). So is a component with `inheritAttrs: false`. The JSX targets spread the
 * attributes on these nodes, by their spans.
 */
export function scopeRoots(component: UfComponent): Span[] {
  if (component.inheritAttrs === false) return [];
  const { render } = component;
  if (render.kind === "Element") return [render.span];
  if (render.children.length !== 1) return [];
  const [root] = render.children as [RenderNode];
  if (root.kind !== "If") return single(root);
  return root.branches.flatMap((branch) =>
    branch.children.length === 1 ? single(branch.children[0]!) : [],
  );
}

/** A node's span where it is one element, component or `<component is>`, which Vue scopes. */
function single(node: RenderNode): Span[] {
  return node.kind === "Element" || node.kind === "Component" || node.kind === "Dynamic"
    ? [node.span]
    : [];
}

/**
 * A child's scoped styles, as a parent reads them through the resolver (ADR-0053): an imported
 * child's API, or the sheets of one of the module's own components, which `compile()` scopes
 * with the same id. `undefined` for a child without a sheet.
 */
export function childStyles(module: UfModule, local: string): ComponentStylesApi | undefined {
  for (const entry of module.imports ?? []) {
    const imported = entry.names.find((name) => name.kind === "Component" && name.local === local);
    if (!imported) continue;
    const api = entry.api.components.find((each) =>
      imported.imported === "default"
        ? each.export === "default"
        : each.export === "named" && each.name === imported.imported,
    );
    return api?.styles;
  }
  const own = module.components.find((component) => component.name === local);
  if (!own?.scopeId) return undefined;
  const scopeId = own.scopeId;
  return {
    scopeId,
    slotted: (own.styles ?? []).some(
      (sheet) => scopeStylesheet(sheet.specifier, sheet.source, scopeId).slotted,
    ),
  };
}

/**
 * The `-s` attributes for the content filled into `children` (a component, or the candidates of
 * a `<component is>`): one for each child whose sheets use `:slotted()`.
 */
export function slottedAttributes(
  module: UfModule | undefined,
  children: readonly string[],
): string[] {
  if (!module) return [];
  return children.flatMap((child) => {
    const styles = childStyles(module, child);
    return styles?.slotted ? [slottedAttribute(styles.scopeId)] : [];
  });
}
