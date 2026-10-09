// A component's `<script setup lang="ts">` block (plan §6, ADR-0034, ADR-0045): the imports
// from `vue`, the type declarations the component reaches, copied as written, one `defineProps`
// declaration, the `defineEmits` declaration, then the setup in source order, which is the
// source's own code: Vue's Composition API is the source language's (plan §4), so a ref is read
// and written through `.value` as written, and only the macros' arguments and a few APIs change
// (`useTemplateRef("name")`, `watchPostEffect`, the `uf-id-` prefix). Last come the functions the
// template's listeners call where a handler cannot stay in the template (`listeners.ts`).
import {
  bindingOf,
  childImports,
  keyImports,
  keyOwner,
  componentTypes,
  functionText,
  ImportSet,
  isPrimitiveState,
  js,
  printProgram,
  referencedBindings,
  rewriteCode,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { RewriteRules } from "@unframework/codegen";
import { codeOf, expressionsOf, walk } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  Code,
  FunctionCode,
  Prop,
  PropsParameter,
  SetupItem,
  StateItem,
  TypeText,
  UfComponent,
  UfModule,
  WatchItem,
  WatchSource,
} from "@unframework/ir";

import { planListeners } from "./listeners.ts";
import type { Listeners } from "./listeners.ts";
import { unreachable, VUE_RESERVED, VueNames } from "./names.ts";

/** What a component's script gives its template. */
export interface ScriptSetup {
  /** The `<script setup lang="ts">` block: absent for a component with nothing to declare. */
  block?: string;
  /** How the template spells references: a setup ref's value is the ref, which Vue unwraps. */
  rewrite: RewriteRules;
  /** Each listener's attribute, as the template writes it. */
  listeners: Listeners;
  /** The name the script imports a child under, where it is not the child's own. */
  components: ReadonlyMap<string, string>;
  /**
   * The `<script lang="ts">` block of the output that declares the module's injection keys
   * (ADR-0054), which a `<script setup>` cannot export: absent elsewhere.
   */
  keys?: string;
}

/**
 * The components Vue's template compiler resolves by name before any binding (`isCoreComponent`
 * and runtime-dom's transitions, and `Component`, its dynamic component): a child named so is
 * imported, and written, under a name of its own.
 */
const VUE_BUILT_INS: ReadonlySet<string> = new Set([
  "BaseTransition",
  "Component",
  "KeepAlive",
  "Suspense",
  "Teleport",
  "Transition",
  "TransitionGroup",
]);

/** A statement of the script, and how it sits beside its neighbours. */
interface Statement {
  code: string;
  /**
   * `macro` for `defineProps` and `defineEmits`, `line` for a declaration on one line: a run of
   * either stays together, and a blank line separates everything else, as a person lays out a
   * script.
   */
  layout: "macro" | "line" | "block";
}

/**
 * The script of a component: present when it takes props, declares events, runs setup code or
 * has a listener the template cannot hold. The props are declared as below; the events with
 * `defineEmits<E>()` and the source's type argument, right after the props as Vue's style guide
 * orders the macros (an immediate watcher, the only setup-time code that emits, must follow its
 * declaration, UF2023, so moving it up changes nothing); every other item where the source has
 * it.
 *
 * Destructured (Vue 3.5's reactive props destructure), every optional prop gets a default: the
 * source's, or `undefined`. Vue casts an absent `Boolean` prop without a default to `false`,
 * where every other target leaves it `undefined` (ADR-0034); and once props are destructured,
 * `vue/require-default-prop` asks for a default for each optional one, read or not, so those
 * stay in the pattern even when nothing reads them. Such a prop is bound under a local that
 * starts with `_` (`size: _size = 2`), which L5's unused-variable rule ignores, as it ignores
 * the other targets' `_props` (ADR-0042). Vue keeps that prefix for its own names, but it
 * compiles the pattern away, every read into one of `__props`, so the local never meets the
 * names its compiled code declares (`_ctx`, `_cache`, `_toDisplayString`), and the template
 * never reads it. (`withDefaults` without a pattern would need no such local, but it changes
 * how every read prop is declared, and a template reads a prop named `Map` as the global.) A
 * required prop is in the pattern when any code reads it, the setup's and the handlers'
 * included. A component that reads no prop declares them with the macro alone: its defaults
 * would change nothing, and the rule asks for none there.
 *
 * The object form is `const props = defineProps<P>()`, through `withDefaults` with an
 * `undefined` default for each optional prop, for the same two reasons.
 */
