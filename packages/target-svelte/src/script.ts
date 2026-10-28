// A component's instance script (plan §6, ADR-0034, ADR-0045 to ADR-0049): the imports from
// `svelte` it needs, the type declarations its props, events and setup reach, copied as written,
// one `$props()` declaration, and the setup in source order, lowered to runes. Svelte reads the
// props through `$props()` in runes mode, so the markup keeps the source's own names: a
// destructured prop is a variable of the script, and the object form's `props.label` reads the
// object `$props()` returns. A ref is a `$state` variable read and written without `.value`, a
// `computed` a `$derived`, a template ref a variable `bind:this` sets, and an event a callback
// prop, `onchange` for `change` (ADR-0012, D8).
import {
  addTypeImports,
  bindingForms,
  childImports,
  componentTypes,
  functionBodyText,
  functionText,
  isPrimitiveState,
  keyImports,
  ImportSet,
  keyOwner,
  NameScope,
  parseExpression,
  parseStatementsSource,
  pascalCase,
  passThroughImports,
  referencedBindings,
  rewriteCode,
  rewriteExpression,
  scopeRoots,
  sourceNames,
  typeDeclarationCode,
  typeExportsCode,
} from "@unframework/codegen";
import type { MarkupOptions, RewriteRules } from "@unframework/codegen";
import { codeOf, expressionsOf, walk } from "@unframework/ir";
import type {
  Binding,
  BindingKind,
  Code,
  DerivedItem,
  ComponentNode,
  DynamicNode,
  ElementNode,
  EventAttribute,
  FragmentNode,
  FunctionCode,
  FunctionItem,
  Handler,
  InjectItem,
  LifecycleItem,
  ModelAttribute,
  ModelItem,
  Parameter,
  ProvideItem,
  RefType,
  RenderNode,
  SetupItem,
  UfComponent,
  UfModule,
  WatchEffectItem,
  WatchItem,
  WatchSource,
} from "@unframework/ir";

import { functionRanges, readsName, visit } from "./ast.ts";
import {
  composedRender,
  hasOwnStyle,
  rootTakesFallthrough,
  slotProp,
  takesFallthrough,
} from "./composition.ts";
import type { Fallthrough } from "./composition.ts";
import { isAttached } from "./events.ts";
import { handlerTypes } from "./handlers.ts";
import { block, escapeScriptEnd, INDENT, reindent } from "./text.ts";

/** What a component's script gives its markup. */
export interface InstanceScript {
  /** The component as the markup prints it: a binding a snippet would hide has its own name. */
  component: UfComponent;
  /**
   * The `<script lang="ts" module>` block of the output that declares the module's injection keys
   * (ADR-0054): absent elsewhere.
   */
  module?: string;
  /** The `<script lang="ts">` block: absent for a component that needs none. */
  block?: string;
  /**
   * How the markup spells references, and writes the listeners Svelte has no attribute for and
   * the fields `modelText` binds.
   */
  markup: Pick<
    MarkupOptions,
    "rewrite" | "attribute" | "handler" | "componentTag" | "scopeRootAttributes" | "candidates"
  >;
  /** The render tree the markup prints (`composition.ts`). */
  render: ElementNode | FragmentNode;
  /** The `styleText` helper's name, where a style is bound to one value (ADR-0065). */
  styleText?: string;
}

/** The modules a script imports from, in the order it prints them. */
type Module = "svelte" | "svelte/elements" | "svelte/events";

/**
 * An import of a sibling output: a child component (its default export) or injection keys; or of
 * the types a module exports, a `.ts` module's or a package's as written (ADR-0067).
 */
interface LocalImport {
  specifier: string;
  default?: string;
  /** Named imports, by local name: the name the sibling output exports, imported under each. */
  names: Map<string, string>;
  /** Type imports, by local name, as `names`. */
  types: Map<string, string>;
}

/**
 * The output's names: the source's (`sourceNames`), which it keeps, and those it claims for its
 * own declarations and imports, which never capture one of them.
 */
class Names {
  readonly scope: NameScope;
  readonly #imports = new Map<Module, Map<string, { local: string; type: boolean }>>();
  readonly #locals = new Map<string, LocalImport>();
  readonly #passThrough = new Map<string, { imported: string; local: string }[]>();

  constructor(component: UfComponent, module: UfModule) {
    this.scope = new NameScope(sourceNames(component, module));
  }

  claim(name: string): string {
    return this.scope.claim(name);
  }

  /** The local name of an import, claimed on first use: `untrack`, or `untrack_1` if taken. */
  import(source: Module, name: string, { type = false }: { type?: boolean } = {}): string {
    let names = this.#imports.get(source);
    if (!names) this.#imports.set(source, (names = new Map()));
    let entry = names.get(name);
    if (entry === undefined) names.set(name, (entry = { local: this.claim(name), type }));
    else if (!type) entry.type = false;
    return entry.local;
  }

  /**
   * A sibling output's default export, under the local name the source uses: the first name a
   * file is imported under, which the markup writes for the others (`componentTag`).
   */
  importDefault(specifier: string, local: string): string {
    const entry = this.#local(specifier);
    if (entry.default === undefined) {
      this.scope.reserve(local);
      entry.default = local;
    }
    return entry.default;
  }

  /**
   * A module that passes through as written (ADR-0064): by name, under the source's own local
   * name, or for its effect alone. These imports follow the others, in the order they are added,
   * each module once: an engine's setup module, or two engines' stylesheets, depend on their
   * order.
   */
  importPassThrough(specifier: string, name?: { imported: string; local: string }): void {
    let names = this.#passThrough.get(specifier);
    if (!names) this.#passThrough.set(specifier, (names = []));
    if (!name || names.some(({ local }) => local === name.local)) return;
    this.scope.reserve(name.local);
    names.push(name);
  }

  /** A name a sibling output exports, under the source's local name: `Theme as Mode`. */
  importNamed(specifier: string, name: string, local: string): void {
    const entry = this.#local(specifier);
    if (entry.names.has(local)) return;
    this.scope.reserve(local);
    entry.names.set(local, name);
  }

  /** A type a module exports, under the source's local name (ADR-0067): `Tone as Mode`. */
  importType(specifier: string, name: string, local: string): void {
    const entry = this.#local(specifier);
    if (entry.types.has(local)) return;
    this.scope.reserve(local);
    entry.types.set(local, name);
  }

  #local(specifier: string): LocalImport {
    let entry = this.#locals.get(specifier);
    if (!entry) {
      this.#locals.set(specifier, (entry = { specifier, names: new Map(), types: new Map() }));
    }
    return entry;
  }

  /** The sibling outputs and the type imports, sorted by specifier. */
  #sortedLocals(): LocalImport[] {
    return [...this.#locals.values()].toSorted((a, b) =>
      a.specifier < b.specifier ? -1 : a.specifier > b.specifier ? 1 : 0,
    );
  }

  /**
   * The import declarations: the sibling outputs sorted by specifier, as the other targets'
   * `ImportSet` sorts them, so the children's sheets load, and cascade, in Vue's order
   * (ADR-0063), with the types imported from each, unless `types` is off; then Svelte's modules,
   * each name sorted, a type-only import written `import type`; then the pass-through imports,
   * in their order (ADR-0064).
   */
  declarations({ types: withTypes = true }: { types?: boolean } = {}): string[] {
    const locals = this.#sortedLocals().flatMap((entry) => {
      const named = [
        ...[...entry.names].map(([local, name]) => importedAs(name, local)),
        ...(withTypes
          ? [...entry.types].map(([local, name]) => `type ${importedAs(name, local)}`)
          : []),
      ];
      if (entry.default === undefined && !named.length) return [];
      // A module that gives only types is imported `import type`, which a bundler drops whole.
      if (entry.default === undefined && !entry.names.size) {
        return [
          `import type ${typeSpecifiers(entry.types)} from ${JSON.stringify(entry.specifier)};`,
        ];
      }
      const clause = [
        ...(entry.default === undefined ? [] : [entry.default]),
        ...(named.length ? [`{ ${named.toSorted(byImportedName).join(", ")} }`] : []),
      ];
      return [`import ${clause.join(", ")} from ${JSON.stringify(entry.specifier)};`];
    });
    const modules = (["svelte", "svelte/elements", "svelte/events"] as const).flatMap((source) => {
      const names = this.#imports.get(source);
      if (!names?.size) return [];
      const types = [...names.values()].every(({ type }) => type);
      return [`import ${types ? "type " : ""}${specifiers(names, !types)} from "${source}";`];
    });
    const passThrough = [...this.#passThrough].map(([specifier, names]) =>
      names.length
        ? `import { ${names.map(({ imported, local }) => (imported === local ? local : `${imported} as ${local}`)).join(", ")} } from ${JSON.stringify(specifier)};`
        : `import ${JSON.stringify(specifier)};`,
    );
    return [...locals, ...modules, ...passThrough];
  }

  /**
   * The type imports alone, each module's `import type`, for the `<script module>` block that
   * declares the types which read them (ADR-0068).
   */
  typeDeclarations(): string[] {
    return this.#sortedLocals()
      .filter((entry) => entry.types.size)
      .map(
        (entry) =>
          `import type ${typeSpecifiers(entry.types)} from ${JSON.stringify(entry.specifier)};`,
      );
  }
}

/** `name`, or `name as local` when the source binds it under another name. */
function importedAs(name: string, local: string): string {
  return name === local ? name : `${name} as ${local}`;
}

