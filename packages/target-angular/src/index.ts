import {
  angularDialect,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  kebabCase,
  printExpression,
  printMarkup,
  printProgram,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/**
 * The Angular 22 target: standalone, zoneless components. The host element gets
 * `display: contents`, so it adds no box of its own (decision D6). `standalone` and OnPush
 * change detection are Angular 22's defaults, so the metadata does not repeat them. It does
 * repeat `preserveWhitespaces: false`, the default the template's layout is printed for
 * (`angularDialect`): the component's own setting wins over a consumer's
 * `angularCompilerOptions`, which would otherwise turn the indentation into text.
 */
export const angular: Target = defineTarget({
  name: "angular",
  framework: { package: "@angular/core", range: ">=22 <23" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // The class takes the component's own name, so a component named `Component` imports
    // Angular's decorator as `Component_1`.
    const imports = new ImportSet([component.name]);
    const decoratorName = imports.add("@angular/core", "Component");
    // Angular drops whitespace at the template's edges, so the markup can sit on its own lines.
    const markup = printMarkup(component.render, angularDialect, { level: 2 });
    const metadata = js.objectExpression([
      ["selector", js.stringLiteral(`uf-${kebabCase(component.name)}`)],
      ["host", js.objectExpression([["style", js.stringLiteral("display: contents")]])],
      ["preserveWhitespaces", js.booleanLiteral(false)],
      ["template", js.templateLiteral(`\n${markup}\n  `)],
    ]);
    // Printed apart from the class: oxc-codegen puts a class's decorators after `export`, and
    // Angular code puts them first.
    const decorator = `@${printExpression(js.callExpression(js.identifier(decoratorName), [metadata]))}`;
    const [declaration, ...rest] = exportDeclaration(
      component.name,
      js.classDeclaration(component.name, []),
      exportsOf(component.name, context.module.exports),
    );
    const contents = [
      printProgram(js.program(imports.toDeclarations())),
      decorator,
      printProgram(js.program([declaration!, ...rest])),
    ].join("\n");
    return [{ path: `${kebabCase(component.name)}.ts`, contents }];
  },
});

export default angular;
