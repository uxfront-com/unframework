import {
  componentTypes,
  defineTarget,
  exportDeclaration,
  exportsOf,
  ImportSet,
  js,
  kebabCase,
  Placeholders,
  printExpression,
  printProgram,
  typeDeclarationCode,
} from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { classMembers } from "./inputs.ts";
import { template } from "./template.ts";
import { declaredTypes } from "./types.ts";

/**
 * The Angular 22 target: standalone, zoneless components. The host element gets
 * `display: contents`, so it adds no box of its own (decision D6, ADR-0010). `standalone` and
 * OnPush change detection are Angular 22's defaults, so the metadata does not repeat them. It
 * does repeat `preserveWhitespaces: false`, the default the template's layout is printed for
 * (`angularDialect`): the component's own setting wins over a consumer's
 * `angularCompilerOptions`, which would otherwise turn the indentation into text.
 *
 * Each prop is a public signal input (design §5.5); each allowed global an expression reads is
 * a protected member of the same name, since a template sees only its component's members.
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
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { module } = context;
    // The module's types keep their names, which consumers import. Angular's own names come
    // next: its compiler accepts a signal input only in a class whose decorator is imported as
    // `Component` (NG8110 otherwise), so a component named `Component` takes another name
    // locally (`Component_1`), exported under its own.
    const imports = new ImportSet(module.types.map(({ name }) => name));
    const decoratorName = imports.add("@angular/core", "Component");
    const className = imports.claim(component.name);
    const placeholders = new Placeholders();
    const closure = componentTypes(component, module);
    const members = classMembers(component, imports, placeholders, closure);
    const metadata = js.objectExpression([
      ["selector", js.stringLiteral(`uf-${kebabCase(component.name)}`)],
      ["host", js.objectExpression([["style", js.stringLiteral("display: contents")]])],
      ["preserveWhitespaces", js.booleanLiteral(false)],
      ["template", js.templateLiteral(`\n${template(component)}\n  `)],
    ]);
    // Printed apart from the class: oxc-codegen puts a class's decorators after `export`, and
    // Angular code puts them first.
    const decorator = `@${printExpression(js.callExpression(js.identifier(decoratorName), [metadata]))}`;
    const statements = exportDeclaration(
      className,
      js.classDeclaration(className, [], members),
      exportsOf(component.name, module.exports),
    );
    const types = declaredTypes(
      closure,
      component.props.map(({ type }) => type.code),
    );
    const contents = placeholders.print(() =>
      [
        printProgram(js.program(imports.toDeclarations())),
        ...types.map((declaration) => `${typeDeclarationCode(declaration)}\n`),
        decorator,
        printProgram(js.program(statements)),
      ].join("\n"),
    );
    return [{ path: `${kebabCase(component.name)}.ts`, contents }];
  },
});

export default angular;