/** Sorts import specifiers by the name imported, a `type` one among the others. */
function byImportedName(a: string, b: string): number {
  const [x, y] = [a.replace(/^type /, ""), b.replace(/^type /, "")];
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The specifiers of an `import type`, sorted: `{ FieldProps, Tone as Mode }`. */
function typeSpecifiers(types: ReadonlyMap<string, string>): string {
  return `{ ${[...types]
    .map(([local, name]) => importedAs(name, local))
    .toSorted(byImportedName)
    .join(", ")} }`;
}

/**
 * The `generics` attribute of a generic component's instance script (ADR-0068),
 * ` generics="T extends Item = Item"`, or nothing. An attribute whose text holds a double quote
 * is single-quoted.
 */
function genericsAttribute(component: UfComponent): string {
  if (!component.typeParameters?.length) return "";
  const text = component.typeParameters
    .map(
      (parameter) =>
        `${parameter.name}${parameter.constraint ? ` extends ${parameter.constraint.code}` : ""}${
          parameter.default ? ` = ${parameter.default.code}` : ""
        }`,
    )
    .join(", ");
  return text.includes('"') ? ` generics='${text}'` : ` generics="${text}"`;
}

/** Named import specifiers, sorted: `{ a, type B, c as d }`; `inline` marks the type ones. */
function specifiers(
  names: ReadonlyMap<string, { local: string; type: boolean }>,
  inline = true,
): string {
  if (!names.size) return "";
  const written = [...names]
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, { local, type }]) => {
      const specifier = name === local ? name : `${name} as ${local}`;
      return inline && type ? `type ${specifier}` : specifier;
    });
  return `{ ${written.join(", ")} }`;
}

/** An event's callback prop: its key in the props type, and how the script reads it. */
interface EventProp {
  /** `onchange` for `change`, `onvaluechange` for `valueChange` (D8). */
  key: string;
  /** The destructured variable, when the props are destructured and the script calls it. */
  local?: string;
  /** The callback's type: `(value: number) => void`. */
  type: string;
}

/**
 * The instance script of a component, with what its markup needs to spell the same names: the
 * rewrite of setup bindings (`count.value` → `count`) and of calls of `emit` (`onchange?.(…)`),
 * and the listeners it writes as attachments (`events.ts`).
 */
export function instanceScript(component: UfComponent, module: UfModule): InstanceScript {
  return new ScriptWriter(component, module).write();
}

class ScriptWriter {
  readonly #component: UfComponent;
  readonly #module: UfModule;
  readonly #names: Names;
  readonly #bindings: ReadonlyMap<string, Binding>;
  /** The props object's name in the object form, when the script renames it (`$p` → `props`). */
  #propsObject: string | undefined;
  /** Each declared event's callback prop, by event name. */
  readonly #events = new Map<string, EventProp>();
  /** The functions whose parameters' types Svelte's event types need changed (`handlers.ts`). */
  readonly #functions: ReadonlyMap<FunctionCode, FunctionCode>;
  readonly rules: RewriteRules;
  /** The bindings the output names apart from the source (`snippetNames`). */
  readonly #renamed = new Map<string, string>();
  /** The template refs attached to an element or a component a condition renders. */
  readonly #conditionalRefs: ReadonlySet<string>;
  /** The id `$props.id()` gives, once the first `useId()` claimed it, and the next id's suffix. */
  #id: { local: string; count: number } | undefined;
  /** The local names of the fallthrough `class` and `style`, when the component takes them. */
  #fallthrough: Fallthrough | undefined;
  /** The `refObject` helper's name, once a provided or injected ref needs it. */
  #refObject: string | undefined;
  /**
   * The `scopeAttributes` helper's name and the props it picks from, when the component's root
   * takes its styled parents' scope attributes (`scopeRoots`, ADR-0063).
   */
  #scope: { helper: string; props: string } | undefined;
  /** The variable of each `<component is>` over components (`$derived`), by its node. */
  readonly #dynamic = new Map<RenderNode, string>();
  /** Each slot's snippet variable, where it is not the slot's prop name (`children`, `title`). */
  readonly #slotLocals = new Map<string, string>();
  /** The name the markup writes a child under, where the script imports it under another. */
  readonly #componentTags = new Map<string, string>();

