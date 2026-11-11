// A `.uf.ts` module's composable as its own Astro module, `useToggle.ts` (ADR-0069): static, as
// an Astro component's setup is (`./setup.ts`). Astro renders once, on the server, so the
// composable returns the values a caller's render reads: each ref's initial value, each derived
// value, its constants, and the functions a render may call. Client code is dropped: its
// watchers, effects and hooks, the functions that write, emit or await, and its callbacks, which
// only client code calls, so its callers pass none. A parameter only dropped code reads is
// still taken, under `_` and its name, so every caller passes the same arguments.
import {
  ImportSet,
  NameScope,
  addTypeImports,
  bindingOf,
  js,
  liveTypes,
  printProgram,
  typeDeclarationCode,
} from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import type {
  BindingId,
  FunctionItem,
  InterpolationNode,
  Prop,
  UfComponent,
  UfComposable,
} from "@unframework.dev/ir";

import { section } from "./frontmatter.ts";
import { moduleReads } from "./modules.ts";
import { SERVER, serverBindings, serverView, setupCode } from "./setup.ts";
import { spellingOf } from "./spelling.ts";

/**
 * `useToggle.ts`: `export function useToggle(initial: boolean) { const on = initial; return {
 * on }; }`, preceded by what it reads of its module: the value imports, the type imports and
 * declarations its kept code names, and the module's constants.
 */
export function emitComposable(composable: UfComposable, context: EmitContext): OutputFile[] {
  const { module } = context;
  const owner = serverOwner(composable);
  const view = serverView(owner, module);
  const live = serverBindings(view);
  const spelling = spellingOf(owner, module);
  // The module's names are its own at its top level, beside the function's.
  const imports = new ImportSet(new NameScope());
  // The setup spells the module's names as `spelling` does (a name `Astro` is renamed), so
  // their declarations take the same names.
  const reads = moduleReads(owner, module, live, {
    imports,
    scope: new NameScope(),
    local: (id) => spelling.name(id),
  });
  addTypeImports(view, module, imports, (name) => `${name}.astro`, { live: SERVER });
  const setup = setupCode(owner, live, spelling, () => "unknown");
  const returned = composable.returns.flatMap(({ name, binding }) => {
    if (!live.has(binding)) return [];
    const local = spelling.name(binding);
    return [local === name ? local : `${name}: ${local}`];
  });
  const parameters = composable.parameters.flatMap((parameter) => {
    if (parameter.kind === "callback") return [];
    const name = live.has(parameter.binding)
      ? spelling.name(parameter.binding)
      : spelling.scope.claim(`_${parameter.name}`);
    return [`${name}${parameter.optional ? "?" : ""}: ${parameter.type.code}`];
  });
  const typeParameters = composable.typeParameters?.length
    ? `<${composable.typeParameters
        .map(
          ({ name, constraint, default: fallback }) =>
            `${name}${constraint ? ` extends ${constraint.code}` : ""}${fallback ? ` = ${fallback.code}` : ""}`,
        )
        .join(", ")}>`
    : "";
  const statements = section([...setup.helpers, ...setup.statements]);
  const body = `${statements ? `${statements}\n` : ""}return { ${returned.join(", ")} };`;
  const types = [...liveTypes(view, module, SERVER), ...reads.types].toSorted(
    (a, b) => a.span.start - b.span.start,
  );
  const code = [
    ...(imports.size ? [printProgram(js.program(imports.toDeclarations())).trim()] : []),
    ...types.map(typeDeclarationCode),
    ...(reads.constants.length ? [reads.constants.join("\n")] : []),
    `export function ${composable.name}${typeParameters}(${parameters.join(", ")}) {\n${body}\n}`,
  ].join("\n\n");
  return [{ path: `${composable.name}.ts`, contents: `${code}\n` }];
}

/**
 * A composable as the owner the codegen walks and the setup read: its setup with no template,
 * the parameters a caller passes on Astro as its props, whose types its output names, and as
 * what the server render reaches, the members it may return: each ref, derived value and
 * constant, and each function a render may call (`serverFunctions`).
 */
function serverOwner(composable: UfComposable): UfComponent {
  const owner: UfComponent = {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
  const functions = serverFunctions(owner, composable);
  const returned = composable.returns.filter(({ binding }) => {
    const { kind } = bindingOf(owner, binding);
    return kind !== "localFn" || functions.has(binding);
  });
  const props = composable.parameters.flatMap((parameter): Prop[] =>
    parameter.kind === "callback"
      ? []
      : [
          {
            name: parameter.name,
            optional: parameter.optional ?? false,
            type: parameter.type,
            span: parameter.span,
          },
        ],
  );
  const children = returned.map(({ binding, span }): InterpolationNode => ({
    kind: "Interpolation",
    value: {
      code: bindingOf(owner, binding).name,
      span,
      refs: [{ kind: "Binding", binding, span }],
    },
    span,
  }));
  return { ...owner, props, render: { kind: "Fragment", children, span: composable.span } };
}

/**
 * The functions of a composable that run on the server: none that writes, emits, calls
 * `nextTick` or awaits, or reads a callback, a setup `let`, a template ref or another function
 * that does. The analyser calls the others client-only (ADR-0069), and no render calls them.
 */
function serverFunctions(owner: UfComponent, composable: UfComposable): Set<BindingId> {
  const functions = composable.setup.filter(
    (item): item is FunctionItem => item.kind === "Function",
  );
  const callbacks = new Set(
    composable.parameters.flatMap(({ kind, binding }) => (kind === "callback" ? [binding] : [])),
  );
  const client = new Set<BindingId>();
  for (let size = -1; size !== client.size;) {
    size = client.size;
    for (const { binding, function: fn } of functions) {
      if (client.has(binding)) continue;
      const reads = [fn.body, ...fn.parameters.flatMap(({ default: value }) => value ?? [])];
      const clientOnly =
        fn.async ||
        reads.some(({ refs }) =>
          refs.some((reference) => {
            switch (reference.kind) {
              case "Write":
              case "Emit":
              case "Api":
                return true;
              case "Binding": {
                const { kind } = bindingOf(owner, reference.binding);
                return (
                  callbacks.has(reference.binding) ||
                  kind === "localVar" ||
                  kind === "templateRef" ||
                  client.has(reference.binding)
                );
              }
              default:
                return false;
            }
          }),
        );
      if (clientOnly) client.add(binding);
    }
  }
  return new Set(functions.flatMap(({ binding }) => (client.has(binding) ? [] : [binding])));
}
