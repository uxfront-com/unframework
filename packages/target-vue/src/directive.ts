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
  directiveHook,
  directiveHooksObject,
  directiveModuleNames,
  NameScope,
  codeNames,
  directiveSpecifier,
  hookCall,
  hookQueueCode,
  hookParameters,
  importedDirectives,
  wrapperNames,
} from "@unframework.dev/codegen";
import type { EmitContext, ImportSet, OutputFile } from "@unframework.dev/codegen";
import type { DirectiveHook, UfComponent, UfDirective, UfModule } from "@unframework.dev/ir";

import { isVapor } from "./options.ts";

/** The names a Vapor directive reads from `vue`, as the output imports them. */
export interface VaporDirectiveNames {
  type: string;
  watch: string;
  watchPostEffect: string;
  /** The inline helper that runs the hooks in Vue's order (`hookQueueCode`). */
  queue: string;
}

/** The inline helper that runs a Vapor directive's hooks in Vue's order (ADR-0112). */
export const QUEUE_HELPER = "queueHook";

/** `const vFocusTrap: ObjectDirective<HTMLElement, boolean> = { … };`, `ObjectDirective` as `type`. */
export function directiveCode(directive: UfDirective, type: string, exported = false): string {
  const hooks = directive.hooks.map((hook) => `  ${hookCode(hook)},`);
  return `${exported ? "export " : ""}const ${directive.name}: ${type}<${directiveElement(directive)}, ${directive.value.code}> = {\n${hooks.join("\n")}\n};`;
}

/**
 * A directive as a Vapor directive (ADR-0112): Vue 3.6's Vapor templates take a function of the
 * element and a getter of the value, `VaporDirective`, not an object of hooks, and refuse the
 * component's lifecycle hooks inside it. So `mounted` runs from a post-flush effect, once the
 * element is in the document, that reads nothing again after its first run; `updated` from a
 * post-flush watcher of the value, behind `Object.is`, as Vue's object form returns early; and
 * `unmounted` from the cleanup Vue runs once the element's scope is disposed. Vapor applies an
 * element's directives in its own order, not the virtual DOM's, which runs a descendant's hooks
 * before its ancestor's: each hook goes through the inline queue Solid's directives use,
 * `queueHook`, which runs them in Vue's order once the turn ends (`emulated`).
 */
export function vaporDirectiveCode(
  directive: UfDirective,
  names: VaporDirectiveNames,
  exported = false,
): string {
  const own = wrapperNames(directive, [
    "hooks",
    "element",
    "getValue",
    "current",
    "mounted",
    "next",
    "previous",
  ] as const);
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const reads = Boolean(mounted || updated);
  const body: string[] = [`const ${own.hooks} = ${directiveHooksObject(directive)};`];
  // Vapor passes the getter wherever the template gives the directive a value, which a source
  // always does (ADR-0099); `VaporDirective` types it optional, for a use without one.
  if (reads) body.push(`${updated ? "let" : "const"} ${own.current} = ${own.getValue}!();`);
  if (mounted) {
    body.push(
      `let ${own.mounted} = false;`,
      `${names.watchPostEffect}(() => {`,
      `  if (${own.mounted}) return;`,
      `  ${own.mounted} = true;`,
      `  ${names.queue}(${own.element}, () => ${hookCall(own.hooks, mounted, [own.element, own.current])}, "mounted");`,
      "});",
    );
  }
  if (updated) {
    const previous = hookParameters(updated).length > 2;
    body.push(
      `${names.watch}(`,
      `  ${own.getValue}!,`,
      `  (${own.next}) => {`,
      `    if (Object.is(${own.next}, ${own.current})) return;`,
      ...(previous ? [`    const ${own.previous} = ${own.current};`] : []),
      `    ${own.current} = ${own.next};`,
      `    ${names.queue}(${own.element}, () => ${hookCall(own.hooks, updated, [own.element, own.next, own.previous])}, "updated");`,
      "  },",
      '  { flush: "post" },',
      ");",
    );
  }
  if (unmounted) {
    body.push(
      `return () => ${names.queue}(${own.element}, () => ${hookCall(own.hooks, unmounted, [own.element])}, "unmounted");`,
    );
  }
  // Typed by `VaporDirective`; a directive with only `unmounted` reads no value, so it takes no
  // getter.
  const parameters = reads ? `${own.element}, ${own.getValue}` : own.element;
  return [
    `${exported ? "export " : ""}const ${directive.name}: ${names.type}<${directiveElement(directive)}, ${directive.value.code}> = (${parameters}) => {`,
    ...body.map((line) => `  ${line.replaceAll("\n", "\n  ")}`),
    "};",
  ].join("\n");
}