  constructor(component: UfComponent, module: UfModule) {
    this.#module = module;
    this.#names = new Names(component, module);
    // A fill's snippet is named like its slot, which would hide a binding of that name from
    // everything between the child's tags: such a binding takes a name of its own.
    const hidden = snippetNames(component.render);
    const nested = nestedSnippetNames(component);
    const bindings = component.bindings.map((binding) => {
      // A fill's parameter is hidden only by a snippet declared inside its own fill: its own
      // snippet's name is the one its parameter shadows.
      const names = binding.kind === "slotScope" ? nested.get(binding.id) : hidden;
      if (!names?.has(binding.name) || !renamable(binding, component)) return binding;
      this.#renamed.set(binding.id, binding.name);
      return { ...binding, name: this.#names.claim(binding.name) };
    });
    this.#component = this.#renamed.size ? { ...component, bindings } : component;
    component = this.#component;
    this.#bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
    this.#functions = handlerTypes(component);
    this.#conditionalRefs = conditionalRefs(component);
    this.rules = {
      binding: (_reference, binding, written) => this.#read(binding, written),
      emit: (emit, _binding, parts) =>
        `${this.#callback(emit.event)}?.(${parts.arguments.join(", ")})`,
      // `nextTick()` is only awaited (UF2025): Svelte's `tick()` is the same promise.
      api: () => this.#names.import("svelte", "tick"),
      // A slot's presence is its snippet's (ADR-0054).
      slot: (reference) => this.#slotLocal(reference.slot),
    };
  }

  write(): InstanceScript {
    const component = this.#component;
    // The children and the keys keep the source's names (ADR-0053), so they are taken first.
    this.#imports();
    // The names the markup's code reads are claimed before the script's own: `tick` in a handler,
    // `on` and the attachment's parameter for the listeners Svelte has no attribute for, and the
    // `modelText` helper with what its fields read.
    if (usesNextTick(component)) this.#names.import("svelte", "tick");
    const attached = attachedListeners(component);
    const fields = modelTextFields(component);
    const node = attached.length ? this.#names.claim("node") : undefined;
    const on =
      attached.length || fields.length ? this.#names.import("svelte/events", "on") : undefined;
    const once = attached.some((each) => each.once) ? this.#names.claim("once") : undefined;
    const modelText = fields.length ? this.#names.claim("modelText") : undefined;
    const styleText = bindingForms(component).wholeStyle
      ? this.#names.claim("styleText")
      : undefined;
    const untrack = fields.length ? this.#names.import("svelte", "untrack") : undefined;

    const props = this.#props();
    const setup = this.#setup();
    const dynamic = this.#dynamicComponents();
    const owner =
      this.#module.keys?.length &&
      keyOwner(this.#module.components, this.#module.exports) === component.name;
    // The types it copies, and in the output of the module's main component the module's type
    // exports, in source order (ADR-0068). An output that exports a type declares them all in
    // `<script module>`, whose names the instance script reads, so a consumer imports them from
    // the component's file, `import type { ButtonProps } from "./Button.svelte"`.
    const copied = componentTypes(component, this.#module);
    const typeExports = typeExportsCode(component, this.#module, (name) => `${name}.svelte`);
    const types = [
      ...copied.map((declaration) => ({
        code: typeDeclarationCode(declaration),
        span: declaration.span,
      })),
      ...typeExports,
    ]
      .toSorted((a, b) => a.span.start - b.span.start)
      .map(({ code }) => code);
    const moduleScript =
      Boolean(owner) || typeExports.length > 0 || copied.some(({ exported }) => exported);
    const helpers = [
      ...(once ? [onceHelper(once)] : []),
      ...(this.#refObject ? [refObjectHelper(this.#refObject)] : []),
      ...(modelText && on ? [modelTextHelper(modelText, on)] : []),
      ...(this.#fallthrough?.mergeStyle ? [mergeStyleHelper(this.#fallthrough.mergeStyle)] : []),
      ...(styleText ? [styleTextHelper(styleText)] : []),
      ...(this.#scope ? [scopeAttributesHelper(this.#scope.helper)] : []),
    ];
    // The sheet `compile()` emits beside the source, already scoped (ADR-0063), imported after
    // the children's outputs, so a child's sheet loads first, as plugin-vue imports a
    // component's style after its script.
    const file = this.#module.file;
    const imports = [
      ...this.#names.declarations({ types: !moduleScript }),
      ...(component.styles
        ? [`import ${JSON.stringify(`./${file.slice(file.lastIndexOf("/") + 1)}.css`)};`]
        : []),
    ];
    const pieces = [
      ...(imports.length ? [imports.map((line) => `${INDENT}${line}`).join("\n")] : []),
      ...(moduleScript ? [] : types.map((each) => indent(each, INDENT))),
      ...[...props, ...setup, ...dynamic, ...helpers].map((piece) => reindent(piece, INDENT)),
    ];
    const roots = new Set(scopeRoots(component).map(({ start, end }) => `${start}:${end}`));
    const composed = composedRender(
      component,
      this.#fallthrough && styleText ? { ...this.#fallthrough, styleText } : this.#fallthrough,
      this.#dynamic,
      (slot) => this.#slotLocal(slot),
      (parameter) => this.#fillParameter(parameter),
      (expression) => rewriteExpression(expression, component, this.rules, "render"),
    );
    const markup: InstanceScript["markup"] = {
      rewrite: this.rules,
      handler: (attribute) => this.#inlineHandler(attribute),
      attribute: (attribute, element) => {
        if (attribute.kind === "Event" && node !== undefined && on !== undefined) {
          return isAttached(attribute, element)
            ? this.#attachment(attribute, node, on, once)
            : undefined;
        }
        if (attribute.kind === "Model" && modelText !== undefined && untrack !== undefined) {
          return usesModelText(attribute)
            ? this.#modelField(attribute, modelText, untrack)
            : undefined;
        }
        return undefined;
      },
      ...(this.#componentTags.size
        ? { componentTag: (name: string) => this.#componentTags.get(name) }
        : {}),
      // Each node Vue's fallthrough reaches spreads the `data-uf-*` props of the styled parents
      // that render the component, picked by name: they are the parents' (ADR-0063).
      ...(this.#scope
        ? {
            scopeRootAttributes: ({ span }: ElementNode) =>
              roots.has(`${span.start}:${span.end}`)
                ? [`{...${this.#scope!.helper}(${this.#scope!.props})}`]
                : [],
          }
        : {}),
      ...(composed.candidates.size
        ? { candidates: (child: ComponentNode) => composed.candidates.get(child) }
        : {}),
    };
    const moduleBlock = moduleScript ? this.#moduleScript(types, Boolean(owner)) : undefined;
    const result = (instance?: string): InstanceScript => ({
      ...(moduleBlock ? { module: moduleBlock } : {}),
      ...(instance ? { block: instance } : {}),
      component,
      markup,
      render: composed.render,
      ...(styleText ? { styleText } : {}),
    });
    if (!pieces.length) {
      // Svelte parses the markup's code as TypeScript only in a component whose script is: a
      // handler's annotation or cast needs one, though empty.
      return typeScriptInMarkup(component, this.rules)
        ? result('<script lang="ts"></script>')
        : result();
    }
    const body = pieces.join("\n\n");
    return result(
      `<script lang="ts"${genericsAttribute(component)}>\n${escapeScriptEnd(body)}\n</script>`,
    );
  }

  // --- Composition ---------------------------------------------------------------------------

  /**
   * The children's outputs (ADR-0053), each a sibling file's default export imported under the
   * source's name, a component that renders itself included (its own file, as Svelte imports a
   * recursive component); and the injection keys from the outputs that declare them (ADR-0054).
   */
  #imports(): void {
    const component = this.#component;
    for (const child of childImports(component, this.#module, (name) => `${name}.svelte`)) {
      const local = this.#names.importDefault(child.specifier, child.local);
      if (local !== child.local) this.#componentTags.set(child.local, local);
    }
    for (const key of keyImports(component, this.#module, (name) => `${name}.svelte`)) {
      if (key.specifier) this.#names.importNamed(key.specifier, key.name, key.local);
    }
    // The imports that pass through, which the markup reads as written (ADR-0064).
    for (const { specifier, names } of passThroughImports(component, this.#module)) {
      if (!names.length) this.#names.importPassThrough(specifier);
      for (const name of names) this.#names.importPassThrough(specifier, name);
    }
    // The types it reads, by name, under the source's names (ADR-0067): a child's from its
    // output, `./Field.svelte`. Codegen's helper picks them; the script writes its own imports.
    const types = new ImportSet();
    addTypeImports(component, this.#module, types, (name) => `${name}.svelte`);
    for (const declaration of types.toDeclarations()) {
      for (const specifier of declaration.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        const { imported, local } = specifier;
        const name = imported.type === "Identifier" ? imported.name : imported.value;
        this.#names.importType(declaration.source.value, name, local.name);
      }
    }
  }

  /** A key's value type as written, and the ref it holds: the module's own, or an imported one's. */
  #key(local: string): { type: string; ref?: RefType } {
    const own = this.#module.keys?.find((key) => key.name === local);
    if (own) return { type: own.type.code, ...(own.ref ? { ref: own.ref } : {}) };
    for (const entry of this.#module.imports ?? []) {
      const imported = entry.names.find((name) => name.kind === "Key" && name.local === local);
      const key = imported && entry.api.keys.find((each) => each.name === imported.imported);
      if (key) return { type: key.type, ...(key.ref ? { ref: key.ref } : {}) };
    }
    throw new Error(`The module declares or imports no key \`${local}\`.`);
  }

  /**
   * The `<script lang="ts" module>` block of the output that exports a type (ADR-0068) or declares
   * the module's injection keys (ADR-0054): the type imports, the types, and each key a `Symbol`,
   * which `setContext` and `getContext` take, typed with the value it holds
   * (`symbol & { readonly __value: Theme }`). A consumer reads that type from the key it imports
   * (`contextType`), so the output exports no name of its own that could clash with the module's
   * or a component's.
   */
  #moduleScript(types: readonly string[], owner: boolean): string {
    const imports = this.#names.typeDeclarations();
    const keys = owner
      ? this.#module.keys!.map(
          (key) =>
            `export const ${key.name} = Symbol(${JSON.stringify(key.description)}) as symbol & { readonly __value: ${contextValue(key.type.code, key.ref)} };`,
        )
      : [];
    const body = [
      ...(imports.length ? [imports.map((line) => `${INDENT}${line}`).join("\n")] : []),
      ...types.map((each) => indent(each, INDENT)),
      ...(keys.length ? [indent(keys.join("\n"), INDENT)] : []),
    ];
    return `<script lang="ts" module>\n${escapeScriptEnd(body.join("\n\n"))}\n</script>`;
  }

  /**
   * Each `<component is>` over components, as a variable the markup writes as a component:
   * `const Component = $derived(compact ? Chip : Card)` (ADR-0054). Svelte renders a component
   * held in a variable, and renders the new one when it changes.
   */
  #dynamicComponents(): string[] {
    const declarations: string[] = [];
    walk(this.#component.render, {
      enter: (node) => {
        if (node.kind !== "Dynamic") return;
        if (!node.candidates.every((candidate) => candidate.kind === "Component")) return;
        // A condition that reads a block's variable is chosen where it sits (`composition.ts`).
        if (choosesInBlock(node, this.#component)) return;
        const name = this.#names.claim("Component");
        this.#dynamic.set(node, name);
        const is = rewriteExpression(node.is, this.#component, this.rules, "render");
        declarations.push(`const ${name} = $derived(${is});`);
      },
    });
    return declarations.length ? [declarations.join("\n")] : [];
  }

  /**
   * A field `modelText` binds (ADR-0054): its value as the server renders it and the client's
   * first render sets it, read once (`untrack`), since the helper sets it from then on as Vue's
   * `vModelText` does; and the helper as an attachment.
   */
  #modelField(attribute: ModelAttribute, modelText: string, untrack: string): string {
    const value = rewriteExpression(attribute.value, this.#component, this.rules, "render");
    const options = [
      ...(attribute.trim ? ["trim: true"] : []),
      ...(attribute.lazy ? ["lazy: true"] : []),
      ...(attribute.number || attribute.control === "number" ? ["number: true"] : []),
    ];
    const args = [`() => ${value}`, `(value) => (${value} = value)`];
    if (options.length) args.push(`{ ${options.join(", ")} }`);
    return `value={${untrack}(() => ${value})} {@attach ${modelText}(${args.join(", ")})}`;
  }

  /**
   * A fill's parameter with the names the output renamed (`snippetNames`): `{ header }` becomes
   * `{ header: header_1 }`, and `header` becomes `header_1`.
   */
  #fillParameter(parameter: Parameter): Parameter {
    const inside = this.#component.bindings.filter(
      ({ id, kind, span }) =>
        kind === "slotScope" &&
        this.#renamed.has(id) &&
        span.start >= parameter.span.start &&
        span.end <= parameter.span.end,
    );
    if (!inside.length) return parameter;
    if (parameter.name !== undefined) return { ...parameter, name: inside[0]!.name };
    const pattern = parameter.pattern!;
    // The pattern parsed as an arrow's parameter, whose code starts one character in.
    const shorthands = new Set<number>();
    visit(parseExpression(`(${pattern.code}) => 0`), (node) => {
      if (node.type === "Property" && node["shorthand"] === true) shorthands.add(node.start - 1);
    });
    let code = pattern.code;
    for (const binding of inside.toSorted((a, b) => b.span.start - a.span.start)) {
      const start = binding.span.start - pattern.span.start;
      const end = binding.span.end - pattern.span.start;
      const original = this.#renamed.get(binding.id)!;
      const written = shorthands.has(start) ? `${original}: ${binding.name}` : binding.name;
      code = `${code.slice(0, start)}${written}${code.slice(end)}`;
    }
    return { ...parameter, pattern: { ...pattern, code } };
  }

  /** The variable a slot's snippet is read through. */
  #slotLocal(slot: string): string {
    return this.#slotLocals.get(slot) ?? slotProp(slot);
  }

  // --- Spelling ------------------------------------------------------------------------------

  /** How code reads a binding: a ref's value without `.value`, everything else as written. */
  #read(binding: Binding, written: string): string {
    if (this.#renamed.has(binding.id)) return binding.name;
    switch (binding.kind) {
      case "prop":
        return this.#propsObject === undefined ? written : `${this.#propsObject}.${binding.name}`;
      case "state":
      case "derived":
      case "templateRef":
      case "model":
        return binding.name;
      case "loopVar":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
      case "slots":
      case "slotScope":
      case "context":
      case "component":
      // `emit` reports UF1002 for these first (ADR-0069, ADR-0070).
      case "moduleConst":
      case "import":
      case "argument":
      case "usedState":
      case "usedDerived":
      case "usedFn":
      case "usedConst":
        return written;
      default:
        return unreachable(binding.kind);
    }
  }

  /** How code calls an event's callback prop: `onchange`, or `props.onchange` in the object form. */
  #callback(event: string): string {
    const prop = this.#events.get(event);
    if (!prop) throw new Error(`The component declares no event \`${event}\`.`);
    if (prop.local !== undefined) return prop.local;
    return `${this.#propsObjectName()}.${prop.key}`;
  }

  #propsObjectName(): string {
    return this.#propsObject ?? this.#component.propsParameter?.name ?? "props";
  }

  // --- Props ---------------------------------------------------------------------------------

  /**
   * The props' declarations: the events' callback props joined to the source's props type
   * (`type Props = CounterProps & { onchange?: … }`, ADR-0047), with the models, the slots'
   * snippets and the fallthrough `class` and `style` (ADR-0054), and the `$props()` declaration.
   * Destructured props keep their order in the source and their defaults as written; a prop no
   * printed code reads is left out, so the script declares no unused variable (ADR-0034, L5). A
   * model is `$bindable`, with its default as its fallback, so a parent may bind it
   * (`bind:value`) or leave it local.
   */
  #props(): string[] {
    const component = this.#component;
    const parameter = component.propsParameter;
    const emits = component.emits;
    const models = component.setup.filter((item): item is ModelItem => item.kind === "Model");
    const declaredSlots = component.slots?.slots ?? [];
    const fallthrough = takesFallthrough(component);
    const scope = this.#names;
    // A root that takes its styled parents' scope attributes reads them from the props
    // (ADR-0063): the rest of the pattern, or the props object.
    const scoped = scopeRoots(component).length > 0;
    const helper = scoped ? scope.claim("scopeAttributes") : undefined;
    const scopeFrom = (props: string) => {
      if (helper) this.#scope = { helper, props };
      return props;
    };
    if (!parameter && !emits && !models.length && !declaredSlots.length && !fallthrough) {
      if (!scoped) return [];
      // No props of its own: the props object is the parents' attributes, unchecked.
      return [`let ${scopeFrom(scope.claim("attributes"))}: object = $props();`];
    }
    const read = referencedBindings(component);
    const emitted = emittedEvents(component);
    const destructured = parameter?.form !== "object";
    for (const event of emits?.events ?? []) {
      const key = `on${event.name.toLowerCase()}`;
      const type = `(${event.parameters
        .map((each) => `${each.name}${each.optional ? "?" : ""}: ${each.type.code}`)
        .join(", ")}) => void`;
      this.#events.set(event.name, {
        key,
        type,
        ...(destructured && emitted.has(event.name) ? { local: scope.claim(key) } : {}),
      });
    }
    // The members the props type adds to the source's, and what the pattern binds of them.
    const members = [...this.#events.values()].map(({ key, type: each }) => `${key}?: ${each};`);
    const extras: string[] = [];
    for (const model of models) {
      const local = this.#name(model.binding);
      const optional = model.required ? "" : "?";
      members.push(`${model.name}${optional}: ${model.type?.code ?? "unknown"};`);
      const bindable = `$bindable(${model.default?.code ?? ""})`;
      extras.push(`${local === model.name ? model.name : `${model.name}: ${local}`} = ${bindable}`);
    }
    if (declaredSlots.length) {
      const snippet = scope.import("svelte", "Snippet", { type: true });
      const used = usedSlots(component);
      for (const slot of declaredSlots) {
        const prop = slotProp(slot.name);
        members.push(`${prop}?: ${snippet}${slot.props ? `<[${slot.props.code}]>` : ""};`);
        if (!used.has(slot.name)) continue;
        // A source name the prop's would capture (a list's `item`) leaves it to the snippet.
        if (scope.scope.has(prop)) {
          const local = scope.claim(`${prop}Snippet`);
          this.#slotLocals.set(slot.name, local);
          extras.push(`${prop}: ${local}`);
        } else {
          scope.scope.reserve(prop);
          extras.push(prop);
        }
      }
    }
    if (fallthrough) {
      const classValue = scope.import("svelte/elements", "ClassValue", { type: true });
      members.push(`class?: ${classValue};`, "style?: string;");
    }
    // A root component that turns fallthrough off takes neither: the component declares them,
    // as its API says, and renders neither, as Vue's `inheritAttrs: false` child drops them.
    if (fallthrough && rootTakesFallthrough(component, this.#module)) {
      this.#fallthrough = {
        className: scope.claim("className"),
        style: scope.claim("style"),
        ...(hasOwnStyle(component) ? { mergeStyle: scope.claim("mergeStyle") } : {}),
      };
      const { className, style } = this.#fallthrough;
      extras.push(`class: ${className}`, style === "style" ? style : `style: ${style}`);
    }
    const pieces: string[] = [];
    let type = parameter?.type.code;
    if (members.length) {
      const name = scope.scope.has("Props")
        ? scope.claim(`${component.name}Props`)
        : scope.claim("Props");
      pieces.push(`type ${name} = ${eventsJoined(type, members)};`);
      type = name;
    }
    let pattern: string;
    if (parameter?.form === "object") {
      let local = parameter.name!;
      const reads =
        component.bindings.some(({ id, kind }) => kind === "prop" && read.has(id)) ||
        emitted.size > 0 ||
        scoped;
      if (!reads) {
        // An object nothing reads still declares the props, whose type is the component's API,
        // under a name starting with `_`: an unused binding fails L5 (`no-unused-vars`), which
        // leaves such names alone, as React's `_props` (ADR-0034). A name `_` and more says it
        // is unused already: it stays the source's.
        if (!/^_./.test(local)) local = scope.claim(`_${local.replace(/^\$/, "")}`);
      } else if (local.startsWith("$")) {
        // Svelte reserves the `$` prefix for its runes and stores: a script variable named
        // `$props` or `$p` does not compile (`dollar_prefix_invalid`), so the object takes the
        // name `props` there, and every `$p.label` reads `props.label`.
        local = scope.claim("props");
        this.#propsObject = local;
      }
      // The models, the snippets and the fallthrough are bound beside the object, the rest of
      // the props, which a component that reads none of its own leaves out.
      if (!extras.length) pattern = local;
      else pattern = `{ ${[...extras, ...(reads ? [`...${local}`] : [])].join(", ")} }`;
      scopeFrom(local);
    } else {
      const props = new Map(component.props.map((prop) => [prop.binding, prop]));
      const entries = component.bindings.flatMap(({ id, kind }) => {
        const prop = kind === "prop" && read.has(id) ? props.get(id) : undefined;
        if (!prop) return [];
        const local = this.#name(id);
        const bound = local === prop.name ? prop.name : `${prop.name}: ${local}`;
        return [prop.default ? `${bound} = ${prop.default.code}` : bound];
      });
      for (const { key, local } of this.#events.values()) {
        if (local !== undefined) entries.push(local === key ? key : `${key}: ${local}`);
      }
      entries.push(...extras);
      // A component that reads none of its props still declares them, under the object form:
      // the props type is its API, and an empty pattern (`let {}`) is `no-empty-pattern`. The
      // object is named `_props`, as nothing reads it (`no-unused-vars`), or `attributes` where
      // its root reads the scope attributes from it.
      if (!entries.length)
        pattern = scoped ? scopeFrom(scope.claim("attributes")) : scope.claim("_props");
      else if (scoped)
        pattern = `{ ${[...entries, `...${scopeFrom(scope.claim("attributes"))}`].join(", ")} }`;
      else pattern = `{ ${entries.join(", ")} }`;
    }
    pieces.push(`let ${pattern}: ${type!} = $props();`);
    return pieces;
  }

  // --- Setup ---------------------------------------------------------------------------------

  /**
   * The setup items in source order, each as code: one-line declarations that follow each other
   * stay together, and a blank line sets apart everything else, as Svelte code is laid out. A
   * model is a prop (`#props`), so it writes nothing here.
   *
   * An `onUnmounted` hook declared before a watcher or a `watchEffect` with a cleanup comes after
   * the last of them. Vue runs every effect's cleanup when it stops the component's scope, then the
   * `onUnmounted` hooks (ADR-0048), where Svelte tears the component's effects down in the order
   * they were created, an `onMount` teardown among them: a hook printed first would run first,
   * and could close what a cleanup still uses. What it does when the component mounts is nothing,
   * so its place changes nothing else.
   */
  #setup(): string[] {
    const pieces: string[] = [];
    let previousDeclaration = false;
    for (const item of setupInTeardownOrder(this.#component.setup)) {
      if (item.kind === "Model") continue;
      const code = this.#item(item);
      // The first id is two declarations, `$props.id()` and the id itself.
      const declaration = isDeclaration(item) && (item.kind === "Id" || !code.includes("\n"));
      if (declaration && previousDeclaration) pieces[pieces.length - 1] += `\n${code}`;
      else pieces.push(code);
      previousDeclaration = declaration;
    }
    return pieces;
  }

  #item(item: SetupItem): string {
    switch (item.kind) {
      case "State": {
        const name = this.#name(item.binding);
        const rune = isPrimitiveState(item, this.#component, this.#module)
          ? "$state"
          : "$state.raw";
        const type = item.type ? `<${item.type.code}>` : "";
        const initial = item.initial ? this.#setupValue(item.initial) : "";
        return `let ${name} = ${rune}${type}(${initial});`;
      }
      case "Derived":
        return this.#derived(item);
      case "TemplateRef": {
        // A plain variable, as Svelte's documentation binds an element (`bind:this`): no code
        // tracks a template ref (ADR-0049). It holds `null` until the element is there, and
        // Svelte sets it back to `null` once the element is removed, so its type is the
        // source's `T | null` and a read type-checks where the source's does. One whose element
        // a condition renders changes after the first render, which Svelte wants declared with
        // `$state` (`non_reactive_update`).
        const name = this.#name(item.binding);
        const type = item.type ? `${item.type.code} | null` : "unknown";
        if (this.#conditionalRefs.has(item.binding)) return `let ${name} = $state<${type}>(null);`;
        return `let ${name}: ${type} = null;`;
      }
      case "Id": {
        // `$props.id()` once per component, on a declaration of its own
        // (`props_id_invalid_placement`, `props_duplicate`); every id derives from it with a
        // suffix of its own, the first one's included, so the source's `${id}-${n}` of one id
        // never spells another (ADR-0049).
        const name = this.#name(item.binding);
        const first = !this.#id;
        this.#id ??= { local: this.#names.claim("uid"), count: 0 };
        const id = `const ${name} = \`uf-id-\${${this.#id.local}}-${this.#id.count++}\`;`;
        return first ? `const ${this.#id.local} = $props.id();\n${id}` : id;
      }
      case "Const": {
        const name = this.#name(item.binding);
        const type = item.type ? `: ${item.type.code}` : "";
        return `const ${name}${type} = ${this.#setupValue(item.value)};`;
      }
      case "Variable": {
        const name = this.#name(item.binding);
        const type = item.type ? `: ${item.type.code}` : "";
        const initial = item.initial ? ` = ${this.#setupValue(item.initial)}` : "";
        return `let ${name}${type}${initial};`;
      }
      case "Function":
        return this.#function(item);
      case "Watch":
        return this.#watch(item);
      case "WatchEffect":
        return this.#watchEffect(item);
      case "Lifecycle":
        return this.#lifecycle(item);
      case "Provide":
        return this.#provide(item);
      case "Inject":
        return this.#inject(item);
      // A prop (`#props`).
      case "Model":
        return "";
      // `emit` reports UF1002 for a composable's call before this runs (ADR-0069).
      case "Use":
        return "";
      default:
        return unreachable(item);
    }
  }

  /**
   * `provide(Key, value)` (ADR-0054): `setContext`, which the descendants created after it read.
   * A provided ref is passed as `refObject(() => count)`, whose `value` reads the state as it
   * changes (`reactive-context`, emulated); any other value as the setup reads it once.
   */
  #provide(item: ProvideItem): string {
    const setContext = this.#names.import("svelte", "setContext");
    const value = this.#key(item.key).ref
      ? this.#refValue(item.value)
      : this.#setupValue(item.value);
    return `${setContext}(${item.key}, ${value});`;
  }

  /**
   * `inject(Key, fallback)` (ADR-0054): the nearest ancestor's value, `getContext`, or the
   * fallback where none provides the key (`hasContext`). The value is typed with the key's type,
   * which Svelte's untyped keys leave to the call.
   */
  #inject(item: InjectItem): string {
    const name = this.#name(item.binding);
    const getContext = this.#names.import("svelte", "getContext");
    const type = contextType(item.key);
    if (!item.fallback) return `const ${name} = ${getContext}<${orUndefined(type)}>(${item.key});`;
    const hasContext = this.#names.import("svelte", "hasContext");
    const fallback = this.#key(item.key).ref
      ? this.#refValue(item.fallback)
      : this.#setupValue(item.fallback);
    return `const ${name} = ${hasContext}(${item.key}) ? ${getContext}<${type}>(${item.key}) : ${fallback};`;
  }

  /**
   * Setup code whose ref a key holds (`provide(CountKey, count)`): each state, computed value or
   * model it names whole is passed as `refObject(() => count)`.
   */
  #refValue(code: Code): string {
    const rules: RewriteRules = {
      ...this.rules,
      binding: (_reference, binding, written) => {
        const whole =
          written === binding.name &&
          (binding.kind === "state" || binding.kind === "derived" || binding.kind === "model");
        if (!whole) return this.#read(binding, written);
        this.#refObject ??= this.#names.claim("refObject");
        return `${this.#refObject}(() => ${binding.name})`;
      },
    };
    return rewriteCode(code, this.#component, rules, "pure");
  }

  #name(id: string): string {
    const binding = this.#bindings.get(id);
    if (!binding) throw new Error(`Component ${this.#component.name} declares no binding ${id}.`);
    return binding.name;
  }

