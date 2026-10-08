// The authoring API (plan §4.2, ADR-0006): what a component imports from `"unframework"`. The
// compiler recognises each API by the binding its import declares, never by name, so an alias
// (`import { computed as derive }`) is the API too, and a local `ref` is not. The table is
// tested against `packages/unframework/src/index.ts`'s exports (`test/authoring.test.ts`).

import { exportName } from "@unframework/parser";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import { isAuthoringModule } from "./frameworks.ts";

/**
 * The APIs the analyser lowers: M2's macros, reactive APIs and `nextTick` (ADR-0045), and M3's
 * `defineSlots`, `defineExpose` and `defineOptions` (ADR-0054).
 */
export type AuthoringApi =
  | "ref"
  | "computed"
  | "watch"
  | "watchEffect"
  | "onMounted"
  | "onUnmounted"
  | "nextTick"
  | "defineEmits"
  | "useTemplateRef"
  | "useId"
  | "defineSlots"
  | "defineExpose"
  | "defineOptions";

/** The APIs the analyser lowers. */
export const AUTHORING_APIS: ReadonlySet<AuthoringApi> = new Set<AuthoringApi>([
  "ref",
  "computed",
  "watch",
  "watchEffect",
  "onMounted",
  "onUnmounted",
  "nextTick",
  "defineEmits",
  "useTemplateRef",
  "useId",
  "defineSlots",
  "defineExpose",
  "defineOptions",
]);

/** The APIs the package exports that a later milestone lowers, and what each brings (UF1002). */
export const LATER_APIS: ReadonlyMap<string, string> = new Map([
  ["defineModel", "two-way bindings (`defineModel` and `v-model`) land in M3"],
  ["provide", "`provide` and `inject` land in M3"],
  ["inject", "`provide` and `inject` land in M3"],
]);

/**
 * The types the package exports: a component imports them for its annotations, which the
 * compiler copies or erases (a reference to one in a copied annotation is the rules' to judge).
 */
export const AUTHORING_TYPES: ReadonlySet<string> = new Set([
  "Child",
  "Children",
  "ClassValue",
  "ComponentAttributes",
  "ComponentOptions",
  "ComputedRef",
  "CSSProperties",
  "Element",
  "EmitFn",
  "EmitsMap",
  "InjectionKey",
  "JSX",
  "ModelRef",
  "OnCleanup",
  "Ref",
  "RefAttribute",
  "SlotObject",
  "SlotsMap",
  "StyleValue",
  "TemplateRef",
  "TypedComponent",
  "WatchEffectOptions",
  "WatchOptions",
  "WatchSource",
  "WatchStopHandle",
]);

/** Why a name Vue exports is not unframework's, where it has a canonical form instead (P3). */
const VUE_ONLY: ReadonlyMap<string, string> = new Map([
  ["reactive", "state is a `ref`, whose value is replaced whole (ADR-0008)"],
  ["shallowReactive", "state is a `ref`, whose value is replaced whole (ADR-0008)"],
  ["readonly", "state is a `ref`, whose value is replaced whole (ADR-0008)"],
  ["shallowRef", "state is a `ref`, whose value is replaced whole (ADR-0008)"],
  ["toRef", "a component reads its props as they are destructured in its signature"],
  ["toRefs", "a component reads its props as they are destructured in its signature"],
  ["toValue", "a ref's value is read as `x.value`"],
  ["unref", "a ref's value is read as `x.value`"],
  ["isRef", "a ref's value is read as `x.value`"],
  ["watchPostEffect", 'a post effect is `watch(…, { flush: "post" })`'],
  ["watchSyncEffect", "a watcher runs before the DOM updates or after it, never synchronously"],
  ["defineProps", "a component declares its props as its typed parameter (ADR-0034)"],
  ["withDefaults", "a prop's default is written in the parameter's destructuring (ADR-0034)"],
  ["onBeforeMount", "a component's lifecycle is `onMounted` and `onUnmounted`"],
  ["onBeforeUnmount", "a component's lifecycle is `onMounted` and `onUnmounted`"],
  ["onUpdated", "a component's lifecycle is `onMounted` and `onUnmounted`"],
  ["onBeforeUpdate", "a component's lifecycle is `onMounted` and `onUnmounted`"],
]);

