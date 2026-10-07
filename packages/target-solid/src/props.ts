// The props of a Solid component (ADR-0034). Solid's props object is reactive:
// reading `props.label` inside JSX tracks it, while destructuring reads each prop once, when the
// component runs, and never again (`solid/no-destructure`). So the output never destructures.
// A destructured source reads every prop as `props.label`, and its defaults go through
// `mergeProps`, which keeps the merged object reactive and applies a default when a prop is
// absent or `undefined`, as JavaScript's destructuring does (`null` stays a value).
import { js, parseExpression, referencedBindings } from "@unframework/codegen";
import type { ImportSet, Placeholders } from "@unframework/codegen";
import { codeOf, walk } from "@unframework/ir";
import type { Binding, BindingId, Prop, TypeDeclaration, UfComponent } from "@unframework/ir";

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Parameter = Parameters<typeof js.functionDeclaration>[1][number];
type Statement = Parameters<typeof js.program>[0][number];

/** How the component takes its props, and how its code reads them and calls its listeners. */
export interface SolidProps {
  /** The component's parameters: none, or the props object. */
  parameters: Parameter[];
  /** What the component runs before its setup: `const props = mergeProps(…)`. */
  statements: Statement[];
  /**
   * The props object's name, which reads a prop and calls an event's listener
   * (`props.onChange?.(…)`): absent when the output reads nothing through it.
   */
  object?: string;
  /** How code spells a read of a prop: `props.label`, or as written in the object form. */
  read(binding: Binding, written: string): string;
  /**
   * The interface of the component's events, `export interface CounterEvents { onChange?: …}`,
   * which the props parameter's type takes beside the props type (ADR-0047): absent for a
   * component that declares no events.
   */
  events?: TypeDeclaration;
}

/**
 * The props parameter of a component and how its code reads it (ADR-0034):
 *
 * - no props: `function Badge()`;
 * - the object form: `function Badge(props: BadgeProps)`, with `props.label` as written;
 * - the destructured form: `function Badge(props: BadgeProps)` with every prop read as
 *   `props.label`, or, when a prop the output reads has a default,
 *   `function Badge(rawProps: BadgeProps) { const props = mergeProps({ tone: "info" } satisfies
 *   Partial<BadgeProps>, rawProps); … }`; with a default that holds an object literal, the
 *   defaults are a `const defaults: Required<Pick<BadgeProps, "attrs">> = { … };` of their own.
 *
 * A component that declares events takes their listeners as props too (ADR-0047), typed by a
 * generated interface beside its props type (`props: CounterProps & CounterEvents`, or
 * `props: CounterEvents` alone), and calls them through the props object, never destructured:
 * `props.onChange?.(value)`.
 *
 * Props the output never reads take no default (ADR-0034: their defaults are dead code), and
 * a props object the output never reads is `_props`, the name oxlint's `no-unused-vars` leaves
 * alone, so the component keeps its props type for its consumers. A prop a handler alone reads is
 * read too (`referencedBindings` counts client code).
 */
export function solidProps(
  component: UfComponent,
  imports: ImportSet,
  placeholders: Placeholders,
): SolidProps {
  const parameter = component.propsParameter;
  const events = eventsInterface(component, imports);
  const emitted = component.emits !== undefined && emitsAny(component);
  const typeCode = [parameter?.type.code, events?.name].filter(Boolean).join(" & ");
  const type = () => placeholders.type(typeCode);
  if (!parameter && !events) {
    return { parameters: [], statements: [], read: asWritten };
  }
  const referenced = referencedBindings(component, { includeKeys: false });
  const read = component.props.filter(
    (prop) => prop.binding !== undefined && referenced.has(prop.binding),
  );
  const unread = (): SolidProps => {
    // An object form's name `_` and more says it is unused already: it stays the source's
    // (oxlint still reports a bare `_`).
    const name =
      parameter?.form === "object" && /^_./.test(parameter.name!)
        ? parameter.name!
        : imports.claim("_props");
    return {
      parameters: [js.bindingIdentifier(name, type())],
      statements: [],
      read: asWritten,
      ...(events ? { events } : {}),
    };
  };
  if (read.length === 0 && !emitted) return unread();
  if (!parameter || parameter.form === "object") {
    // The source's own name, which every reference already spells (`props.label`), or `props`
    // for a component that takes only its events' listeners.
    const name = parameter?.name ?? imports.claim("props");
    return {
      parameters: [js.bindingIdentifier(name, type())],
      statements: [],
      object: name,
      read: asWritten,
      ...(events ? { events } : {}),
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
  const shared = {
    object: props,
    read: (binding: Binding) => `${props}.${binding.name}`,
    ...(events ? { events } : {}),
  };
  if (!raw) return { parameters: [js.bindingIdentifier(props, type())], statements: [], ...shared };
  const values = js.objectExpression(
    defaults.map((prop) => [prop.name, placeholders.expression(prop.default.code)]),
  );
  const mergeProps = (first: Parameters<typeof js.callExpression>[1][number]) =>
    js.callExpression(js.identifier(imports.add("solid-js", "mergeProps")), [
      first,
      js.identifier(raw),
    ]);
  const propsType = () => placeholders.type(parameter.type.code);
  if (!defaults.some((prop) => holdsContainer(parseExpression(prop.default.code)))) {
    return {
      parameters: [js.bindingIdentifier(raw, type())],
      statements: [
        js.variableDeclaration(
          "const",
          props,
          mergeProps(js.satisfiesExpression(values, js.typeReference("Partial", [propsType()]))),
        ),
      ],
      ...shared,
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
    ...shared,
  };
}

/** A prop's read as the source writes it: the object form's own `props.label`. */
function asWritten(_binding: Binding, written: string): string {
  return written;
}

/** A component's event as Solid's props name its listener: `onChange` for `change`. */
export function eventProp(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/**
 * The interface of a component's events (ADR-0047): each event's listener an optional prop
 * named by {@link eventProp}, taking the event's payload as its parameters, by their labels:
 * `export interface CounterEvents { onChange?: (value: number) => void; }`. Its name is claimed
 * from the file's scope (`CounterEvents`, or `CounterEvents_1` beside a source name).
 */
function eventsInterface(component: UfComponent, imports: ImportSet): TypeDeclaration | undefined {
  const { emits } = component;
  if (!emits) return undefined;
  const name = imports.claim(`${component.name}Events`);
  const members = emits.events.map((event) => {
    const parameters = event.parameters
      .map((member) => `${member.name}${member.optional ? "?" : ""}: ${member.type.code}`)
      .join(", ");
    return `  ${eventProp(event.name)}?: (${parameters}) => void;`;
  });
  return {
    name,
    exported: true,
    code: `interface ${name} {\n${members.join("\n")}\n}`,
    span: emits.span,
  };
}

/** Whether any code of a component emits one of its events. */
function emitsAny(component: UfComponent): boolean {
  return codeOf(component).some(({ code }) => code.refs.some((ref) => ref.kind === "Emit"));
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
export function listIndexes(component: UfComponent): Set<BindingId> {
  const indexes = new Set<BindingId>();
  walk(component.render, {
    enter(node) {
      if (node.kind === "For" && node.index !== undefined) indexes.add(node.index);
    },
  });
  return indexes;
}