  /**
   * A value the setup evaluates once (an initial value, a constant): its reads of props, state and
   * derived values at the top of the script are snapshots, which Svelte's compiler warns about
   * (`state_referenced_locally`), so they are wrapped in `untrack`, Svelte's spelling of a read
   * that is not meant to be reactive (ADR-0046).
   */
  #setupValue(code: Code): string {
    const text = rewriteCode(code, this.#component, this.rules, "pure");
    if (!readsReactivelyAtTop(code, this.#bindings)) return text;
    const untrack = this.#names.import("svelte", "untrack");
    return `${untrack}(() => ${text.startsWith("{") ? `(${text})` : text})`;
  }

  #derived(item: DerivedItem): string {
    const name = this.#name(item.binding);
    const type = item.type ? `<${item.type.code}>` : "";
    const getter = item.getter;
    if (getter.expression && !getter.returnType && !getter.async) {
      const body = rewriteCode(getter.body, this.#component, this.rules, "pure");
      return `const ${name} = $derived${type}(${body});`;
    }
    const fn = functionText(getter, this.#component, this.rules, "pure");
    return `const ${name} = $derived.by${type}(${fn});`;
  }

  /**
   * A setup function, exported where `defineExpose` exposes it (ADR-0054): Svelte's component
   * exports are what `bind:this` gives a parent.
   */
  #function(item: FunctionItem): string {
    const name = this.#name(item.binding);
    const fn = this.#functions.get(item.function) ?? item.function;
    const exposed = this.#component.exposes?.functions.includes(item.binding) ?? false;
    // An exposed function the output renames is exported under the name the source exposes.
    const original = this.#renamed.get(item.binding);
    const exported = exposed && original === undefined ? "export " : "";
    const declared =
      item.form === "declaration"
        ? `${exported}${functionText(fn, this.#component, this.rules, "client", { name })}`
        : `${exported}const ${name} = ${functionText(fn, this.#component, this.rules, "client")};`;
    return exposed && original !== undefined
      ? `${declared}\n\nexport const ${original} = ${name};`
      : declared;
  }

  /** A function's body as statements, for a block the target writes around it. */
  #statements(fn: FunctionCode): string {
    return functionBodyText(fn, this.#component, this.rules, "client", { discard: true });
  }

  /**
   * A watcher (ADR-0048): `$effect.pre`, or `$effect` for `flush: "post"`, that reads its sources,
   * and calls back only when one changed by `Object.is` since its last call, with the value it had
   * then. Svelte runs the effect when the setup does and again after any write of what it read, so
   * a watcher that is not `immediate` records the value at creation instead of calling back; one
   * that is calls back on that first run, with `undefined` (or `[]`) as the previous value. The
   * callback runs untracked: what it reads is no source, and what it writes does not run it again. Its `onCleanup` callbacks run right before its next callback, and at unmount.
   */
  #watch(item: WatchItem): string {
    const names = this.#names;
    const untrack = names.import("svelte", "untrack");
    const callback = item.callback;
    const [valueParameter, previousParameter, cleanupParameter] = callback.parameters;
    const lines: string[] = [];
    const sources = item.sources.map((source) => this.#source(source, valueParameter, lines));
    const key = item.array
      ? (valueParameter?.name ??
        sources.map(({ key: each }, index) => (index ? pascalCase(each) : each)).join(""))
      : sources[0]!.key;
    const previous = names.claim(`previous${pascalCase(key)}`);
    const watched = item.immediate ? names.claim(`${key}Watched`) : undefined;
    const stop = cleanupParameter ? names.claim(`cleanup${pascalCase(key)}`) : undefined;
    // An array source's values are a mutable tuple, as Vue hands them to the callback, which may
    // annotate them so (`[number, string]`): a readonly one (`as const`) would fail it (TS4104).
    // Its type is queried inside a function only: at the top of the script, `typeof open` reads
    // the state as its initial value narrows it (`false`, after `let open = $state(false)`, whose
    // declared type is `boolean`), where the effect reads `boolean` (TS2322).
    const tuple = item.array
      ? `[${sources.map(({ read }) => `typeof ${read}`).join(", ")}]`
      : undefined;
    const value = item.array ? `[${sources.map(({ read }) => read).join(", ")}]` : sources[0]!.read;
    // The previous value starts as the sources' value, read in a function for the same reason:
    // an immediate watcher's first call still hands `undefined` (or `[]`), as Vue's does.
    lines.push(`let ${previous} = ${untrack}((${tuple ? `): ${tuple}` : ")"} => ${value});`);
    if (watched) lines.push(`let ${watched} = false;`);
    if (stop) lines.push(`let ${stop}: (() => void) | undefined;`);

    const effect: string[] = [];
    // The new value: under the callback's own parameter where it names one.
    let current: string;
    if (valueParameter?.name !== undefined) {
      current = valueParameter.name;
      const type = valueParameter.type || !tuple ? annotation(valueParameter) : `: ${tuple}`;
      effect.push(`const ${current}${type} = ${value};`);
    } else if (valueParameter || item.array) {
      current = names.claim(item.array ? "values" : "value");
      effect.push(`const ${current}${tuple ? `: ${tuple}` : ""} = ${value};`);
    } else current = value;
    const element = current === "value" ? "next" : "value";
    const unchanged = item.array
      ? `${current}.every((${element}, index) => Object.is(${element}, ${previous}[index]))`
      : `Object.is(${current}, ${previous})`;
    effect.push(`if (${watched ? `${watched} && ` : ""}${unchanged}) return;`);
    const body = this.#statements(callback);
    // The previous value, where the callback reads it: a callback may name it only to reach
    // `onCleanup`, and an unused declaration fails L5.
    if (previousParameter && readsParameter(body, previousParameter)) {
      const binding = previousParameter.name ?? previousParameter.pattern!.code;
      let read = watched
        ? `${watched} ? ${previous} : ${item.array ? "[]" : "undefined"}`
        : previous;
      // Vue types an immediate array watcher's previous values as the tuple with each value
      // possibly `undefined`, though its first call hands `[]`: an annotation written so takes
      // the script's tuple or `[]` as that tuple.
      if (tuple && watched && previousParameter.type) {
        read = `(${read}) as [${sources.map(({ read: each }) => `typeof ${each} | undefined`).join(", ")}]`;
      }
      effect.push(`const ${binding}${annotation(previousParameter)} = ${read};`);
    }
    if (watched) effect.push(`${watched} = true;`);
    effect.push(`${previous} = ${current};`);

    const run: string[] = [];
    if (stop && cleanupParameter) run.push(...this.#cleanups(stop, cleanupParameter));
    if (valueParameter?.pattern) {
      run.push(`const ${valueParameter.pattern.code}${annotation(valueParameter)} = ${current};`);
    }
    run.push(body);
    effect.push(block(`${untrack}(${callback.async ? "async " : ""}() => {`, run, "});"));
    lines.push(block(`${item.post ? "$effect" : "$effect.pre"}(() => {`, effect, "});"));
    if (stop) {
      const onMount = names.import("svelte", "onMount");
      lines.push(`${onMount}(() => () => ${stop}?.());`);
    }
    return lines.join("\n");
  }

  /**
   * What a watcher reads: a ref by its variable; a getter that only reads a prop, a ref or a
   * computed value by that read (`() => title`); any other getter through a `$derived`, declared
   * before the watcher, whose name `key` also gives the watcher's own names.
   */
  #source(
    source: WatchSource,
    valueParameter: Parameter | undefined,
    lines: string[],
  ): { read: string; key: string } {
    switch (source.kind) {
      case "Ref": {
        const name = this.#name(source.binding);
        return { read: name, key: name };
      }
      case "Getter":
        return this.#getterSource(source.getter, valueParameter, lines);
      default:
        return unreachable(source);
    }
  }

  #getterSource(
    getter: FunctionCode,
    valueParameter: Parameter | undefined,
    lines: string[],
  ): { read: string; key: string } {
    const only = getter.expression && !getter.async ? soleRead(getter.body) : undefined;
    if (only) {
      const binding = this.#bindings.get(only.binding)!;
      const written = getter.body.code.trim().replace(/^\(([\s\S]*)\)$/, "$1");
      return { read: this.#read(binding, written), key: binding.name };
    }
    const key = valueParameter?.name ?? "watched";
    const name = this.#names.claim(
      valueParameter?.name === undefined ? "watched" : `watched${pascalCase(key)}`,
    );
    lines.push(
      reindent(
        getter.expression && !getter.returnType && !getter.async
          ? `const ${name} = $derived(${rewriteCode(getter.body, this.#component, this.rules, "pure")});`
          : `const ${name} = $derived.by(${functionText(getter, this.#component, this.rules, "pure")});`,
        "",
      ),
    );
    return { read: name, key };
  }

