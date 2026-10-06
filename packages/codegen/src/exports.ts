import type * as AST from "@oxc-project/types";
import type { TypeDeclaration, UfComponent, UfExport, UfModule } from "@unframework/ir";

import { exportDefault, exportList, exportNamed, variableDeclaration } from "./js/builders.ts";

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

/** The exports of one component, in source order. */
export function exportsOf(component: string, exports: readonly UfExport[]): UfExport[] {
  return exports.filter((entry) => entry.local === component);
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
 * outputs keep the export, which consumers type their props with (M5). Copied as text, never
 * re-printed: oxc-codegen drops comments, and a member's doc comment is part of the type.
 */
export function typeDeclarationCode(declaration: TypeDeclaration): string {
  return declaration.exported ? `export ${declaration.code}` : declaration.code;
}
