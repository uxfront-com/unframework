// The props of a Solid component (design §5.4, ADR-0034). Solid's props object is reactive:
// reading `props.label` inside JSX tracks it, while destructuring reads each prop once, when the
// component runs, and never again (`solid/no-destructure`). So the output never destructures.
// A destructured source reads every prop as `props.label`, and its defaults go through
// `mergeProps`, which keeps the merged object reactive and applies a default when a prop is
// absent or `undefined`, as JavaScript's destructuring does (`null` stays a value).
import { js, parseExpression, referencedBindings } from "@unframework/codegen";
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
 *   Partial<BadgeProps>, rawProps); … }`; with a default that holds an object literal, the
 *   defaults are a `const defaults: Required<Pick<BadgeProps, "attrs">> = { … };` of their own.
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
    // An object form's name `_` and more says it is unused already: it stays the source's
    // (oxlint still reports a bare `_`).
    const name =
      parameter.form === "object" && /^_./.test(parameter.name!)
        ? parameter.name!
        : imports.claim("_props");
    return {
      parameters: [js.bindingIdentifier(name, type())],
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
  const values = js.objectExpression(
    defaults.map((prop) => [prop.name, placeholders.expression(prop.default.code)]),
  );
  const mergeProps = (first: Parameters<typeof js.callExpression>[1][number]) =>
    js.callExpression(js.identifier(imports.add("solid-js", "mergeProps")), [
      first,
      js.identifier(raw),
    ]);
  if (!defaults.some((prop) => holdsContainer(parseExpression(prop.default.code)))) {
    return {
      parameters: [js.bindingIdentifier(raw, type())],
      statements: [
        js.variableDeclaration(
          "const",
          props,
          mergeProps(js.satisfiesExpression(values, js.typeReference("Partial", [type()]))),
        ),
      ],
      rules,
    };
  }
  // `satisfies` keeps an object or array literal's own type, which lacks the optional members
  // its value leaves out (`{ title: "t" }` for `Attrs`), or holds only the literals it lists
  // (`["info"]` for `Tone[]`), and `mergeProps` types the prop by both: a read of one fails L4
  // (`tones.includes(tone)`). Annotated, the defaults take the props' own types, checked as
  // literals. A scalar's literal type is a member of its prop's, which `mergeProps` keeps.
  const named = imports.claim("defaults");
  const keys = defaults.map((prop) => JSON.stringify(prop.name)).join(" | ");
  const annotation = placeholders.type(`Required<Pick<${parameter.type.code}, ${keys}>>`);
  return {
    parameters: [js.bindingIdentifier(raw, type())],
    statements: [
      js.variableDeclaration("const", named, values, annotation),
      js.variableDeclaration("const", props, mergeProps(js.identifier(named))),
    ],
    rules,
  };
}

/** Whether a default is or holds an object or array literal (`{ title: "t" }`, `["info"]`). */
function holdsContainer(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(holdsContainer);
  if (typeof node !== "object" || node === null) return false;
  const { type } = node as { type?: unknown };
  if (type === "ObjectExpression" || type === "ArrayExpression") return true;
  return Object.entries(node).some(([key, value]) => key !== "type" && holdsContainer(value));
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