  /**
   * The `onCleanup` a watcher's callback receives: the callbacks it registers run at the start of
   * the next call, or at unmount (`stop`), never on a run that does not call back.
   */
  #cleanups(stop: string, parameter: Parameter): string[] {
    const cleanups = this.#names.claim("cleanups");
    const name = parameter.name ?? this.#names.claim("onCleanup");
    return [
      `${stop}?.();`,
      `const ${cleanups}: (() => void)[] = [];`,
      block(`${stop} = () => {`, [`for (const cleanup of ${cleanups}) cleanup();`], "};"),
      block(`const ${name} = (cleanup: () => void) => {`, [`${cleanups}.push(cleanup);`], "};"),
    ];
  }

  /**
   * `watchEffect` (ADR-0048): `$effect`, which runs after the first render and again after
   * any value it read changes, and tracks what it reads as Vue does. Its `onCleanup` callbacks
   * run before its next run and at unmount, which is what Svelte does with the function an effect
   * returns: a body that registers one cleanup last returns it, as Svelte code does.
   *
   * An effect function cannot be `async` (Svelte takes what it returns for a teardown), so an
   * async body runs as an async function the effect starts: its part before the first `await`
   * runs while the effect does, which tracks the values it reads, as Vue tracks an async
   * effect's (UF2015 keeps every reactive read there). Its `onCleanup` calls are in that part
   * too (ADR-0048), so the teardown is registered before the effect returns it.
   */
  #watchEffect(item: WatchEffectItem): string {
    const fn = item.effect;
    const body = this.#statements(fn);
    const [parameter] = fn.parameters;
    const started = fn.async ? [block("void (async () => {", [body], "})();")] : undefined;
    // Svelte takes a function the effect returns for its teardown, where Vue drops the value.
    if (!parameter) {
      return block("$effect(() => {", started ?? [withReturns(body, () => "")], "});");
    }
    const name = parameter.name ?? this.#names.claim("onCleanup");
    const returned =
      parameter.name !== undefined && !fn.async ? returnedCleanup(body, name) : undefined;
    if (returned !== undefined) return block("$effect(() => {", [returned], "});");
    // Every way out of the effect returns the teardown that runs what it registered.
    const cleanups = this.#names.claim("cleanups");
    const stop = this.#names.claim("cleanUp");
    return block(
      "$effect(() => {",
      [
        `const ${cleanups}: (() => void)[] = [];`,
        block(`const ${name} = (cleanup: () => void) => {`, [`${cleanups}.push(cleanup);`], "};"),
        block(`const ${stop} = () => {`, [`for (const cleanup of ${cleanups}) cleanup();`], "};"),
        ...(started ?? [withReturns(body, () => ` ${stop}`)]),
        `return ${stop};`,
      ],
      "});",
    );
  }

  /**
   * `onMounted` and `onUnmounted` (ADR-0048): both through `onMount`, which runs in the browser
   * only, after the component's DOM is in the document; `onUnmounted` as the function it returns,
   * which Svelte calls when the component is removed. Never `onDestroy`, which also runs at the
   * end of a server render. A callback always has a block body: Svelte would take a function an
   * expression body returns for a teardown.
   */
  #lifecycle(item: LifecycleItem): string {
    const onMount = this.#names.import("svelte", "onMount");
    const fn = item.callback;
    const head = `${fn.async ? "async " : ""}() => {`;
    // Svelte takes a function `onMount`'s callback returns for its teardown, where Vue drops the
    // value: a synchronous `onMounted` returns nothing.
    return item.hook === "mounted"
      ? block(
          `${onMount}(${head}`,
          [fn.async ? this.#statements(fn) : withReturns(this.#statements(fn), () => "")],
          "});",
        )
      : block(`${onMount}(() => ${head}`, [this.#statements(fn)], "});");
  }

  // --- Listeners -----------------------------------------------------------------------------

  /** An inline handler whose parameter's type Svelte's event types need changed, or `undefined`. */
  #inlineHandler(attribute: EventAttribute): string | undefined {
    const { handler } = attribute;
    switch (handler.kind) {
      case "Function":
        return undefined;
      case "Inline": {
        const fn = this.#functions.get(handler.function);
        return fn && functionText(fn, this.#component, this.rules, "client");
      }
      default:
        return unreachable(handler);
    }
  }

  /** A handler as code: a setup function by its name, an inline handler as an arrow. */
  #handler(handler: Handler): string {
    switch (handler.kind) {
      case "Function":
        return this.#name(handler.binding);
      case "Inline":
        return functionText(
          this.#functions.get(handler.function) ?? handler.function,
          this.#component,
          this.rules,
          "client",
        );
      default:
        return unreachable(handler);
    }
  }

  /**
   * A listener Svelte has no attribute for, as an attachment that listens with `on` from
   * `svelte/events`, with `addEventListener`'s options (`events.ts`). A `once` listener's
   * handler goes through the `once` helper instead of the option: `on` runs the handlers Svelte
   * delegated below the element inside its own listener, so a click one of them stopped still
   * reaches that listener, and `{ once: true }` would remove it though its handler never ran.
   */
  #attachment(
    attribute: EventAttribute,
    node: string,
    on: string,
    once: string | undefined,
  ): string {
    const written = this.#handler(attribute.handler);
    const handler = attribute.once ? `${once!}(${written})` : written;
    const options = [
      ...(attribute.capture ? ["capture: true"] : []),
      ...(attribute.passive ? ["passive: true"] : []),
    ];
    const args = [node, JSON.stringify(attribute.event), handler];
    if (options.length) args.push(`{ ${options.join(", ")} }`);
    return `{@attach (${node}) => ${on}(${args.join(", ")})}`;
  }
}

