// A component's `<script setup lang="ts">` block (plan §6, ADR-0034, ADR-0045): the imports
// from `vue`, the type declarations the component reaches, copied as written, one `defineProps`
// declaration, the `defineEmits` declaration, then the setup in source order, which is the
// source's own code: Vue's Composition API is the source language's (plan §4), so a ref is read
// and written through `.value` as written, and only the macros' arguments and a few APIs change
// (`useTemplateRef("name")`, `watchPostEffect`, the `uf-id-` prefix). Last come the functions the
// template's listeners call where a handler cannot stay in the template (`listeners.ts`).
import {
  bindingOf,
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
import { codeOf } from "@unframework/ir";
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
}

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
  for (const item of component.setup) {
    const code = itemCode(item, component, module, names, imports, script);
    statements.push({ code, layout: declares(item) && !code.includes("\n") ? "line" : "block" });
  }
  for (const code of listeners.functions) statements.push({ code, layout: "block" });
  if (statements.length === 0) return { rewrite: template, listeners };
  const head = imports.size > 0 ? printProgram(js.program(imports.toDeclarations())).trim() : "";
  const types = componentTypes(component, module).map(typeDeclarationCode);
  const code = [...(head ? [head] : []), ...types, laidOut(statements)].join("\n\n");
  return {
    block: `<script setup lang="ts">\n${escapeScriptEnd(code)}\n</script>`,
    rewrite: template,
    listeners,
  };
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
      return true;
    case "Watch":
    case "WatchEffect":
    case "Lifecycle":
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
    default:
      return unreachable(item);
  }
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
