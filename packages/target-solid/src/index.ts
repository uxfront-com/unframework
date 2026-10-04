import {
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  jsxContext,
  jsxNode,
  NameScope,
  Placeholders,
  printComponentModule,
  sourceNames,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { CLASS_HELPER, solidJsx } from "./jsx.ts";
import { solidProps } from "./props.ts";
import { forSolid } from "./render.ts";

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
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    // Solid's `class` takes one string: static names and toggles print as `class` and
    // `classList`, and an inline helper joins dynamic parts with them (ADR-0038).
    "class-binding": {
      support: "emulated",
      helper: CLASS_HELPER,
      note: "Solid's class takes one string, so an inline helper joins dynamic parts with the static names and toggles; static names and toggles alone print as class and classList.",
    },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Every name the source declares or reads is taken before the output claims its own
    // (`props`, `Show`, `cx`), so none of them captures a reference (design §4.2).
    const imports = new ImportSet(new NameScope(sourceNames(component, context.module)));
    const placeholders = new Placeholders();
    const props = solidProps(component, imports, placeholders);
    const { dialect, helpers } = solidJsx(imports);
    const jsx = jsxContext({
      component,
      dialect,
      rules: props.rules,
      placeholders,
      includeKeys: false,
    });
    const fn = js.functionDeclaration(component.name, props.parameters, [
      ...props.statements,
      js.returnStatement(jsxNode(forSolid(component, props.rules), jsx)),
    ]);
    const statements = exportDeclaration(
      component.name,
      fn,
      exportsOf(component.name, context.module.exports),
    );
    return [
      {
        path: `${component.name}.tsx`,
        contents: printComponentModule(
          {
            imports,
            types: componentTypes(component, context.module),
            body: statements,
            helpers: helpers(),
            placeholders,
          },
          { jsx: true },
        ),
      },
    ];
  },
});

export default solid;