/**
 * The props type with the events' callback props (ADR-0047): their members added to an object type
 * literal (`{ size: number; onresize?: … }`), or joined to a named type
 * (`StepperProps & { onchange?: … }`), or alone.
 */
function eventsJoined(type: string | undefined, members: readonly string[]): string {
  const literal = type?.trim();
  const inner =
    literal !== undefined && isTypeLiteral(literal) ? literal.slice(1, -1).trim() : undefined;
  const all = [...(inner ? [`${inner}${/[;,]$/.test(inner) ? "" : ";"}`] : []), ...members];
  const object =
    all.length === 1 && !all[0]!.includes("\n")
      ? `{ ${all[0]!.replace(/;$/, "")} }`
      : block("{", all, "}");
  return type === undefined || inner !== undefined ? object : `${type} & ${object}`;
}

/** Whether a type annotation is one object type literal (`{ size: number }`, not a union of them). */
function isTypeLiteral(type: string): boolean {
  if (!type.startsWith("{") || !type.endsWith("}")) return false;
  try {
    const [statement] = parseStatementsSource(`let value: ${type};`).statements;
    return (
      statement?.type === "VariableDeclaration" &&
      statement.declarations[0]?.id.typeAnnotation?.typeAnnotation.type === "TSTypeLiteral"
    );
  } catch {
    return false;
  }
}

/**
 * The setup items, with each `onUnmounted` hook that precedes the last item registering a cleanup
 * (a watcher's callback or a `watchEffect` that takes `onCleanup`) moved right after that item,
 * the hooks keeping their own order.
 */
function setupInTeardownOrder(items: readonly SetupItem[]): SetupItem[] {
  const last = items.findLastIndex(registersCleanup);
  const early = items.filter(
    (item, index) => index < last && item.kind === "Lifecycle" && item.hook === "unmounted",
  );
  if (!early.length) return [...items];
  const rest = items.filter((item) => !early.includes(item));
  const at = rest.indexOf(items[last]!) + 1;
  return [...rest.slice(0, at), ...early, ...rest.slice(at)];
}

/** Whether a setup item registers a cleanup that runs when the component is removed. */
function registersCleanup(item: SetupItem): boolean {
  switch (item.kind) {
    case "Watch":
      return item.callback.parameters.length > 2;
    case "WatchEffect":
      return item.effect.parameters.length > 0;
    default:
      return false;
  }
}

/** Whether an item is a declaration a line long, which the script keeps beside the next one. */
function isDeclaration(item: SetupItem): boolean {
  switch (item.kind) {
    case "State":
    case "Derived":
    case "TemplateRef":
    case "Id":
    case "Const":
    case "Variable":
    case "Model":
    case "Inject":
      return true;
    case "Function":
    case "Watch":
    case "WatchEffect":
    case "Lifecycle":
    case "Provide":
      return false;
    // `emit` reports UF1002 for a composable's call before this runs (ADR-0069).
    case "Use":
      return true;
    default:
      return unreachable(item);
  }
}

/** The events whose callback the component calls somewhere. */
function emittedEvents(component: UfComponent): Set<string> {
  const events = new Set<string>();
  for (const { code } of codeOf(component)) {
    for (const reference of code.refs) if (reference.kind === "Emit") events.add(reference.event);
  }
  return events;
}

/** Whether the component's code calls `nextTick` anywhere. */
function usesNextTick(component: UfComponent): boolean {
  return codeOf(component).some(({ code }) => code.refs.some(({ kind }) => kind === "Api"));
}

/** Whether the markup's code holds TypeScript syntax: an inline handler's annotation or cast. */
function typeScriptInMarkup(component: UfComponent, rules: RewriteRules): boolean {
  let found = false;
  walk(component.render, {
    enter(node) {
      if (found || node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind !== "Event" || attribute.handler.kind !== "Inline") continue;
        const code = functionText(attribute.handler.function, component, rules, "client");
        try {
          visit(parseExpression(code), (each) => {
            if (each.type.startsWith("TS")) found = true;
          });
        } catch {
          found = true;
        }
      }
    },
  });
  return found;
}

