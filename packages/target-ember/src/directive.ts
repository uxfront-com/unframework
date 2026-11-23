// A directive as a modifier (ADR-0099): `{{vFocusTrap this.open}}` on its element. Ember's own
// modifier manager installs a modifier once its element is in the DOM, updates it when an
// argument it read changes, and destroys it once the element goes. Glimmer installs a parent's
// modifier before its children's, so each hook goes through the inline `queueHook`, which runs
// them in Vue's order (`emulated`). A server render installs modifiers too, so no hook runs where
// `import.meta.env.SSR` holds.
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveHooksObject,
  directiveModuleNames,
  hookQueueCode,
  NameScope,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import type { UfDirective } from "@unframework.dev/ir";

/** The imports the `directive` helper needs. */
export const DIRECTIVE_IMPORTS: Record<string, readonly string[]> = {
  "@ember/modifier": ["capabilities", "setModifierManager"],
  "@glint/template": ["type ModifierLike"],
};

/** The local names the helpers declare and read. */
interface HelperNames {
  directive: string;
  queue: string;
  capabilities: string;
  setModifierManager: string;
  ModifierLike: string;
}

/** The names a component's output gives the helpers, beside its own. */
const COMPONENT_NAMES: HelperNames = {
  directive: "directive",
  queue: "queueHook",
  capabilities: "capabilities",
  setModifierManager: "setModifierManager",
  ModifierLike: "ModifierLike",
};

/** `const vFocusTrap = directive<boolean, HTMLElement>({ … });`. */
export function directiveDeclaration(
  directive: UfDirective,
  exported = false,
  names: HelperNames = COMPONENT_NAMES,
): string {
  const hooks = directiveHooksObject(directive);
  const types = `${directive.value.code}, ${directiveElement(directive)}`;
  return `${exported ? "export " : ""}const ${directive.name} = ${names.directive}<${types}>(${hooks});`;
}

/**
 * The inline helpers every output that applies a directive declares, as no output imports
 * another's (P7).
 */
export function directiveHelpers(names: HelperNames = COMPONENT_NAMES): string[] {
  return [directiveHelper(names), hookQueueCode(names.queue)];
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, as a modifier. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  // The helpers' names and Ember's, apart from everything the copied code declares or reads.
  const scope = new NameScope(directiveModuleNames(directive, dependencies));
  const names: HelperNames = {
    directive: scope.claim("directive"),
    queue: scope.claim("queueHook"),
    capabilities: scope.claim("capabilities"),
    setModifierManager: scope.claim("setModifierManager"),
    ModifierLike: scope.claim("ModifierLike"),
  };
  const as = (name: keyof HelperNames) =>
    names[name] === name ? name : `${name} as ${names[name]}`;
  const code = [
    [
      `import { ${as("capabilities")}, ${as("setModifierManager")} } from "@ember/modifier";`,
      `import type { ${as("ModifierLike")} } from "@glint/template";`,
      ...dependencyImports(dependencies),
    ].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    directiveDeclaration(directive, true, names),
    ...directiveHelpers(names),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}

/** The `directive` helper, with its names. */
function directiveHelper(n: HelperNames): string {
  return `/**
 * A directive as a modifier: \`mounted\` once its element is in the DOM, \`updated\` after a render
 * that changes its value, and \`unmounted\` once the element goes, each in Vue's order
 * (\`queueHook\`). No hook runs on the server.
 */
function ${n.directive}<T, E extends Element>(hooks: {
  mounted?(el: E, value: T): unknown;
  updated?(el: E, value: T, oldValue: T): unknown;
  unmounted?(el: E): unknown;
}): ${n.ModifierLike}<{ Element: E; Args: { Positional: [value: T] } }> {
  interface State {
    element?: E;
    value?: T;
  }
  return ${n.setModifierManager}(
    () => ({
      capabilities: ${n.capabilities}("3.22"),
      createModifier: (): State => ({}),
      installModifier(state: State, element: E, { positional }: { positional: readonly unknown[] }) {
        const value = positional[0] as T;
        state.element = element;
        state.value = value;
        if (import.meta.env.SSR || !hooks.mounted) return;
        ${n.queue}(element, () => void hooks.mounted?.(element, value), "mounted");
      },
      updateModifier(state: State, { positional }: { positional: readonly unknown[] }) {
        const value = positional[0] as T;
        const oldValue = state.value as T;
        const element = state.element;
        if (Object.is(value, oldValue) || !element) return;
        state.value = value;
        if (!hooks.updated) return;
        ${n.queue}(element, () => void hooks.updated?.(element, value, oldValue), "updated");
      },
      destroyModifier(state: State) {
        const element = state.element;
        if (import.meta.env.SSR || !element || !hooks.unmounted) return;
        ${n.queue}(element, () => void hooks.unmounted?.(element), "unmounted");
      },
    }),
    {},
  ) as unknown as ${n.ModifierLike}<{ Element: E; Args: { Positional: [value: T] } }>;
}`;
}