export function scriptSetup(component: UfComponent, module: UfModule): ScriptSetup {
  const names = new VueNames(component, module);
  const imports = new ImportSet(names.scope);
  // Each child's output, by the name the template uses (ADR-0053), a component of the same file
  // included. A component that renders itself names itself instead: a virtual module's file name
  // is not its name (ADR-0021), and importing its own file fails `import/no-self-import` (L5).
  // A name Vue keeps for a built-in is claimed last, so it never takes a child's own name.
  const children = childImports(component, module, (name) => `${name}.vue`);
  const components = new Map<string, string>();
  for (const child of children) {
    if (!child.self && !VUE_BUILT_INS.has(child.local)) {
      imports.addDefault(child.specifier, child.local, { exact: true });
    }
  }
  for (const child of children) {
    if (!VUE_BUILT_INS.has(child.local)) continue;
    const local = `${child.local}Component`;
    components.set(
      child.local,
      child.self ? names.scope.claim(local) : imports.addDefault(child.specifier, local),
    );
  }
  for (const key of keyImports(component, module, (name) => `${name}.vue`)) {
    if (key.specifier) imports.add(key.specifier, key.name, { local: key.local, exact: true });
  }
  // The output of the module's main component declares the keys, and the types it copies, in a
  // plain `<script lang="ts">` block, which `<script setup>` reads.
  const keys =
    module.keys?.length && keyOwner(module.components, module.exports) === component.name
      ? keyBlock(component, module, names)
      : undefined;
  // `<component is>` reads a candidate by its binding, under the alias of a built-in's name too.
  for (const binding of component.bindings) {
    const alias = binding.kind === "component" ? components.get(binding.name) : undefined;
    if (alias) names.rename(binding.id, alias);
  }
  const self = children.find((child) => child.self);
  const recursive = self && (components.get(self.local) ?? self.local);
  const statements: Statement[] = [];
  const parameter = component.propsParameter;
  if (parameter) {
    const read = referencedBindings(component);
    statements.push({
      code:
        parameter.form === "object"
          ? objectDeclaration(component, parameter, names, read)
          : destructuredDeclaration(component, parameter, names, read),
      layout: "macro",
    });
  }
  const script = names.scriptRules(() => imports.add("vue", "nextTick"));
  const template = names.templateRules();
  // Planned before the setup is printed: a listener's script function claims its name first,
  // in document order, as the template reads it.
  const listeners = planListeners(component, names, { script, template });
  if (component.emits) {
    const { emits } = component;
    const emit = bindingOf(component, emits.binding);
    // An `emit` nothing calls declares the events alone, as `defineProps` without a pattern.
    const declared = emitIsCalled(component, emit) ? `const ${names.local(emit)} = ` : "";
    statements.push({ code: `${declared}defineEmits<${emits.type.code}>();`, layout: "macro" });
  }
  if (component.slots) {
    const binding = bindingOf(component, component.slots.binding);
    // Bound only where the template tests or forwards a slot: `<slot>` renders one alone.
    const declared = readsSlots(component) ? `const ${names.local(binding)} = ` : "";
    statements.push({
      code: `${declared}defineSlots<${slotsType(component)}>();`,
      layout: "macro",
    });
  }
  const options = [
    ...(recursive ? [`name: ${JSON.stringify(recursive)}`] : []),
    ...(component.inheritAttrs === false ? ["inheritAttrs: false"] : []),
  ];
  if (options.length) {
    statements.push({ code: `defineOptions({ ${options.join(", ")} });`, layout: "macro" });
  }
  for (const item of component.setup) {
    const code = itemCode(item, component, module, names, imports, script);
    // A model is a macro, which stays with `defineProps` and `defineEmits` where it follows them.
    const layout =
      item.kind === "Model" ? "macro" : declares(item) && !code.includes("\n") ? "line" : "block";
    statements.push({ code, layout });
  }
  for (const code of listeners.functions) statements.push({ code, layout: "block" });
  // Last, once every function it names is declared (ADR-0054).
  if (component.exposes) {
    const exposed = component.exposes.functions.map((id) => {
      const binding = bindingOf(component, id);
      const local = names.local(binding);
      return local === binding.name ? local : `${binding.name}: ${local}`;
    });
    statements.push({ code: `defineExpose({ ${exposed.join(", ")} });`, layout: "block" });
  }
  if (statements.length === 0 && imports.size === 0) {
    return { rewrite: template, listeners, components, ...(keys ? { keys } : {}) };
  }
  const head = imports.size > 0 ? printProgram(js.program(imports.toDeclarations())).trim() : "";
  const types = keys ? [] : componentTypes(component, module).map(typeDeclarationCode);
  const code = [
    ...(head ? [head] : []),
    ...types,
    ...(statements.length ? [laidOut(statements)] : []),
  ].join("\n\n");
  return {
    block: `<script setup lang="ts">\n${escapeScriptEnd(code)}\n</script>`,
    rewrite: template,
    listeners,
    components,
    ...(keys ? { keys } : {}),
  };
}

