// Composition as Solid writes it (ADR-0053, ADR-0054, plan §6). Everything a parent passes is a
// prop, read through the props object, never destructured:
//
// - A child is imported from its output file, `import Field from "./Field"`; one that renders
//   itself calls its own function.
// - Slots are props: the default slot is `children`, a named one `title`, a scoped one a function
//   of its props, `item?: (props) => JSX.Element`. A slot reads as `props.title`, and a scoped one
//   is called, `props.item?.({ item })`. Reading a slot's prop creates its content again, so a
//   slot without props that is tested, or a default slot with a fallback, is resolved once with
//   `children()`, in the component or, where a list's row renders it, in each row.
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
import { childImports, keyImports, keyOwner, scopeRoots } from "@unframework/codegen";
import type { ImportSet } from "@unframework/codegen";
import type {
  Binding,
  InjectionKeyDeclaration,
  ModelItem,
  Span,
  TypeDeclaration,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { generatedInterface } from "./generics.ts";
import type { GeneratedInterface } from "./generics.ts";
import { eventProp } from "./props.ts";

/** What a component's composition adds to its output. */
export class SolidComposition {
  readonly component: UfComponent;
  readonly module: UfModule;
  readonly #imports: ImportSet;
  /** The interfaces the props parameter takes beside its own type: the models', the slots'. */
  readonly types: TypeDeclaration[] = [];
  /** How the props parameter names each of `types`: `PickerSlots<T>` (src/generics.ts). */
  readonly #references: string[] = [];
  /** The inline type the props parameter takes for fallthrough and `ref`, or none. */
  readonly inline: string | undefined;
  /**
   * Where `class` and `style` fall through: the root element's or root component's span, or
   * none (a fragment, a conditional, `inheritAttrs: false`).
   */
  readonly fallthrough: Span | undefined;
  /**
   * The root nodes that spread the scope attributes of the styled parents that render the
   * component (the child-root rule, ADR-0063), by `start:end` of their spans (`scopeRoots`).
   */
  readonly scopeRoots: ReadonlySet<string>;
  /**
   * The slots resolved once in the component with `children()`, by name, with the name of their
   * content (see {@link resolvable}).
   */
  readonly resolved: ReadonlyMap<string, string>;
  /** The slots resolved once in each row of the lists being printed, innermost last. */
  readonly #rows: ReadonlyMap<string, string>[] = [];

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
      this.#declare(generatedInterface(component, name, members, model0Span(models)));
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
      this.#declare(generatedInterface(component, name, members, slots.span));
    }
    this.fallthrough = fallthroughRoot(component);
    this.scopeRoots = new Set(scopeRoots(component).map(({ start, end }) => `${start}:${end}`));
    const inline: string[] = [];
    if (this.fallthrough) inline.push(`class?: string`, `style?: ${jsx()}.CSSProperties`);
    if (component.exposes) inline.push(`ref?: (api: ${this.exposedType()}) => void`);
    this.inline = inline.length ? `{ ${inline.join("; ")} }` : undefined;
    this.resolved = this.#resolve(component.render, new Map());
  }

  /**
   * The slots a template, or a list's row, resolves once (src/composition.ts's module comment):
   * each slot without props that it tests, or the default slot where it falls back, which it
   * renders or forwards once at most, outside any list row it holds. One a row renders is
   * resolved in that row, so each row has its own content; one rendered twice is read twice.
   */
  #resolve(root: unknown, around: ReadonlyMap<string, string>): Map<string, string> {
    const use = slotUse(root);
    return new Map(
      (this.component.slots?.slots ?? [])
        .filter(
          (slot) =>
            !slot.props &&
            !around.has(slot.name) &&
            (use.tests.has(slot.name) || use.fallsBack.has(slot.name)) &&
            (use.uses.get(slot.name) ?? 0) <= 1 &&
            !use.rows.has(slot.name),
        )
        .map((slot) => [
          slot.name,
          this.#imports.claim(slot.name === "default" ? "content" : slot.name),
        ]),
    );
  }

  /** The slots a list's row resolves, beside those the component and the rows around it do. */
  rowSlots(body: unknown): Map<string, string> {
    return this.#resolve(
      body,
      new Map([...this.resolved, ...this.#rows.flatMap((row) => [...row])]),
    );
  }

  /** What `print` prints inside a row that resolves `slots`. */
  withinRow<T>(slots: ReadonlyMap<string, string>, print: () => T): T {
    this.#rows.push(slots);
    try {
      return print();
    } finally {
      this.#rows.pop();
    }
  }

  /** The name of a slot's resolved content where it is printed, or none. */
  resolvedSlot(slot: string): string | undefined {
    for (const row of this.#rows.toReversed()) {
      const name = row.get(slot);
      if (name) return name;
    }
    return this.resolved.get(slot);
  }

  /** The type texts the props parameter takes beside the props type and the events. */
  parameterTypes(): string[] {
    return [...this.#references, ...(this.inline ? [this.inline] : [])];
  }

  #declare({ declaration, reference }: GeneratedInterface): void {
    this.types.push(declaration);
    this.#references.push(reference);
  }

  /** Whether the output reads the props object for composition. */
  get reads(): boolean {
    return Boolean(
      this.fallthrough ||
      this.scopeRoots.size ||
      this.component.exposes ||
      this.component.slots ||
      this.component.setup.some((item) => item.kind === "Model"),
    );
  }

  /**
   * The statements that resolve slots, before the setup or at the start of a list's row
   * (`const content = children(() => props.children);`).
   */
  statements(object: string, slots: ReadonlyMap<string, string> = this.resolved): string[] {
    if (!slots.size) return [];
    const children = this.#imports.add("solid-js", "children");
    return [...slots].map(
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

/** What a template, or a row, does with its slots, outside the list rows it holds. */
interface SlotUse {
  /** The slots an expression tests (`slots.title`). */
  tests: Set<string>;
  /** How many times each slot is rendered or forwarded. */
  uses: Map<string, number>;
  /** The default slot, where it is rendered with a fallback. */
  fallsBack: Set<string>;
  /** The slots a list row it holds tests, renders or forwards. */
  rows: Set<string>;
}

/**
 * What a part of the IR does with its slots: it reads every object, so it finds a slot test
 * wherever an expression holds one (a condition, an attribute), and stops at each list's row,
 * whose slots it only notes.
 */
function slotUse(root: unknown): SlotUse {
  const use: SlotUse = { tests: new Set(), uses: new Map(), fallsBack: new Set(), rows: new Set() };
  const visit = (value: unknown, row: boolean): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, row);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    const named = (slot: unknown, count: boolean) => {
      if (typeof slot !== "string") return;
      if (row) use.rows.add(slot);
      else if (count) use.uses.set(slot, (use.uses.get(slot) ?? 0) + 1);
      else use.tests.add(slot);
    };
    if (node.kind === "SlotOutlet") {
      named(node.slot, true);
      if (!row && node.slot === "default" && (node.fallback as unknown[]).length) {
        use.fallsBack.add("default");
      }
    } else if (node.kind === "Slot") named(node.slot, false);
    named(node.forward, true);
    for (const [key, child] of Object.entries(node)) {
      visit(child, row || (node.kind === "For" && key === "body"));
    }
  };
  visit(root, false);
  return use;
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
