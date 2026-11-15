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
  hookCall,
  hookQueueCode,
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
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const element = directiveElement(directive);
  const body: string[] = [`let target: ${element} | undefined;`];
  if (mounted || updated) {
    body.push(`${updated ? "let" : "const"} current = ${solid("untrack")}(getValue);`);
  }
  if (mounted) {
    body.push(
      `${solid("onMount")}(() => {`,
      "  const element = target;",
      `  if (element) ${queue}(element, () => ${hookCall("hooks", mounted, ["element", "current"])});`,
      "});",
    );
  }
  if (updated) {
    const previous = updated.parameters.length > 2;
    body.push(
      `${solid("createEffect")}(() => {`,
      "  const next = getValue();",
      "  if (Object.is(next, current)) return;",
      ...(previous ? ["  const previous = current;"] : []),
      "  current = next;",
      "  const element = target;",
      `  if (element) ${queue}(element, () => ${hookCall("hooks", updated, ["element", "next", "previous"])});`,
      "});",
    );
  }
  if (unmounted) {
    body.push(
      `${solid("onCleanup")}(() => {`,
      "  const element = target;",
      `  if (element) ${queue}(element, () => ${hookCall("hooks", unmounted, ["element"])});`,
      "});",
    );
  }
  body.push("return (element) => {", "  target = element;", "};");
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n  ");
  return [
    `${exported ? "export " : ""}function ${directive.name}(getValue: () => ${directive.value.code}): (element: ${element}) => void {`,
    `  const hooks = ${hooks};`,
    ...body.map((line) => `  ${line}`),
    "}",
  ].join("\n");
}

/** `vFocusTrap.ts`: a `.uf.ts` module's directive, as a ref factory. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const used = new Set<string>(["untrack"]);
  const factory = factoryCode(
    directive,
    {
      solid: (name) => {
        used.add(name);
        return name;
      },
      queue: QUEUE_HELPER,
    },
    true,
  );
  const code = [
    [
      `import { ${[...used].toSorted().join(", ")} } from "solid-js";`,
      ...dependencyImports(dependencies),
    ].join("\n"),
    ...dependencies.types,
    ...(dependencies.constants.length ? [dependencies.constants.join("\n")] : []),
    factory,
    hookQueueCode(QUEUE_HELPER, "queuedHooks"),
  ].join("\n\n");
  return [{ path: `${directive.name}.ts`, contents: `${code}\n` }];
}
