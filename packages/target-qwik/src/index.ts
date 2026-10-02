import {
  defineTarget,
  exportsOf,
  ImportSet,
  js,
  jsxElement,
  printModule,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent, UfExport } from "@unframework/ir";

import { toQwikAttributes } from "./attributes.ts";

/** The Qwik 2 target (experimental while Qwik 2 is in beta). */
export const qwik: Target = defineTarget({
  name: "qwik",
  framework: { package: "@qwik.dev/core", range: ">=2.0.0-beta.47 <3" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const imports = new ImportSet([component.name]);
    const componentFn = imports.add("@qwik.dev/core", "component$");
    const definition = js.callExpression(js.identifier(componentFn), [
      js.arrowFunction([], [js.returnStatement(jsxElement(toQwikAttributes(component.render)))]),
    ]);
    const exports = exportsOf(component.name, context.module.exports);
    return [
      {
        path: `${component.name}.tsx`,
        contents: printModule(
          imports.toDeclarations(),
          exportStatements(component.name, definition, exports),
          { jsx: true },
        ),
      },
    ];
  },
});

export default qwik;

// The ESTree node types, named through codegen's builders: a target imports only ir and codegen.
type Expression = Parameters<typeof js.callExpression>[0];
type Statement = Parameters<typeof js.program>[0][number];

/**
 * Keeps the source's export shape. A lone default or same-named export is declared in place
 * (`export default component$(…)`, `export const Card = component$(…)`), as Qwik code is
 * written; aliases and several exports of one component go through an export list.
 */
function exportStatements(
  name: string,
  definition: Expression,
  exports: readonly UfExport[],
): Statement[] {
  const [only] = exports;
  if (exports.length === 1 && only!.kind === "default") return [js.exportDefault(definition)];
  if (exports.length === 1 && only!.name === name) {
    return [js.exportNamed(js.variableDeclaration("const", name, definition))];
  }
  const declaration = js.variableDeclaration("const", name, definition);
  return exports.length
    ? [
        declaration,
        js.exportList(
          name,
          exports.map((entry) => entry.name),
        ),
      ]
    : [declaration];
}
