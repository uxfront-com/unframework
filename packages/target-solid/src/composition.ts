// Composition as Solid writes it (ADR-0053, ADR-0054, plan §6). Everything a parent passes is a
// prop, read through the props object, never destructured:
//
// - A child is imported from its output file, `import Field from "./Field"`; one that renders
//   itself calls its own function.
// - Slots are props: the default slot is `children`, a named one `title`, a scoped one a function
//   of its props, `item?: (props) => JSX.Element`. A slot reads as `props.title`, and a scoped one
//   is called, `props.item?.({ item })`. Reading a slot's prop creates its content again, so a
//   slot without props that is tested anywhere, or a default slot with a fallback, is resolved
//   once with `children()`.
// - A model is a `value` prop and an `onValueChange` callback; unbound (`value === undefined`), the
//   child keeps a local signal seeded by its default.
// - `class` and `style` fall through to the root, merged with its own (`fallthrough`), unless
//   `inheritAttrs` is `false`.
// - What a component exposes it passes to its `ref` prop, `props.ref?.({ focus })`; a parent's
//   component ref is a `let` its `ref` callback sets, as an element's is (ADR-0049).
// - An injection key is a context, `createContext<T>()`, in the output of its module's main
//   component; `provide` wraps the template in the context's provider, and `inject` is
//   `useContext(Key) ?? fallback`. A key of a ref holds `refObject`, an object whose `value`
//   getter reads the signal (`reactive-context`, emulated): written in place, because
//   `solid/reactivity` (L5) reports a signal handed to a function there.
import { childImports, keyImports, keyOwner } from "@unframework/codegen";
import type { ImportSet } from "@unframework/codegen";
import { expressionsOf, walk } from "@unframework/ir";
import type {
  Binding,
  InjectionKeyDeclaration,
  ModelItem,
  Span,
  TypeDeclaration,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { eventProp } from "./props.ts";

/** What a component's composition adds to its output. */
export class SolidComposition {
  readonly component: UfComponent;
  readonly module: UfModule;
  readonly #imports: ImportSet;
  /** The interfaces the props parameter takes beside its own type: the models', the slots'. */
  readonly types: TypeDeclaration[] = [];
  /** The inline type the props parameter takes for fallthrough and `ref`, or none. */
  readonly inline: string | undefined;
  /**
   * Where `class` and `style` fall through: the root element's or root component's span, or
   * none (a fragment, a conditional, `inheritAttrs: false`).
   */
  readonly fallthrough: Span | undefined;
  /**
   * The slots resolved once with `children()`, by name, with the name of their content: those
   * without props that are tested anywhere, and the default slot where it falls back.
   */
  readonly resolved: ReadonlyMap<string, string>;

  constructor(component: UfComponent, module: UfModule, imports: ImportSet) {
    this.component = component;
    this.module = module;
    this.#imports = imports;
    // Each child's output, by the name the template uses (ADR-0053): a component that renders
    // itself calls its own function.
    for (const child of childImports(component, module, (name) => name)) {
      if (child.self) continue;
      if (child.export === "default") {
        imports.addDefault(child.specifier, child.local, { exact: true });
      } else imports.add(child.specifier, child.name, { local: child.local, exact: true });
    }
    for (const key of keyImports(component, module, (name) => name)) {
      if (key.specifier) imports.add(key.specifier, key.name, { local: key.local, exact: true });
    }
    const jsx = () => imports.add("solid-js", "JSX", { type: true });
    const models = component.setup.filter((item): item is ModelItem => item.kind === "Model");
    if (models.length) {
      const name = imports.claim(`${component.name}Models`);
      const members = models.flatMap((model) => {
        const type = model.type?.code ?? "unknown";
        return [
          `  ${model.name}${model.required ? "" : "?"}: ${type};`,
          `  ${eventProp(`${model.name}Change`)}?: (value: ${type}) => void;`,
        ];
      });
      this.types.push(declaration(name, members, model0Span(models)));
    }
    const { slots } = component;
    if (slots) {
      const name = imports.claim(`${component.name}Slots`);
      const members = slots.slots.map((slot) => {
        const prop = slot.name === "default" ? "children" : slot.name;
        const type = slot.props
          ? `(props: ${slot.props.code}) => ${jsx()}.Element`
          : `${jsx()}.Element`;
        return `  ${propertyKey(prop)}${slot.optional ? "?" : ""}: ${type};`;
      });
      this.types.push(declaration(name, members, slots.span));
    }
    this.fallthrough = fallthroughRoot(component);
    const inline: string[] = [];
    if (this.fallthrough) inline.push(`class?: string`, `style?: ${jsx()}.CSSProperties`);
    if (component.exposes) inline.push(`ref?: (api: ${this.exposedType()}) => void`);
    this.inline = inline.length ? `{ ${inline.join("; ")} }` : undefined;
    const used = resolvedSlots(component);
    this.resolved = new Map(
      (slots?.slots ?? [])
        .filter((slot) => !slot.props && used.has(slot.name))
        .map((slot) => [slot.name, imports.claim(slot.name === "default" ? "content" : slot.name)]),
    );
  }

  /** The type texts the props parameter takes beside the props type and the events. */
  parameterTypes(): string[] {
    return [...this.types.map((type) => type.name), ...(this.inline ? [this.inline] : [])];
  }

  /** Whether the output reads the props object for composition. */
  get reads(): boolean {
    return Boolean(
      this.fallthrough ||
      this.component.exposes ||
      this.component.slots ||
      this.component.setup.some((item) => item.kind === "Model"),
    );
  }

  /**
   * The statements before the setup: each resolved slot's content
   * (`const content = children(() => props.children);`).
   */
  statements(object: string): string[] {
    if (!this.resolved.size) return [];
    const children = this.#imports.add("solid-js", "children");
    return [...this.resolved].map(
      ([slot, name]) =>
        `const ${name} = ${children}(() => ${object}.${slot === "default" ? "children" : slot});`,
    );
  }

  /** The statement that hands the exposed functions to the `ref` prop, or none. */
  expose(object: string): string | undefined {
    const { exposes } = this.component;
    if (!exposes) return undefined;
    const names = exposes.functions.map((id) => this.#binding(id).name);
    // Once, as an element's `ref` is called: `solid/reactivity` (L5) asks for `untrack`.
    const untrack = this.#imports.add("solid-js", "untrack");
    return `${untrack}(() => ${object}.ref?.({ ${names.join(", ")} }));`;
  }

  /**
   * The type of what the component exposes, its functions by their signatures: a parameter
   * without a type is `unknown`, and a function without a return type returns `void`, which
   * any return type is assignable to.
   */
  exposedType(): string {
    const functions = new Map(
      this.component.setup.flatMap((item) =>
        item.kind === "Function" ? [[item.binding, item.function] as const] : [],
      ),
    );
    const members = (this.component.exposes?.functions ?? []).map((id) => {
      const fn = functions.get(id)!;
      const parameters = fn.parameters.map((parameter, index) => {
        const name = parameter.name ?? `arg${index}`;
        const rest = parameter.rest ? "..." : "";
        const optional = parameter.optional || parameter.default ? "?" : "";
        return `${rest}${name}${optional}: ${parameter.type?.code ?? (parameter.rest ? "unknown[]" : "unknown")}`;
      });
      const returned = fn.returnType?.code ?? (fn.async ? "Promise<void>" : "void");
      return `${this.#binding(id).name}: (${parameters.join(", ")}) => ${returned}`;
    });
    return `{ ${members.join("; ")} }`;
  }

  /** The module's keys, as contexts, when this component's output declares them. */
  keys(): string[] {
    const keys = this.module.keys ?? [];
    if (
      !keys.length ||
      keyOwner(this.module.components, this.module.exports) !== this.component.name
    ) {
      return [];
    }
    const createContext = this.#imports.add("solid-js", "createContext");
    return keys.map((key) => `export const ${key.name} = ${createContext}<${contextType(key)}>();`);
  }

  /** A provided ref, `refObject`: an object whose `value` reads its signal. */
  refObject(accessor: string): string {
    return `{\nget value() {\nreturn ${accessor}();\n},\n}`;
  }

  #binding(id: string): Binding {
    return this.component.bindings.find((binding) => binding.id === id)!;
  }
}

/** Where the first model is declared. */
function model0Span(models: readonly ModelItem[]): Span {
  return models[0]!.span;
}

/** An exported interface of members, which the props parameter's type takes. */
function declaration(name: string, members: readonly string[], span: Span): TypeDeclaration {
  return {
    name,
    exported: true,
    code: `interface ${name} {\n${members.join("\n")}\n}`,
    span,
  };
}

/** A property's key: as it is when it is an identifier, quoted otherwise. */
function propertyKey(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * Where `class` and `style` fall through (ADR-0054): the root element, or the root component
 * that passes them on, as `ComponentApi.root` reads the source; none for any other root or with
 * `inheritAttrs: false`.
 */
function fallthroughRoot(component: UfComponent): Span | undefined {
  if (component.inheritAttrs === false) return undefined;
  const { render } = component;
  if (render.kind === "Element") return render.span;
  const [only] = render.children;
  return render.children.length === 1 && only?.kind === "Component" ? only.span : undefined;
}

/**
 * The slots a component would read more than once: each one an expression tests
 * (`slots.title`, in a condition or an attribute alike), and the default slot where it falls
 * back.
 */
function resolvedSlots(component: UfComponent): Set<string> {
  const found = new Set<string>();
  for (const { expression } of expressionsOf(component)) {
    for (const ref of expression.refs) if (ref.kind === "Slot") found.add(ref.slot);
  }
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet" && node.slot === "default" && node.fallback.length) {
        found.add("default");
      }
    },
  });
  return found;
}

/**
 * A key's context type: its value's type, or for a key of a ref (`InjectionKey<Ref<number>>`),
 * the object `refObject` provides, `{ readonly value: number }`.
 */
function contextType(key: InjectionKeyDeclaration): string {
  if (!key.ref) return key.type.code;
  const inner = /^\s*[A-Za-z]+\s*<([\s\S]*)>\s*$/.exec(key.type.code)?.[1]?.trim() ?? "unknown";
  return `{ readonly value: ${inner} }`;
}
