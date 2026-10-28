import type * as AST from "@oxc-project/types";
import type { Span, TypeDeclaration, UfComponent, UfExport, UfModule } from "@unframework/ir";

import { keyOwner } from "./imports.ts";
import type { ImportSet } from "./imports.ts";
import { exportDefault, exportList, exportNamed, variableDeclaration } from "./js/builders.ts";
import { parseStatementsSource } from "./parse.ts";
import { liveTypeNames } from "./references.ts";
import { collectNames } from "./rewrite.ts";

/**
 * Declares a component with the source's export shape. A lone default export or a lone export
 * under the component's own name is declared in place (`export default function Hello`,
 * `export function Card`), the way the code is written by hand; aliases and several exports of
 * one component go through an export list, so no export is ever dropped. A component defined
 * by an expression (Qwik's `component$(…)`) is a `const` (`export const Card = …`), or the
 * default export's expression itself.
 */
export function exportDeclaration(
  local: string,
  declaration: AST.Function | AST.Class | AST.Expression,
  exports: readonly UfExport[],
): AST.Statement[] {
  const [only] = exports;
  if (exports.length === 1 && only!.kind === "default") return [exportDefault(declaration)];
  const statement = isDeclaration(declaration)
    ? declaration
    : variableDeclaration("const", local, declaration);
  if (exports.length === 1 && only!.name === local) return [exportNamed(statement)];
  const names = exports.map((entry) => entry.name);
  return names.length ? [statement, exportList(local, names)] : [statement];
}

function isDeclaration(
  node: AST.Function | AST.Class | AST.Expression,
): node is AST.Function | AST.Class {
  return node.type === "FunctionDeclaration" || node.type === "ClassDeclaration";
}

/**
 * The exports of one component, in source order. A component the module does not export is
 * exported by its name all the same: it is a sibling file of the module's (ADR-0053), which its
 * siblings import, and which the module's public exports leave out.
 */
export function exportsOf(component: string, exports: readonly UfExport[]): UfExport[] {
  const own = exports.filter((entry) => entry.local === component);
  return own.length
    ? own
    : [{ kind: "named", name: component, local: component, span: { start: 0, end: 0 } }];
}

/**
 * The type declarations a component's output declares beside it: those its props' types
 * reach (`component.types`), in source order (ADR-0034).
 */
export function componentTypes(component: UfComponent, module: UfModule): TypeDeclaration[] {
  const used = new Set(component.types);
  return module.types.filter((declaration) => used.has(declaration.name));
}

/**
 * A type declaration as the source writes it, exported when the source exports it: the
 * outputs keep the export, which consumers type their props with (ADR-0068). Copied as text,
 * never re-printed: oxc-codegen drops comments, and a member's doc comment is part of the type.
 */
export function typeDeclarationCode(declaration: TypeDeclaration): string {
  return declaration.exported ? `export ${declaration.code}` : declaration.code;
}

/**
 * The specifier an output imports a module's types from (ADR-0067): a `.uf.tsx` module's are
 * exported by the output of its main component (`keyOwner`), `file(name)` naming a component's
 * output file as for `childImports`; any other specifier, a `.ts` module's or a package's, is
 * kept as written, since every output tree holds the `.ts` modules unchanged (ADR-0070).
 */
export function typeSpecifier(
  specifier: string,
  module: UfModule,
  file: (name: string) => string,
): string {
  if (!specifier.endsWith(".uf.tsx")) return specifier;
  const entry = module.imports?.find((each) => each.specifier === specifier);
  // A module the source imports no component of has no API here: its main component is named
  // as its file, as the analyser names a module's default export.
  const stem = specifier.slice(specifier.lastIndexOf("/") + 1, -".uf.tsx".length);
  const owner = (entry && keyOwner(entry.api.components)) ?? stem;
  return `${specifier.slice(0, specifier.lastIndexOf("/") + 1)}${file(owner)}`;
}

/**
 * Adds the `import type` names a component's output reads (ADR-0067): each name of the module's
 * type imports that what the output prints reads (`liveTypeNames`), under the source's own
 * local name, from `typeSpecifier`. The output of the module's main component also writes the
 * module's type exports (`typeExports`), and reads what their declarations name.
 */
export function addTypeImports(
  component: UfComponent,
  module: UfModule,
  imports: ImportSet,
  file: (name: string) => string,
): void {
  if (!module.typeImports?.length) return;
  const read = liveTypeNames(component, module, { client: true });
  if (keyOwner(module.components, module.exports) === component.name) {
    for (const entry of module.typeExports ?? []) {
      if (entry.kind !== "Declaration") continue;
      const [statement] = parseStatementsSource(entry.code).statements;
      collectNames(statement, read);
    }
  }
  for (const entry of module.typeImports) {
    for (const name of entry.names) {
      if (!read.has(name.local)) continue;
      imports.add(typeSpecifier(entry.specifier, module, file), name.imported, {
        type: true,
        local: name.local,
        exact: true,
      });
    }
  }
}

/**
 * The module's type exports, as the output of its main component writes them (ADR-0068): an
 * exported type no component reaches as written, and a re-export from `typeSpecifier`, each with
 * its span, so a target can place it in source order among the types it copies. Every other
 * component's output writes none.
 */
export function typeExportsCode(
  component: UfComponent,
  module: UfModule,
  file: (name: string) => string,
): { code: string; span: Span }[] {
  if (keyOwner(module.components, module.exports) !== component.name) return [];
  return (module.typeExports ?? []).map((entry) => {
    if (entry.kind === "Declaration") return { code: `export ${entry.code}`, span: entry.span };
    const names = entry.names.map(({ imported, exported }) =>
      imported === exported ? imported : `${imported} as ${exported}`,
    );
    const specifier = JSON.stringify(typeSpecifier(entry.specifier, module, file));
    return { code: `export type { ${names.join(", ")} } from ${specifier};`, span: entry.span };
  });
}