/**
 * The template refs attached inside a conditional's branch, to an element or a component, and
 * those on a `<component is>` the markup chooses where it sits (`composition.ts`), whose
 * candidates are the branches of a conditional too.
 */
function conditionalRefs(component: UfComponent): Set<string> {
  const found = new Set<string>();
  let depth = 0;
  walk(component.render, {
    enter(node) {
      if (node.kind === "If") depth++;
      const chosen = node.kind === "Dynamic" && choosesInBlock(node, component);
      if (node.kind !== "Element" && node.kind !== "Component" && !chosen) return;
      if (depth === 0 && !chosen) return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Ref") found.add(attribute.binding);
      }
    },
    leave(node) {
      if (node.kind === "If") depth--;
    },
  });
  return found;
}

/**
 * Whether a `<component is>` over components is chosen where it sits: its condition reads a
 * list's item or a fill's parameter, which a `$derived` in the script cannot see.
 */
function choosesInBlock(node: DynamicNode, component: UfComponent): boolean {
  if (!node.candidates.every((candidate) => candidate.kind === "Component")) return false;
  return node.is.refs.some((reference) => {
    if (reference.kind !== "Binding") return false;
    const kind = component.bindings.find((binding) => binding.id === reference.binding)?.kind;
    return kind === "loopVar" || kind === "slotScope";
  });
}

/**
 * The `once` helper (`event-once`, emulated): the handler it wraps runs the first time the
 * listener calls it, and never again. The attachment calls it once per element, so each element
 * has its own guard, as `{ once: true }` removes the listener from its element only; the guard is
 * set only when the handler runs, so an event that never reached it does not use it up. Svelte's
 * own migration guide writes `once` this way, as a wrapper.
 */
function onceHelper(name: string): string {
  return block(
    `function ${name}<E extends Event>(handler: (event: E) => unknown): (event: E) => void {`,
    [
      "let ran = false;",
      block("return (event) => {", ["if (ran) return;", "ran = true;", "handler(event);"], "};"),
    ],
    "}",
  );
}

/** The type of the value a key holds, read from the key (`#moduleScript`). */
function contextType(key: string): string {
  return `(typeof ${key})["__value"]`;
}

/**
 * The value `getContext` reads under a key, as the key's type writes it: a ref is passed as
 * `refObject`'s object, whose `value` reads it (ADR-0054).
 */
function contextValue(type: string, ref: RefType | undefined): string {
  if (!ref) return type;
  const inner = new RegExp(`^${ref}\\s*<([\\s\\S]*)>$`).exec(type.trim())?.[1] ?? "unknown";
  return `{ readonly value: ${inner.trim()} }`;
}

/** `T | undefined`, with parentheses around a function type, which `|` would split. */
function orUndefined(type: string): string {
  return `${/=>/.test(type) ? `(${type})` : type} | undefined`;
}

/**
 * The names of the snippets the markup declares between a child's tags: each fill of a named
 * slot, and a default fill with a parameter (ADR-0054).
 */
function snippetNames(root: RenderNode | ElementNode | FragmentNode): Set<string> {
  const names = new Set<string>();
  walk(root, {
    enter(node) {
      const fills =
        node.kind === "Component" ? node.fills : node.kind === "Dynamic" ? node.fills : [];
      for (const fill of fills ?? []) {
        if (fill.forward === undefined && (fill.slot !== "default" || fill.parameter)) {
          names.add(slotProp(fill.slot));
        }
      }
    },
  });
  return names;
}

/**
 * For each fill parameter's binding, the names of the snippets declared inside its fill, between
 * the tags of the components the fill renders.
 */
function nestedSnippetNames(component: UfComponent): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  walk(component.render, {
    enter(node) {
      const fills =
        node.kind === "Component" ? node.fills : node.kind === "Dynamic" ? node.fills : [];
      for (const fill of fills ?? []) {
        if (!fill.parameter) continue;
        const { span } = fill.parameter;
        const inner = new Set<string>();
        for (const child of fill.children) for (const name of snippetNames(child)) inner.add(name);
        for (const binding of component.bindings) {
          if (
            binding.kind === "slotScope" &&
            binding.span.start >= span.start &&
            binding.span.end <= span.end
          ) {
            found.set(binding.id, inner);
          }
        }
      }
    },
  });
  return found;
}

/**
 * Whether the output may name a binding apart from the source: a variable it declares, but not a
 * prop read through the props object or a component, an import's name. An exposed function keeps
 * its name in the component's exports (`#function`), and a fill's parameter in the fill's
 * pattern is written under the new one (`#fillParameter`).
 */
function renamable(binding: Binding, component: UfComponent): boolean {
  switch (binding.kind) {
    case "prop":
      return component.propsParameter?.form !== "object";
    case "component":
    case "slots":
    case "emit":
      return false;
    default:
      return true;
  }
}

/**
 * The slots a component reads (ADR-0054): those it renders, tests for presence or forwards. A
 * slot it only declares is in its props type, and bound by no variable.
 */
function usedSlots(component: UfComponent): Set<string> {
  const used = new Set<string>();
  for (const { expression } of expressionsOf(component)) {
    for (const reference of expression.refs)
      if (reference.kind === "Slot") used.add(reference.slot);
  }
  walk(component.render, {
    enter(node) {
      if (node.kind === "SlotOutlet") used.add(node.slot);
      const fills =
        node.kind === "Component" ? node.fills : node.kind === "Dynamic" ? node.fills : [];
      for (const fill of fills ?? []) if (fill.forward !== undefined) used.add(fill.forward);
    },
  });
  return used;
}

/**
 * Whether a field's `v-model` goes through `modelText` (ADR-0054): a number or range input, which
 * the contract casts with Vue's `looseToNumber`, and a modifier, which Svelte's `bind:value` has
 * none of.
 */
function usesModelText(attribute: ModelAttribute): boolean {
  return (
    attribute.trim === true ||
    attribute.lazy === true ||
    attribute.number === true ||
    attribute.control === "number"
  );
}

/** The `v-model`s of fields the markup binds through `modelText`. */
function modelTextFields(component: UfComponent): ModelAttribute[] {
  const found: ModelAttribute[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Model" && usesModelText(attribute)) found.push(attribute);
      }
    },
  });
  return found;
}

/**
 * The `scopeAttributes` helper (`child-root-scope`, emulated, ADR-0063): the props' `data-uf-*`
 * keys, each with the empty value the parent passes. It reads the names alone and passes on no
 * prop the component declares, which a bare rest spread would.
 */
function scopeAttributesHelper(name: string): string {
  return [
    "/** The scope attributes of the styled parents that render this component, for its root. */",
    `function ${name}(props: object): Record<string, ""> {`,
    '  const scope: Record<string, ""> = {};',
    '  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";',
    "  return scope;",
    "}",
  ].join("\n");
}

/**
 * The `mergeStyle` helper (`fallthrough`, emulated, ADR-0054): the root's own declarations with
 * a consumer's `style` over them, as the other targets merge style objects. Svelte writes a
 * consumer's nullish value as an empty declaration (`color: `), which removes the root's own
 * and stays empty in the result, so a component whose root is another component passes it on
 * as Vue's `normalizeStyle` keeps the `undefined`; the CSSOM drops an empty declaration. The
 * consumer's text splits at each `;` outside a string, a comment, an escape or parentheses
 * (`content: "a;b"`).
 */
function mergeStyleHelper(name: string): string {
  return [
    `function ${name}(`,
    "  own: Record<string, string | number | null | undefined>,",
    "  consumer: string | undefined,",
    "): string {",
    "  const merged = { ...own };",
    '  const text = consumer ?? "";',
    "  const add = (declaration: string) => {",
    '    const colon = declaration.indexOf(":");',
    "    if (colon > 0) merged[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();",
    "  };",
    "  let start = 0;",
    "  let depth = 0;",
    '  let quote = "";',
    "  for (let index = 0; index < text.length; index++) {",
    "    const char = text[index];",
    "    if (quote) {",
    '      if (char === "\\\\") index++;',
    '      else if (char === quote) quote = "";',
    '    } else if (char === "\\\\") index++;',
    '    else if (char === "/" && text[index + 1] === "*") {',
    '      const close = text.indexOf("*/", index + 2);',
    "      index = close === -1 ? text.length : close + 1;",
    `    } else if (char === '"' || char === "'") quote = char;`,
    '    else if (char === "(") depth++;',
    '    else if (char === ")") depth--;',
    '    else if (char === ";" && depth === 0) {',
    "      add(text.slice(start, index));",
    "      start = index + 1;",
    "    }",
    "  }",
    "  add(text.slice(start));",
    "  return Object.entries(merged)",
    '    .map(([property, value]) => `${property}: ${value ?? ""}`)',
    '    .join("; ");',
    "}",
  ].join("\n");
}

/**
 * The `styleText` helper (`style-binding`, emulated, ADR-0065): a style bound to one value as
 * the declaration list Svelte's `style` takes. A string is the list itself; an object, keyed as
 * an object literal's are, is one declaration per present value, in kebab case, as Vue's
 * `stringifyStyle` writes it.
 */
function styleTextHelper(name: string): string {
  return [
    `function ${name}(`,
    "  style: object | string | null | undefined,",
    "): string | undefined {",
    '  if (style === null || style === undefined || typeof style === "string") return style ?? undefined;',
    "  return Object.entries(style)",
    '    .filter(([, value]) => value !== null && value !== undefined && value !== "")',
    "    .map(([key, value]) => {",
    '      const property = key.startsWith("--") ? key : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);',
    "      return `${property}: ${value}`;",
    "    })",
    '    .join("; ");',
    "}",
  ].join("\n");
}

/**
 * The `refObject` helper (`reactive-context`, emulated, ADR-0054): a provided ref as an object
 * whose `value` reads it, so a descendant that reads `count.value` in its markup or its effects
 * tracks the state, as it tracks Vue's ref.
 */
function refObjectHelper(name: string): string {
  return block(
    `function ${name}<T>(get: () => T): { readonly value: T } {`,
    [block("return {", [block("get value() {", ["return get();"], "},")], "};")],
    "}",
  );
}

