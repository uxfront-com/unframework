// A directive as Vue's own custom directive (ADR-0099): an `ObjectDirective` whose hooks are the
// author's, reading the value from Vue's binding. Vue calls `updated` after every update of the
// component, so it returns early when the value is the same (`Object.is`). It declares no
// `created`, which would turn off the hydration attribute check, and no `getSSRProps`: the
// server never runs a hook. A `.uf.ts` module's directive is its own module, `vFocusTrap.ts`,
// which `<script setup>` imports, and resolves by its `vFocusTrap` name.
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveSpecifier,
  importedDirectives,
} from "@unframework.dev/codegen";
import type { EmitContext, ImportSet, OutputFile } from "@unframework.dev/codegen";
import type { DirectiveHook, UfComponent, UfDirective, UfModule } from "@unframework.dev/ir";

/** `const vFocusTrap: ObjectDirective<HTMLElement, boolean> = { … };`, `ObjectDirective` as `type`. */
export function directiveCode(directive: UfDirective, type: string, exported = false): string {
  const hooks = directive.hooks.map((hook) => `  ${hookCode(hook)},`);
  return `${exported ? "export " : ""}const ${directive.name}: ${type}<${directiveElement(directive)}, ${directive.value.code}> = {\n${hooks.join("\n")}\n};`;
}

/**
 * A hook as Vue's: the element, then the binding, destructured to the names the author gives
 * the value and the previous one. `updated` names both, for its early return.
 */
function hookCode(hook: DirectiveHook): string {
  const [element, value, previous] = hook.parameters;
  const head = `${hook.async ? "async " : ""}${hook.name}`;
  const named = (name: string, as: string | undefined) =>
    as === undefined || as === name ? name : `${name}: ${as}`;
  if (hook.name !== "updated") {
    const parameters = [
      ...(element === undefined && value === undefined ? [] : [element ?? "_el"]),
      ...(value === undefined ? [] : [`{ ${named("value", value)} }`]),
    ];
    return `${head}(${parameters.join(", ")}) ${hook.body.code}`;
  }
  const valueName = value ?? "value";
  const previousName = previous ?? "oldValue";
  const binding = `{ ${named("value", valueName)}, ${named("oldValue", previousName)} }`;
  const body = `{\n    if (Object.is(${valueName}, ${previousName})) return;${hook.body.code.slice(1)}`;
  return `${head}(${element ?? "_el"}, ${binding}) ${body}`;
}

/**
 * The imports of the directives a component applies from `.uf.ts` modules: each from its own
 * output, `./vFocusTrap` beside `focusTrap.uf.ts`, under the source's local name.
 */
export function addDirectiveImports(
  component: UfComponent,
  module: UfModule,
  imports: ImportSet,
): void {
  for (const { specifier, imported, local } of importedDirectives(component, module)) {
    imports.add(directiveSpecifier(specifier, imported), imported, { local, exact: true });
  }
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, exported as Vue's `ObjectDirective`. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const code = [
    ['import type { ObjectDirective } from "vue";', ...dependencyImports(dependencies)].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    directiveCode(directive, "ObjectDirective", true),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}