/**
 * Checks an import of the authoring API: named imports of what the package exports. A value
 * import of an API a later milestone lowers is UF1002, naming the milestone; a namespace or a
 * default import, an import that imports nothing, and a name the package does not export as an
 * API are UF2016. Type-only imports are erased, whatever they name.
 */
export function checkAuthoringImport(statement: AST.ImportDeclaration, reporter: Reporter): void {
  if (statement.importKind === "type") return;
  const specifier = statement.source.value;
  const root = specifier === "unframework";
  if (!statement.specifiers.length) {
    reporter.report(
      "UF2016",
      statement,
      `\`import "${specifier}"\` imports nothing: a component imports the authoring API by name.`,
      { help: 'Import what the component uses, as in `import { ref } from "unframework";`.' },
    );
    return;
  }
  for (const item of statement.specifiers) {
    if (item.type === "ImportDefaultSpecifier") {
      reporter.report(
        "UF2016",
        item,
        `"${specifier}" has no default export: a component imports the authoring API by name.`,
        { help: 'Import what the component uses, as in `import { ref } from "unframework";`.' },
      );
      continue;
    }
    if (item.type === "ImportNamespaceSpecifier") {
      reporter.report(
        "UF2016",
        item,
        `A namespace import of "${specifier}" hides which API a call uses: the compiler recognises the authoring API by the names its import declares (ADR-0006).`,
        { help: 'Import what the component uses, as in `import { ref } from "unframework";`.' },
      );
      continue;
    }
    if (item.importKind === "type") continue;
    const name = exportName(item.imported);
    if (!root) {
      reporter.report(
        "UF2016",
        item,
        `"${specifier}" holds types only: \`${name}\` is imported as a value.`,
        { help: `Import it as a type (\`import type { ${name} } from "${specifier}"\`).` },
      );
      continue;
    }
    if (AUTHORING_APIS.has(name as AuthoringApi) || AUTHORING_TYPES.has(name)) continue;
    const later = LATER_APIS.get(name);
    if (later) {
      reporter.unsupported(item, `\`${name}\` is not supported yet: ${later}.`);
      continue;
    }
    const vue = VUE_ONLY.get(name);
    reporter.report(
      "UF2016",
      item,
      vue
        ? `\`${name}\` is Vue's, not unframework's: ${vue}.`
        : `"unframework" exports no \`${name}\`.`,
      {
        help: `The authoring API is ${[...AUTHORING_APIS].map((api) => `\`${api}\``).join(", ")}.`,
      },
    );
  }
}

/**
 * The value bindings the module's authoring imports declare, by the identifier that declares
 * each: the API it is, or `undefined` for a name the import does not give the component (one
 * `checkAuthoringImport` reports), whose uses say nothing more.
 */
export function authoringBindings(program: AST.Program): Map<object, AuthoringApi | undefined> {
  const bindings = new Map<object, AuthoringApi | undefined>();
  for (const statement of program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.importKind === "type" ||
      !isAuthoringModule(statement.source.value)
    ) {
      continue;
    }
    const root = statement.source.value === "unframework";
    for (const item of statement.specifiers) {
      if (item.type === "ImportSpecifier" && item.importKind === "type") continue;
      const name = item.type === "ImportSpecifier" ? exportName(item.imported) : undefined;
      bindings.set(
        item.local,
        root && name !== undefined && AUTHORING_APIS.has(name as AuthoringApi)
          ? (name as AuthoringApi)
          : undefined,
      );
    }
  }
  return bindings;
}
