// A directive as a Solid ref factory (ADR-0099): `ref={vFocusTrap(() => open())}`, Solid 2's own
// form, which needs no `use:` and no global `JSX.Directives`. The factory runs while its element
// renders, so its `onMount`, effect and `onCleanup` are its branch's: `mounted` once the element
// is in the document, `updated` from an effect that reads the value, behind `Object.is`, and
// `unmounted` once the branch is disposed. Solid evaluates a ref before the element's children
// are inserted, so its hooks would run parent first: each goes through the inline `queueHook`,
// which runs them in Vue's order (`emulated`). Solid 1.9's server render drops `ref`.
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveHook,
  directiveHooksObject,
  directiveModuleNames,
  hookCall,
  hookParameters,
  hookQueueCode,
  NameScope,
  wrapperNames,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import type { UfDirective } from "@unframework.dev/ir";

/** The inline helper that runs a directive's hooks in Vue's order. */
export const QUEUE_HELPER = "queueHook";

/** The local names a ref factory reads: Solid's primitives, and the queue helper. */
export interface FactoryNames {
  solid: (name: "onMount" | "onCleanup" | "createEffect" | "untrack") => string;
  queue: string;
}

/** `function vFocusTrap(getValue: () => boolean): (element: HTMLElement) => void { … }`. */
export function factoryCode(directive: UfDirective, names: FactoryNames, exported = false): string {
  const { solid, queue } = names;
  // Its own names, apart from every name a hook reads.
  const own = wrapperNames(directive, [
    "hooks",
    "getValue",
    "target",
    "current",
    "element",
    "next",
    "previous",
  ] as const);
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const element = directiveElement(directive);
  const run = (call: string, hook: "mounted" | "updated" | "unmounted") =>
    `${queue}(${own.element}, () => ${call}, "${hook}");`;
  const body: string[] = [`let ${own.target}: ${element} | undefined;`];
  if (mounted || updated) {
    body.push(
      `${updated ? "let" : "const"} ${own.current} = ${solid("untrack")}(${own.getValue});`,
    );
  }
  if (mounted) {
    body.push(
      `${solid("onMount")}(() => {`,
      `  const ${own.element} = ${own.target};`,
      `  if (${own.element}) ${run(hookCall(own.hooks, mounted, [own.element, own.current]), "mounted")}`,
      "});",
    );
  }
  if (updated) {
    const previous = hookParameters(updated).length > 2;
    body.push(
      `${solid("createEffect")}(() => {`,
      `  const ${own.next} = ${own.getValue}();`,
      `  if (Object.is(${own.next}, ${own.current})) return;`,
      ...(previous ? [`  const ${own.previous} = ${own.current};`] : []),
      `  ${own.current} = ${own.next};`,
      `  const ${own.element} = ${own.target};`,
      `  if (${own.element}) ${run(hookCall(own.hooks, updated, [own.element, own.next, own.previous]), "updated")}`,
      "});",
    );
  }
  if (unmounted) {
    body.push(
      `${solid("onCleanup")}(() => {`,
      `  const ${own.element} = ${own.target};`,
      `  if (${own.element}) ${run(hookCall(own.hooks, unmounted, [own.element]), "unmounted")}`,
      "});",
    );
  }
  body.push(`return (${own.element}) => {`, `  ${own.target} = ${own.element};`, "};");
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n  ");
  return [
    `${exported ? "export " : ""}function ${directive.name}(${own.getValue}: () => ${directive.value.code}): (element: ${element}) => void {`,
    `  const ${own.hooks} = ${hooks};`,
    ...body.map((line) => `  ${line}`),
    "}",
  ].join("\n");
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, as a ref factory. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  // Solid's names and the queue's, apart from everything the copied code declares or reads.
  const scope = new NameScope(directiveModuleNames(directive, dependencies));
  const used = new Map<string, string>();
  const solid = (name: string) => {
    let local = used.get(name);
    if (local === undefined) {
      local = scope.claim(name);
      used.set(name, local);
    }
    return local;
  };
  solid("untrack");
  const queue = scope.claim(QUEUE_HELPER);
  const factory = factoryCode(directive, { solid, queue }, true);
  const specifiers = [...used]
    .toSorted(([a], [b]) => (a < b ? -1 : 1))
    .map(([imported, local]) => (imported === local ? local : `${imported} as ${local}`));
  const code = [
    [
      `import { ${specifiers.join(", ")} } from "solid-js";`,
      ...dependencyImports(dependencies),
    ].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    factory,
    hookQueueCode(queue),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}
