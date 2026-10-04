// The props of a Solid component (design §5.4, ADR-0034). Solid's props object is reactive:
// reading `props.label` inside JSX tracks it, while destructuring reads each prop once, when the
// component runs, and never again (`solid/no-destructure`). So the output never destructures.
// A destructured source reads every prop as `props.label`, and its defaults go through
// `mergeProps`, which keeps the merged object reactive and applies a default when a prop is
// absent or `undefined`, as JavaScript's destructuring does (`null` stays a value).
import { js, referencedBindings } from "@unframework/codegen";
import type { ImportSet, Placeholders, RewriteRules } from "@unframework/codegen";
import { walk } from "@unframework/ir";
import type { BindingId, Prop, UfComponent } from "@unframework/ir";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Parameter = Parameters<typeof js.functionDeclaration>[1][number];
type Statement = Parameters<typeof js.program>[0][number];

/** How the component takes its props, and how its expressions read them. */
export interface SolidProps {
  /** The component's parameters: none, or the props object. */
  parameters: Parameter[];
  /** What the component runs before it returns: `const props = mergeProps(…)`. */
  statements: Statement[];
  /** How printed expressions spell references to props and loop variables. */
  rules: RewriteRules;
}

/**
 * The props parameter and the rewrite rules of a component (design §5.4):
 *
 * - no props: `function Badge()`;
 * - the object form: `function Badge(props: BadgeProps)`, with `props.label` as written;
 * - the destructured form: `function Badge(props: BadgeProps)` with every prop read as
 *   `props.label`, or, when a prop the output reads has a default,
 *   `function Badge(rawProps: BadgeProps) { const props = mergeProps({ tone: "info" } satisfies
 *   Partial<BadgeProps>, rawProps); … }`.
 *
 * Props the output never reads take no default (design §5: their defaults are dead code), and
 * a props object the output never reads is `_props`, the name oxlint's `no-unused-vars` leaves
 * alone, so the component keeps its props type for its consumers. A list's index is an accessor
 * on Solid (`index()`); its `key` is not printed, so a read there does not count.
 */
export function solidProps(
  component: UfComponent,
  imports: ImportSet,
  placeholders: Placeholders,
): SolidProps {
  const indexes = listIndexes(component);
  const loopVariable = (id: BindingId, written: string) =>
    indexes.has(id) ? `${written}()` : written;
  const parameter = component.propsParameter;
  if (!parameter) {
    return {
      parameters: [],
      statements: [],
      rules: { binding: (reference, binding, written) => loopVariable(binding.id, written) },
    };
  }
  const type = () => placeholders.type(parameter.type.code);
  const referenced = referencedBindings(component, { includeKeys: false });
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && referenced.has(prop.binding),
  );
  if (read.length === 0) {
    return {
      parameters: [js.bindingIdentifier(imports.claim("_props"), type())],
      statements: [],
      rules: { binding: (reference, binding, written) => loopVariable(binding.id, written) },
    };
  }
  if (parameter.form === "object") {
    // The source's own name, which every reference already spells (`props.label`).
    return {
      parameters: [js.bindingIdentifier(parameter.name!, type())],
      statements: [],
      rules: { binding: (reference, binding, written) => loopVariable(binding.id, written) },
    };
  }
  // In the order the source's pattern lists them, where the author wrote them: bindings are in
  // source order.
  const order = new Map(component.bindings.map((binding, index) => [binding.id, index]));
  const defaults = read
    .filter((prop): prop is Prop & { default: NonNullable<Prop["default"]> } =>
      Boolean(prop.default),
    )
    .toSorted((a, b) => order.get(a.binding!)! - order.get(b.binding!)!);
  const raw = defaults.length ? imports.claim("rawProps") : undefined;
  const props = imports.claim("props");
  const rules: RewriteRules = {
    binding: (reference, binding, written) =>
      binding.kind === "prop" ? `${props}.${binding.name}` : loopVariable(binding.id, written),
  };
  if (!raw) return { parameters: [js.bindingIdentifier(props, type())], statements: [], rules };
  const merged = js.callExpression(js.identifier(imports.add("solid-js", "mergeProps")), [
    js.satisfiesExpression(
      js.objectExpression(
        defaults.map((prop) => [prop.name, placeholders.expression(prop.default.code)]),
      ),
      js.typeReference("Partial", [type()]),
    ),
    js.identifier(raw),
  ]);
  return {
    parameters: [js.bindingIdentifier(raw, type())],
    statements: [js.variableDeclaration("const", props, merged)],
    rules,
  };
}

/** The ids of the lists' index parameters, which Solid's `<For>` passes as accessors. */
function listIndexes(component: UfComponent): Set<BindingId> {
  const indexes = new Set<BindingId>();
  walk(component.render, {
    enter(node) {
      if (node.kind === "For" && node.index !== undefined) indexes.add(node.index);
    },
  });
  return indexes;
}
