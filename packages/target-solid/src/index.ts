import {
  defineTarget,
  exportDeclaration,
  exportsOf,
  js,
  jsxElement,
  printProgram,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/** The Solid 1.9 target. Solid's JSX takes HTML attribute names as they are. */
export const solid: Target = defineTarget({
  name: "solid",
  framework: { package: "solid-js", range: ">=1.9 <2" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const fn = js.functionDeclaration(
      component.name,
      [],
      [js.returnStatement(jsxElement(component.render))],
    );
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printProgram(js.program(statements), { jsx: true }),
      },
    ];
  },
});

export default solid;