/**
 * The `modelText` helper (`model-modifiers`, emulated, ADR-0054): Vue's `vModelText` as an
 * attachment. It writes the field's text on `input` (`change` when lazy), trimmed and cast with
 * `looseToNumber` as its modifiers say, trims the shown text on `change`, and shows the value
 * when it changes, unless the field shows it already (as a number when it casts), or the user is
 * typing in it and only its trimmed text differs.
 */
function modelTextHelper(name: string, on: string): string {
  return [
    `function ${name}<T>(`,
    "  get: () => T,",
    "  set: (value: T) => void,",
    "  { trim = false, lazy = false, number = false } = {},",
    ") {",
    "  const cast = (text: string): string | number => {",
    "    const parsed = Number.parseFloat(text);",
    "    return Number.isNaN(parsed) ? text : parsed;",
    "  };",
    "  return (field: HTMLInputElement | HTMLTextAreaElement) => {",
    "    $effect(() => {",
    '      const value = get() ?? "";',
    String.raw`      const shown = number && !/^0\d/.test(field.value) ? cast(field.value) : field.value;`,
    "      if (shown === value) return;",
    '      const typing = document.activeElement === field && field.type !== "range";',
    "      if (typing && trim && field.value.trim() === value) return;",
    "      field.value = String(value);",
    "    });",
    `    const stopWriting = ${on}(field, lazy ? "change" : "input", () => {`,
    "      const text = trim ? field.value.trim() : field.value;",
    "      set((number ? cast(text) : text) as T);",
    "    });",
    `    const stopTrimming = ${on}(field, "change", () => {`,
    "      if (trim) field.value = field.value.trim();",
    "    });",
    "    return () => {",
    "      stopWriting();",
    "      stopTrimming();",
    "    };",
    "  };",
    "}",
  ].join("\n");
}

/** The listeners the markup writes as attachments. */
function attachedListeners(component: UfComponent): EventAttribute[] {
  const found: EventAttribute[] = [];
  walk(component.render, {
    enter(node) {
      if (node.kind !== "Element") return;
      for (const attribute of node.attributes) {
        if (attribute.kind === "Event" && isAttached(attribute, node)) found.push(attribute);
      }
    },
  });
  return found;
}

/**
 * Whether setup code reads a prop, a state or a derived value outside any function it holds: a
 * read at the top of the script, which takes the value once.
 */
function readsReactivelyAtTop(code: Code, bindings: ReadonlyMap<string, Binding>): boolean {
  const reads = code.refs.filter((reference) => {
    if (reference.kind !== "Binding") return false;
    const binding = bindings.get(reference.binding);
    return binding !== undefined && isReactive(binding.kind);
  });
  if (!reads.length) return false;
  const functions = functionRanges(parseExpression(code.code));
  return reads.some(({ span }) => {
    const start = span.start - code.span.start;
    return !functions.some((range) => range.start <= start && start < range.end);
  });
}

/** Whether reading a binding reads a reactive value: a prop, a state or a derived value. */
function isReactive(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "state":
    case "derived":
    case "model":
      return true;
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
    case "slots":
    case "slotScope":
    case "context":
    case "component":
    // `emit` reports UF1002 for these first (ADR-0069, ADR-0070).
    case "moduleConst":
    case "import":
    case "argument":
    case "usedState":
    case "usedDerived":
    case "usedFn":
    case "usedConst":
      return false;
    default:
      return unreachable(kind);
  }
}

/**
 * The one binding a getter's expression body reads, when it is nothing but that read
 * (`() => title`, `() => count.value`, `() => props.title`): a prop, a state or a derived value.
 */
function soleRead(body: Code): { binding: string } | undefined {
  const [reference, ...rest] = body.refs;
  if (rest.length || reference?.kind !== "Binding") return undefined;
  const code = body.code
    .trim()
    .replace(/^\(([\s\S]*)\)$/, "$1")
    .trim();
  const written = body.code.slice(
    reference.span.start - body.span.start,
    reference.span.end - body.span.start,
  );
  return code === written ? { binding: reference.binding } : undefined;
}

/** Whether a function's body (as statements) reads any name a parameter declares. */
function readsParameter(body: string, parameter: Parameter): boolean {
  const names = parameter.name !== undefined ? [parameter.name] : (parameter.pattern?.names ?? []);
  let statements;
  try {
    ({ statements } = parseStatementsSource(body));
  } catch {
    return true;
  }
  return names.some((name) => readsName(statements, name));
}

/** A parameter's annotation, `: number`, or nothing. */
function annotation(parameter: Parameter): string {
  return parameter.type ? `: ${parameter.type.code}` : "";
}

/** Expressions whose evaluation does nothing: a returned one is dropped, not run. */
const INERT_EXPRESSIONS: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "Identifier",
  "Literal",
]);

/**
 * A function's body with each of its own `return` statements (not a nested function's) returning
 * `returned()` instead (` stop`, or nothing): a returned value's expression still runs, as a
 * statement before it.
 */
function withReturns(body: string, returned: () => string): string {
  let statements;
  try {
    ({ statements } = parseStatementsSource(body));
  } catch {
    return body;
  }
  const functions = functionRanges(statements);
  const returns: { start: number; end: number; argument?: { start: number; end: number } }[] = [];
  visit(statements, (node) => {
    if (node.type !== "ReturnStatement") return;
    if (functions.some((range) => range.start < node.start && node.end <= range.end)) return;
    const argument = node["argument"] as { type: string; start: number; end: number } | null;
    // A value that does nothing when evaluated (a function, a name, a literal) is dropped.
    const inert = argument !== null && INERT_EXPRESSIONS.has(argument.type);
    returns.push({ start: node.start, end: node.end, ...(argument && !inert ? { argument } : {}) });
  });
  let result = body;
  for (const { start, end, argument } of returns.toSorted((a, b) => b.start - a.start)) {
    const statement = `return${returned()};`;
    const code = argument
      ? `{\n${expressionStatement(body.slice(argument.start, argument.end))}\n${statement}\n}`
      : statement;
    result = `${result.slice(0, start)}${code}${result.slice(end)}`;
  }
  return result;
}

/** An expression as a statement: in parentheses where a statement would read it otherwise. */
function expressionStatement(code: string): string {
  return /^(?:\{|function\b|class\b|async\s+function\b|let\s*\[)/.test(code)
    ? `(${code});`
    : `${code};`;
}

/**
 * A `watchEffect` body whose last statement registers its one cleanup, `onCleanup(() => …)`,
 * with that statement turned into `return () => …`: what Svelte runs before the effect's next
 * run and at unmount. `undefined` where the body uses `onCleanup` otherwise, or returns early.
 */
function returnedCleanup(body: string, name: string): string | undefined {
  let statements;
  try {
    ({ statements } = parseStatementsSource(body));
  } catch {
    return undefined;
  }
  const last = statements.at(-1);
  if (
    last?.type !== "ExpressionStatement" ||
    last.expression.type !== "CallExpression" ||
    last.expression.callee.type !== "Identifier" ||
    last.expression.callee.name !== name ||
    last.expression.arguments.length !== 1
  ) {
    return undefined;
  }
  const [argument] = last.expression.arguments;
  if (argument?.type !== "ArrowFunctionExpression" && argument?.type !== "FunctionExpression") {
    return undefined;
  }
  let uses = 0;
  let returns = false;
  const functions = functionRanges(statements);
  visit(statements, (node) => {
    if (node.type === "Identifier" && node["name"] === name) uses++;
    if (
      node.type === "ReturnStatement" &&
      !functions.some((range) => range.start < node.start && node.end <= range.end)
    ) {
      returns = true;
    }
  });
  if (uses !== 1 || returns) return undefined;
  return `${body.slice(0, last.start)}return ${body.slice(argument.start, argument.end)};`;
}

/**
 * Copied code indented by `pad`, but for the lines that start inside a string or template
 * literal (a line continuation, a template's text), whose value indenting them would change.
 * The formatter indents the script the same way (ADR-0041); the target indents it too, so the
 * output it serves unformatted reads alike.
 */
export function indent(code: string, pad: string): string {
  const literal = literalLines(code);
  return code
    .split("\n")
    .map((line, index) => (line === "" || literal.has(index) ? line : `${pad}${line}`))
    .join("\n");
}

/**
 * The indices of the lines of `code` that start inside a string or template literal. A scan of
 * the copied code, which is a type declaration or a static default (ADR-0034): comments, string
 * and template literals, and the code in a template's substitutions; no regular expression, as
 * neither may hold one.
 */
function literalLines(code: string): Set<number> {
  const lines = new Set<number>();
  type State = "code" | "line comment" | "block comment" | "'" | '"' | "`";
  let state: State = "code";
  // The depth of `{` inside each open `${…}` substitution, innermost last.
  const substitutions: number[] = [];
  let line = 0;
  for (let index = 0; index < code.length; index++) {
    const char = code[index]!;
    const next = code[index + 1];
    if (char === "\n") {
      line++;
      if (state === "line comment") state = "code";
      else if (state === "'" || state === '"' || state === "`") lines.add(line);
      continue;
    }
    switch (state) {
      case "line comment":
        break;
      case "block comment":
        if (char === "*" && next === "/") {
          state = "code";
          index++;
        }
        break;
      case "'":
      case '"':
      case "`":
        // An escape skips the next character, but for a line continuation's line break,
        // which starts a line inside the literal.
        if (char === "\\") {
          if (next !== "\n") index++;
        } else if (char === state) state = "code";
        else if (state === "`" && char === "$" && next === "{") {
          substitutions.push(0);
          state = "code";
          index++;
        }
        break;
      case "code":
        if (char === "/" && next === "/") state = "line comment";
        else if (char === "/" && next === "*") {
          state = "block comment";
          index++;
        } else if (char === "'" || char === '"' || char === "`") state = char;
        else if (substitutions.length && char === "{") substitutions[substitutions.length - 1]!++;
        else if (substitutions.length && char === "}") {
          if (substitutions.at(-1) === 0) {
            substitutions.pop();
            state = "`";
          } else substitutions[substitutions.length - 1]!--;
        }
        break;
      default:
        state satisfies never;
    }
  }
  return lines;
}

function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