/** The authoring types of a ref a key may hold, which are Vue's own (ADR-0054). */
const REF_TYPES = ["Ref", "ComputedRef", "ModelRef"] as const;

/**
 * The `<script lang="ts">` block that declares a module's injection keys (ADR-0054), each a
 * `Symbol` typed with Vue's `InjectionKey`, after the types the component copies, which
 * `<script setup>` reads from it.
 */
function keyBlock(component: UfComponent, module: UfModule, names: VueNames): string {
  const imports = new ImportSet(names.scope);
  const injectionKey = imports.add("vue", "InjectionKey", { type: true });
  const declarations = module.keys!.map((key) => {
    // A ref the key holds is typed with Vue's own `Ref`, as the source's authoring one is.
    let type = key.type.code;
    for (const name of REF_TYPES) {
      if (!new RegExp(`\\b${name}<`).test(type)) continue;
      const local = imports.add("vue", name, { type: true });
      type = type.replace(new RegExp(`\\b${name}<`, "g"), `${local}<`);
    }
    return `export const ${key.name}: ${injectionKey}<${type}> = Symbol(${JSON.stringify(key.description)});`;
  });
  const types = componentTypes(component, module).map(typeDeclarationCode);
  const code = [
    printProgram(js.program(imports.toDeclarations())).trim(),
    ...types,
    declarations.join("\n"),
  ].join("\n\n");
  return `<script lang="ts">\n${escapeScriptEnd(code)}\n</script>`;
}

/**
 * The type `defineSlots` takes (ADR-0054): each slot an optional method of its props, as the
 * source declares them. What a slot returns is Vue's to type, so the source's `Element` is not
 * copied.
 */
function slotsType(component: UfComponent): string {
  const members = component.slots!.slots.map(
    (slot) => `${slot.name}?(${slot.props ? `props: ${slot.props.code}` : ""}): unknown`,
  );
  return `{ ${members.join("; ")} }`;
}

/** Whether the template reads `slots`: a slot's presence, or a forwarded slot's. */
function readsSlots(component: UfComponent): boolean {
  if (
    expressionsOf(component).some(({ expression }) =>
      expression.refs.some((reference) => reference.kind === "Slot"),
    )
  ) {
    return true;
  }
  let forwards = false;
  walk(component.render, {
    enter(node) {
      if (node.kind === "Component" && node.fills.some((fill) => fill.forward !== undefined)) {
        forwards = true;
      }
    },
  });
  return forwards;
}

/** The statements, a blank line between two unless both are macros, or both one-line declarations. */
function laidOut(statements: readonly Statement[]): string {
  return statements
    .map((statement, index) => {
      const previous = statements[index - 1];
      if (previous === undefined) return statement.code;
      const together = previous.layout === statement.layout && statement.layout !== "block";
      return `${together ? "\n" : "\n\n"}${statement.code}`;
    })
    .join("");
}

/** Whether a setup item declares a binding, rather than registering an effect or a hook. */
function declares(item: SetupItem): boolean {
  switch (item.kind) {
    case "State":
    case "Derived":
    case "TemplateRef":
    case "Id":
    case "Const":
    case "Variable":
    case "Function":
    case "Model":
    case "Inject":
      return true;
    case "Watch":
    case "WatchEffect":
    case "Lifecycle":
    case "Provide":
      return false;
    default:
      return unreachable(item);
  }
}

/** Whether any code calls the component's `emit`, the template's listeners included. */
function emitIsCalled(component: UfComponent, emit: Binding): boolean {
  return codeOf(component).some(({ code }) =>
    code.refs.some((reference) => reference.kind === "Emit" && reference.binding === emit.id),
  );
}