/**
 * A hook as Vue's: the element, then the binding, destructured to the names the author gives the
 * value and the previous one, as many as the hook reads. `updated` names both, for its early
 * return, under names no other name of the hook's takes.
 */
function hookCode(hook: DirectiveHook): string {
  const [element, value, previous] = hookParameters(hook);
  const head = `${hook.async ? "async " : ""}${hook.name}`;
  const taken = codeNames(hook.body.code, "statements");
  const fresh = (base: string) => {
    let name = base;
    for (let index = 1; taken.has(name); index++) name = `${base}_${index}`;
    taken.add(name);
    return name;
  };
  const named = (name: string, as: string) => (as === name ? name : `${name}: ${as}`);
  if (hook.name !== "updated") {
    const parameters = [
      ...(element === undefined ? [] : [element]),
      ...(value === undefined ? [] : [`{ ${named("value", value)} }`]),
    ];
    return `${head}(${parameters.join(", ")}) ${hook.body.code}`;
  }
  const valueName = value ?? fresh("value");
  const previousName = previous ?? fresh("oldValue");
  const binding = `{ ${named("value", valueName)}, ${named("oldValue", previousName)} }`;
  const body = `{\n    if (Object.is(${valueName}, ${previousName})) return;${hook.body.code.slice(1)}`;
  return `${head}(${element ?? fresh("_el")}, ${binding}) ${body}`;
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

/**
 * `vFocusTrap.ts`: a `.uf.ts` module's directive, exported as Vue's `ObjectDirective`, or as a
 * `VaporDirective` under the `vapor` option (ADR-0112).
 */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  // Vue's names, apart from everything the copied code declares or reads.
  const scope = new NameScope(directiveModuleNames(directive, dependencies));
  const as = (imported: string, local: string) =>
    imported === local ? imported : `${imported} as ${local}`;
  let head: string;
  let declaration: string;
  let helper = "";
  if (isVapor(context.options)) {
    const names = vaporNames(directive, (name) => scope.claim(name));
    helper = hookQueueCode(names.queue);
    const values = (["watch", "watchPostEffect"] as const)
      .filter((name) => names.used.has(name))
      .map((name) => as(name, names[name]));
    head = [
      `import type { ${as("VaporDirective", names.type)} } from "vue";`,
      ...(values.length ? [`import { ${values.join(", ")} } from "vue";`] : []),
    ].join("\n");
    declaration = vaporDirectiveCode(directive, names, true);
  } else {
    const type = scope.claim("ObjectDirective");
    head = `import type { ${as("ObjectDirective", type)} } from "vue";`;
    declaration = directiveCode(directive, type, true);
  }
  const code = [
    [head, ...dependencyImports(dependencies)].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    declaration,
    ...(helper ? [helper] : []),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}

/**
 * The names a Vapor directive reads, each claimed through `claim` only where its hooks need it:
 * `watchPostEffect` for `mounted`, `watch` for `updated`, its type through `claimType`, and the
 * queue's name through `claimQueue`.
 */
export function vaporNames(
  directive: UfDirective,
  claim: (name: string) => string,
  claimType: (name: string) => string = claim,
  claimQueue: () => string = () => claim(QUEUE_HELPER),
): VaporDirectiveNames & { used: Set<"watch" | "watchPostEffect"> } {
  const used = new Set<"watch" | "watchPostEffect">();
  if (directiveHook(directive, "mounted")) used.add("watchPostEffect");
  if (directiveHook(directive, "updated")) used.add("watch");
  return {
    type: claimType("VaporDirective"),
    watch: used.has("watch") ? claim("watch") : "watch",
    watchPostEffect: used.has("watchPostEffect") ? claim("watchPostEffect") : "watchPostEffect",
    queue: claimQueue(),
    used,
  };
}
