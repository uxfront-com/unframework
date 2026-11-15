// A directive as an Angular attribute directive (ADR-0099): `<div [vFocusTrap]="open()">`, a
// standalone class, `VFocusTrap`, selected by its input and always bound, since a static
// `vFocusTrap="x"` would render a DOM attribute too. Its constructor's `afterRenderEffect` reads
// the input after each render that changes it, which the server never runs: the first run is
// `mounted`, any later one with another value (`Object.is`) `updated`. `DestroyRef` runs
// `unmounted`, on the server too, so it runs only after `mounted` did. Angular mounts a parent in
// the same view before its child and a child in an `@if` before its parent, so each hook goes
// through the inline `queueHook`, which runs them in Vue's order (`emulated`).
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveHook,
  directiveHooksObject,
  hookCall,
  hookQueueCode,
  ImportSet,
  js,
  kebabCase,
  NameScope,
  printProgram,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import type { UfDirective } from "@unframework.dev/ir";

/** The inline helper that runs a directive's hooks in Vue's order. */
export const QUEUE_HELPER = "queueHook";

/** The class an Angular directive is declared as: `VFocusTrap` for `vFocusTrap`. */
export function directiveClassName(name: string): string {
  return `${name[0]!.toUpperCase()}${name.slice(1)}`;
}

/** The file a `.uf.ts` module's directive is written to: `v-focus-trap.ts` for `vFocusTrap`. */
export function directiveFile(name: string): string {
  return kebabCase(name);
}

/** `@Directive({ selector: "[vFocusTrap]" }) export class VFocusTrap { … }`. */
export function directiveClassCode(
  directive: UfDirective,
  className: string,
  queue: string,
  imports: ImportSet,
): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  const mounted = directiveHook(directive, "mounted");
  const updated = directiveHook(directive, "updated");
  const unmounted = directiveHook(directive, "unmounted");
  const element = directiveElement(directive);
  const run = (call: string) => `${queue}(element, () => ${call});`;
  const effect: string[] = [
    `const value = this.${directive.name}();`,
    "const previous = last;",
    "last = { value };",
  ];
  if (mounted) {
    effect.push(`if (!previous) ${run(hookCall("hooks", mounted, ["element", "value"]))}`);
  } else {
    effect.push("if (!previous) return;");
  }
  if (updated) {
    effect.push(
      `${mounted ? "else " : ""}if (!Object.is(value, previous.value)) {`,
      `  ${run(hookCall("hooks", updated, ["element", "value", "previous.value"]))}`,
      "}",
    );
  }
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n    ");
  const body = [
    `const hooks = ${hooks};`,
    "const element = this.element.nativeElement;",
    `let last: { value: ${directive.value.code} } | undefined;`,
    `${core("afterRenderEffect")}(() => {`,
    ...effect.map((line) => `  ${line}`),
    "});",
    ...(unmounted
      ? [
          `${core("inject")}(${core("DestroyRef")}).onDestroy(() => {`,
          `  if (last) ${run(hookCall("hooks", unmounted, ["element"]))}`,
          "});",
        ]
      : []),
  ];
  return [
    `@${core("Directive")}({ selector: "[${directive.name}]" })`,
    `export class ${className} {`,
    `  readonly ${directive.name} = ${core("input")}.required<${directive.value.code}>();`,
    `  private readonly element = ${core("inject")}<${core("ElementRef", true)}<${element}>>(${core("ElementRef")});`,
    "",
    "  constructor() {",
    ...body.map((line) => `    ${line}`),
    "  }",
    "}",
    "",
  ].join("\n");
}

/** `v-focus-trap.ts`: a `.uf.ts` module's directive, as a standalone attribute directive. */
export function emitDirective(directive: UfDirective, context: EmitContext): OutputFile[] {
  const dependencies = directiveDependencies(directive, context.module);
  const imports = new ImportSet(new NameScope([directive.name, QUEUE_HELPER, "queuedHooks"]));
  const directiveCode = directiveClassCode(
    directive,
    directiveClassName(directive.name),
    QUEUE_HELPER,
    imports,
  );
  return [
    {
      path: `${directiveFile(directive.name)}.ts`,
      contents: [
        printProgram(js.program(imports.toDeclarations())).trim(),
        ...dependencyImports(dependencies),
        "",
        ...dependencies.types.map((code) => `${code}\n`),
        ...(dependencies.constants.length ? [`${dependencies.constants.join("\n")}\n`] : []),
        `${hookQueueCode(QUEUE_HELPER, "queuedHooks")}\n`,
        directiveCode,
      ].join("\n"),
    },
  ];
}