/** One setup item as the script writes it: the source's statement, with Vue's own APIs. */
function itemCode(
  item: SetupItem,
  component: UfComponent,
  module: UfModule,
  names: VueNames,
  imports: ImportSet,
  rules: RewriteRules,
): string {
  const local = (id: BindingId) => names.local(bindingOf(component, id));
  const code = (value: Code, site: "pure" | "client") => rewriteCode(value, component, rules, site);
  const fn = (value: FunctionCode, site: "pure" | "client") =>
    functionText(value, component, rules, site);
  switch (item.kind) {
    case "State": {
      // State is replaced whole (ADR-0008, UF2004), so nothing needs `ref`'s deep proxy: a value
      // not known to be a primitive is a `shallowRef`, whose value is the source's own object
      // (identity, `structuredClone`, a payload), as Svelte's `$state.raw` (ADR-0046).
      const api = isPrimitiveState(item, component, module) ? "ref" : "shallowRef";
      const ref = imports.add("vue", api);
      const initial = item.initial ? code(item.initial, "pure") : "";
      return `const ${local(item.binding)} = ${ref}${typeArgument(item.type)}(${initial});`;
    }
    case "Derived": {
      const computed = imports.add("vue", "computed");
      return `const ${local(item.binding)} = ${computed}${typeArgument(item.type)}(${fn(item.getter, "pure")});`;
    }
    case "TemplateRef": {
      // Keyed by the binding's name, which the template's `ref` attribute writes (ADR-0049):
      // Vue 3.5 sets the ref through its key, and never writes the same-named setup binding.
      const useTemplateRef = imports.add("vue", "useTemplateRef");
      const binding = bindingOf(component, item.binding);
      return `const ${names.local(binding)} = ${useTemplateRef}${typeArgument(item.type)}(${JSON.stringify(binding.name)});`;
    }
    case "Id": {
      // The prefix marks the id as generated wherever it lands (ADR-0049).
      const useId = imports.add("vue", "useId");
      return `const ${local(item.binding)} = \`uf-id-\${${useId}()}\`;`;
    }
    case "Const":
      return `const ${local(item.binding)}${annotation(item.type)} = ${code(item.value, "pure")};`;
    case "Variable": {
      const initial = item.initial ? ` = ${code(item.initial, "pure")}` : "";
      return `let ${local(item.binding)}${annotation(item.type)}${initial};`;
    }
    case "Function":
      switch (item.form) {
        case "declaration":
          return functionText(item.function, component, rules, "client", {
            name: local(item.binding),
          });
        case "arrow":
          return `const ${local(item.binding)} = ${fn(item.function, "client")};`;
        default:
          return unreachable(item.form);
      }
    case "Watch": {
      const watch = imports.add("vue", "watch");
      const sources = item.sources.map((source) =>
        watchSource(source, component, module, names, rules),
      );
      const options = watchOptions(item);
      return `${watch}(${[
        item.array ? `[${sources.join(", ")}]` : sources[0]!,
        fn(item.callback, "client"),
        ...(options ? [options] : []),
      ].join(", ")});`;
    }
    case "WatchEffect": {
      // Vue's `watchEffect` runs during the server's setup and before the DOM updates; every
      // target runs it after the render instead (ADR-0048), as `watchPostEffect`
      // does, which Vue never runs on the server.
      const watchPostEffect = imports.add("vue", "watchPostEffect");
      return `${watchPostEffect}(${fn(item.effect, "client")});`;
    }
    case "Lifecycle": {
      const hook = imports.add("vue", lifecycleHook(item.hook));
      return `${hook}(${fn(item.callback, "client")});`;
    }
    case "Model": {
      // An unbound model without a default holds `undefined`, as every target's does: Vue would
      // cast an absent boolean model to `false` without the explicit default (ADR-0034).
      const unset = item.default === undefined && !item.required;
      const type = item.type ? `<${unset ? orUndefined(item.type.code) : item.type.code}>` : "";
      const options = [
        ...(item.required ? ["required: true"] : []),
        ...(item.default ? [`default: ${item.default.code}`] : unset ? ["default: undefined"] : []),
      ];
      return `const ${local(item.binding)} = defineModel${type}(${[JSON.stringify(item.name), ...(options.length ? [`{ ${options.join(", ")} }`] : [])].join(", ")});`;
    }
    case "Provide": {
      const provide = imports.add("vue", "provide");
      return `${provide}(${item.key}, ${code(item.value, "pure")});`;
    }
    case "Inject": {
      const inject = imports.add("vue", "inject");
      const fallback = item.fallback ? `, ${code(item.fallback, "pure")}` : "";
      return `const ${local(item.binding)} = ${inject}(${item.key}${fallback});`;
    }
    default:
      return unreachable(item);
  }
}

/** `T | undefined`, with parentheses around a function type, which `|` would split. */
function orUndefined(type: string): string {
  return `${/=>/.test(type) ? `(${type})` : type} | undefined`;
}

/** A type argument as written (`<Item[]>`), or nothing. */
function typeArgument(type: TypeText | undefined): string {
  return type ? `<${type.code}>` : "";
}

/** A type annotation as written (`: number | undefined`), or nothing. */
function annotation(type: TypeText | undefined): string {
  return type ? `: ${type.code}` : "";
}

