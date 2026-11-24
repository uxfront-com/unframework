// A directive as an Angular attribute directive (ADR-0099): `<div [vFocusTrap]="open()">`, a
// standalone class, `VFocusTrap`, selected by its input and always bound, since a static
// `vFocusTrap="x"` would render a DOM attribute too. Its constructor's `afterRenderEffect` passes
// the input to the inline `runDirective` after each render that changes it, which the server
// never runs, and `DestroyRef` stops it. Angular creates projected content with the component
// that writes it, before a child puts it in the document, and keeps it while the child takes it
// out, so the runner follows the element's place in the document (`directive-runner.ts` in the
// codegen). Angular mounts a parent in the same view before its child and a child in an `@if`
// before its parent, so each hook goes through the inline `queueHook`, which runs them in Vue's
// order (`emulated`).
import {
  dependencyImports,
  directiveDependencies,
  directiveElement,
  directiveHooksObject,
  directiveRunnerCode,
  hookQueueCode,
  wrapperNames,
  directiveModuleNames,
  ImportSet,
  js,
  kebabCase,
  NameScope,
  printProgram,
} from "@unframework.dev/codegen";
import type { DirectiveRunnerNames, EmitContext, OutputFile } from "@unframework.dev/codegen";
import type { UfDirective } from "@unframework.dev/ir";

/** The inline helper that runs a directive's hooks as its element comes and goes. */
export const RUNNER_HELPER = "runDirective";

/** The runner's names, each claimed through `claim` from its base. */
export function runnerNames(claim: (base: string) => string): DirectiveRunnerNames {
  return {
    run: claim(RUNNER_HELPER),
    hooks: claim("DirectiveHooks"),
    states: claim("directiveStates"),
    watch: claim("watchDocument"),
    watches: claim("documentWatches"),
    checker: claim("directiveCheck"),
    leftWatch: claim("watchLeft"),
    queue: claim("queueHook"),
  };
}

/** The runner and the queue it calls, as a file declares them. */
export function runnerCode(names: DirectiveRunnerNames): Array<string> {
  return [...directiveRunnerCode(names), hookQueueCode(names.queue)].map((code) => `${code}\n`);
}

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
  run: string,
  imports: ImportSet,
): string {
  const core = (name: string, type = false) => imports.add("@angular/core", name, { type });
  // Its own names, apart from every name a hook reads.
  const own = wrapperNames(directive, ["hooks", "element", "stop"] as const);
  const element = directiveElement(directive);
  const hooks = directiveHooksObject(directive).replaceAll("\n", "\n    ");
  const body = [
    `const ${own.hooks} = ${hooks};`,
    `const ${own.element} = this.element.nativeElement;`,
    `let ${own.stop}: (() => void) | undefined;`,
    `${core("afterRenderEffect")}(() => {`,
    `  ${own.stop} = ${run}(${own.hooks}, ${own.element}, this.${directive.name}());`,
    "});",
    `${core("inject")}(${core("DestroyRef")}).onDestroy(() => ${own.stop}?.());`,
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
export function emitDirective(directive: UfDirective, context: EmitContext): Array<OutputFile> {
  const dependencies = directiveDependencies(directive, context.module);
  // The module's helpers take names apart from everything the copied code declares or reads.
  const imports = new ImportSet(new NameScope(directiveModuleNames(directive, dependencies)));
  const runner = runnerNames((base) => imports.claim(base));
  const directiveCode = directiveClassCode(
    directive,
    directiveClassName(directive.name),
    runner.run,
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
        ...runnerCode(runner),
        directiveCode,
      ].join("\n"),
    },
  ];
}
