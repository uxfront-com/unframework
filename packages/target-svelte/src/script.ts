// A component's instance script (plan §6, ADR-0034, ADR-0045 to ADR-0049): the imports from
// `svelte` it needs, the type declarations its props, events and setup reach, copied as written,
// one `$props()` declaration, and the setup in source order, lowered to runes. Svelte reads the
// props through `$props()` in runes mode, so the markup keeps the source's own names: a
// destructured prop is a variable of the script, and the object form's `props.label` reads the
// object `$props()` returns. A ref is a `$state` variable read and written without `.value`, a
// `computed` a `$derived`, a template ref a variable `bind:this` sets, and an event a callback
// prop, `onchange` for `change` (ADR-0012, D8).
import {
  componentTypes,
  functionBodyText,
  functionText,
  isPrimitiveState,
  NameScope,
  parseExpression,
  parseStatementsSource,
  pascalCase,
  referencedBindings,
  rewriteCode,
  sourceNames,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { MarkupOptions, RewriteRules } from "@unframework/codegen";
import { codeOf, walk } from "@unframework/ir";
import type {
  Binding,
  BindingKind,
  Code,
  DerivedItem,
  EventAttribute,
  FunctionCode,
  FunctionItem,
  Handler,
  LifecycleItem,
  Parameter,
  SetupItem,
  UfComponent,
  UfModule,
  WatchEffectItem,
  WatchItem,
  WatchSource,
} from "@unframework/ir";

import { functionRanges, readsName, visit } from "./ast.ts";
import { isAttached } from "./events.ts";
import { handlerTypes } from "./handlers.ts";
import { block, escapeScriptEnd, INDENT, reindent } from "./text.ts";

/** What a component's script gives its markup. */
export interface InstanceScript {
  /** The `<script lang="ts">` block: absent for a component that needs none. */
  block?: string;
  /** How the markup spells references, and writes the listeners Svelte has no attribute for. */
  markup: Pick<MarkupOptions, "rewrite" | "attribute" | "handler">;
}

/** The modules a script imports from, in the order it prints them. */
type Module = "svelte" | "svelte/events";

/**
 * The output's names: the source's (`sourceNames`), which it keeps, and those it claims for its
 * own declarations and imports, which never capture one of them.
 */
class Names {
  readonly scope: NameScope;
  readonly #imports = new Map<Module, Map<string, string>>();

  constructor(component: UfComponent, module: UfModule) {
    this.scope = new NameScope(sourceNames(component, module));
  }

  claim(name: string): string {
    return this.scope.claim(name);
  }

  /** The local name of an import, claimed on first use: `untrack`, or `untrack_1` if taken. */
  import(source: Module, name: string): string {
    let names = this.#imports.get(source);
    if (!names) this.#imports.set(source, (names = new Map()));
    let local = names.get(name);
    if (local === undefined) names.set(name, (local = this.claim(name)));
    return local;
  }

  /** The import declarations, by module, each name sorted. */
  declarations(): string[] {
    return (["svelte", "svelte/events"] as const).flatMap((source) => {
      const names = this.#imports.get(source);
      if (!names?.size) return [];
      const specifiers = [...names]
        .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, local]) => (name === local ? name : `${name} as ${local}`));
      return [`import { ${specifiers.join(", ")} } from "${source}";`];
    });
  }
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
  /** The template refs attached to an element a condition renders. */
  readonly #conditionalRefs: ReadonlySet<string>;
  /** The id `$props.id()` gives, once the first `useId()` claimed it, and the next id's suffix. */
  #id: { local: string; count: number } | undefined;

  constructor(component: UfComponent, module: UfModule) {
    this.#component = component;
    this.#module = module;
    this.#names = new Names(component, module);
    this.#bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
    this.#functions = handlerTypes(component);
    this.#conditionalRefs = conditionalRefs(component);
    this.rules = {
      binding: (_reference, binding, written) => this.#read(binding, written),
      emit: (emit, _binding, parts) =>
        `${this.#callback(emit.event)}?.(${parts.arguments.join(", ")})`,
      // `nextTick()` is only awaited (UF2025): Svelte's `tick()` is the same promise.
      api: () => this.#names.import("svelte", "tick"),
    };
  }

  write(): InstanceScript {
    // The names the markup's code reads are claimed before the script's own: `tick` in a handler,
    // `on` and the attachment's parameter for the listeners Svelte has no attribute for.
    if (usesNextTick(this.#component)) this.#names.import("svelte", "tick");
    const attached = attachedListeners(this.#component);
    const node = attached.length ? this.#names.claim("node") : undefined;
    const on = attached.length ? this.#names.import("svelte/events", "on") : undefined;
    const once = attached.some((each) => each.once) ? this.#names.claim("once") : undefined;

    const props = this.#props();
    const setup = this.#setup();
    const types = componentTypes(this.#component, this.#module).map(typeDeclarationCode);
    const imports = this.#names.declarations();
    const pieces = [
      ...(imports.length ? [imports.map((line) => `${INDENT}${line}`).join("\n")] : []),
      ...types.map((each) => indent(each, INDENT)),
      ...[...props, ...setup, ...(once ? [onceHelper(once)] : [])].map((piece) =>
        reindent(piece, INDENT),
      ),
    ];
    const markup: InstanceScript["markup"] = {
      rewrite: this.rules,
      handler: (attribute) => this.#inlineHandler(attribute),
      ...(node !== undefined && on !== undefined
        ? {
            attribute: (attribute, element) =>
              attribute.kind === "Event" && isAttached(attribute, element)
                ? this.#attachment(attribute, node, on, once)
                : undefined,
          }
        : {}),
    };
    if (!pieces.length) {
      // Svelte parses the markup's code as TypeScript only in a component whose script is: a
      // handler's annotation or cast needs one, though empty.
      return typeScriptInMarkup(this.#component, this.rules)
        ? { block: '<script lang="ts"></script>', markup }
        : { markup };
    }
    const body = pieces.join("\n\n");
    return { block: `<script lang="ts">\n${escapeScriptEnd(body)}\n</script>`, markup };
  }

  // --- Spelling ------------------------------------------------------------------------------

  /** How code reads a binding: a ref's value without `.value`, everything else as written. */
  #read(binding: Binding, written: string): string {
    switch (binding.kind) {
      case "prop":
        return this.#propsObject === undefined ? written : `${this.#propsObject}.${binding.name}`;
      case "state":
      case "derived":
      case "templateRef":
        return binding.name;
      case "loopVar":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
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
   * (`type Props = CounterProps & { onchange?: … }`, ADR-0047), and the `$props()` declaration.
   * Destructured props keep their order in the source and their defaults as written; a prop no
   * printed code reads is left out, so the script declares no unused variable (ADR-0034, L5).
   */
  #props(): string[] {
    const component = this.#component;
    const parameter = component.propsParameter;
    const emits = component.emits;
    if (!parameter && !emits) return [];
    const scope = this.#names;
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
    const pieces: string[] = [];
    let type = parameter?.type.code;
    if (emits) {
      const members = [...this.#events.values()].map(({ key, type: each }) => `${key}?: ${each};`);
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
        emitted.size > 0;
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
      pattern = local;
    } else {
      const props = new Map(component.props.map((prop) => [prop.binding, prop]));
      const entries = component.bindings.flatMap(({ id, kind }) => {
        const prop = kind === "prop" && read.has(id) ? props.get(id) : undefined;
        if (!prop) return [];
        return [prop.default ? `${prop.name} = ${prop.default.code}` : prop.name];
      });
      for (const { key, local } of this.#events.values()) {
        if (local !== undefined) entries.push(local === key ? key : `${key}: ${local}`);
      }
      // A component that reads none of its props still declares them, under the object form:
      // the props type is its API, and an empty pattern (`let {}`) is `no-empty-pattern`. The
      // object is named `_props`, as nothing reads it (`no-unused-vars`).
      pattern = entries.length ? `{ ${entries.join(", ")} }` : scope.claim("_props");
    }
    pieces.push(`let ${pattern}: ${type!} = $props();`);
    return pieces;
  }

  // --- Setup ---------------------------------------------------------------------------------

  /**
   * The setup items in source order, each as code: one-line declarations that follow each other
   * stay together, and a blank line sets apart everything else, as Svelte code is laid out.
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
      default:
        return unreachable(item);
    }
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

  #function(item: FunctionItem): string {
    const name = this.#name(item.binding);
    const fn = this.#functions.get(item.function) ?? item.function;
    if (item.form === "declaration") {
      return functionText(fn, this.#component, this.rules, "client", { name });
    }
    return `const ${name} = ${functionText(fn, this.#component, this.rules, "client")};`;
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
      return true;
    case "Function":
    case "Watch":
    case "WatchEffect":
    case "Lifecycle":
      return false;
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

/** The template refs attached inside a conditional's branch. */
function conditionalRefs(component: UfComponent): Set<string> {
  const found = new Set<string>();
  let depth = 0;
  walk(component.render, {
    enter(node) {
      if (node.kind === "If") depth++;
      if (node.kind !== "Element" || depth === 0) return;
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
      return true;
    case "loopVar":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
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