/** The Vue API of a lifecycle hook. */
function lifecycleHook(hook: "mounted" | "unmounted"): string {
  switch (hook) {
    case "mounted":
      return "onMounted";
    case "unmounted":
      return "onUnmounted";
    default:
      return unreachable(hook);
  }
}

/**
 * A watcher's source: a ref, as the source passes it, or a getter. A `shallowRef` is read through
 * a getter (`() => items.value`), alone or in an array: Vue calls a watcher of a shallow ref back
 * on every run, though no value changed (`forceTrigger`, @vue/reactivity 3.5's `watch`), so two
 * writes in one task that end on the value it had (`selected.value = null`, then the same item
 * again) would call it back, where the contract calls back only on a change by `Object.is`
 * (ADR-0048). A getter's value is compared so (`hasChanged`).
 */
function watchSource(
  source: WatchSource,
  component: UfComponent,
  module: UfModule,
  names: VueNames,
  rules: RewriteRules,
): string {
  switch (source.kind) {
    case "Ref": {
      const binding = bindingOf(component, source.binding);
      const local = names.local(binding);
      const state = component.setup.find(
        (item): item is StateItem => item.kind === "State" && item.binding === binding.id,
      );
      return state && !isPrimitiveState(state, component, module) ? `() => ${local}.value` : local;
    }
    case "Getter":
      return functionText(source.getter, component, rules, "pure");
    default:
      return unreachable(source);
  }
}

/** A watcher's options object, when it has any. */
function watchOptions(item: WatchItem): string | undefined {
  const options = [
    ...(item.immediate ? ["immediate: true"] : []),
    ...(item.post ? ['flush: "post"'] : []),
  ];
  return options.length > 0 ? `{ ${options.join(", ")} }` : undefined;
}

/** `const { label, tone = "info", count = undefined, size: _size = 2 } = defineProps<P>();` */
function destructuredDeclaration(
  component: UfComponent,
  parameter: PropsParameter,
  names: VueNames,
  read: ReadonlySet<BindingId>,
): string {
  const macro = `defineProps<${parameter.type.code}>()`;
  const isRead = (prop: Prop) => prop.binding !== undefined && read.has(prop.binding);
  if (!component.props.some(isRead)) return `${macro};`;
  const entries = component.props
    .filter((prop) => isRead(prop) || prop.optional)
    .map((prop) => {
      const value = prop.default?.code ?? (prop.optional ? "undefined" : undefined);
      // In the pattern for its default alone: the filter keeps only optional unread props.
      if (!isRead(prop)) return `${prop.name}: ${names.scope.claim(`_${prop.name}`)} = ${value}`;
      // Vue 3.5 destructures a prop under another name too (`{ Map: Map_1 }`), and every
      // reference reads the local.
      const local = VUE_RESERVED.has(prop.name) ? names.scope.claim(prop.name) : prop.name;
      if (local !== prop.name && prop.binding !== undefined) names.rename(prop.binding, local);
      const target = local === prop.name ? prop.name : `${prop.name}: ${local}`;
      return value === undefined ? target : `${target} = ${value}`;
    });
  return `const { ${entries.join(", ")} } = ${macro};`;
}

/** `const props = withDefaults(defineProps<P>(), { title: undefined });` */
function objectDeclaration(
  component: UfComponent,
  parameter: PropsParameter,
  names: VueNames,
  read: ReadonlySet<BindingId>,
): string {
  const macro = `defineProps<${parameter.type.code}>()`;
  // In the object form, every prop is a binding, read as `props.label`.
  if (!component.props.some((prop) => prop.binding !== undefined && read.has(prop.binding))) {
    return `${macro};`;
  }
  const optional = component.props.filter((prop) => prop.optional);
  const call = optional.length
    ? `withDefaults(${macro}, { ${optional.map((prop) => `${prop.name}: undefined`).join(", ")} })`
    : macro;
  const name = parameter.name!;
  // Vue keeps the `_` and `$` prefixes for its own names, and its compiled `setup` declares
  // some: `const __props = defineProps<P>()` does not compile. The object takes the name
  // `props` there.
  const local = VUE_RESERVED.has(name)
    ? names.scope.claim(name)
    : /^[_$]/.test(name)
      ? names.scope.claim("props")
      : name;
  if (local !== name) names.renamePropsObject(name, local);
  return `const ${local} = ${call};`;
}

/**
 * Code copied into the script, with `</script` written `<\/script`: Vue's parser ends the block
 * at the first `</script`, wherever it sits (ADR-0041). It can only sit in a string or
 * template literal, or a comment, where `\/` is `/`. The analyser rejects the copied text that
 * could hold it; the target escapes it anyway, as a guard.
 */
function escapeScriptEnd(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1");
}
