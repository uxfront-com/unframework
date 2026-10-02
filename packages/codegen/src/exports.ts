import type * as AST from "@oxc-project/types";
import type { UfExport } from "@unframework/ir";

import { exportDefault, exportList, exportNamed } from "./js/builders.ts";

/**
 * Declares a component with the source's export shape. A lone default export or a lone export
 * under the component's own name is declared in place (`export default function Hello`,
 * `export function Card`), the way the code is written by hand; aliases and several exports of
 * one component go through an export list, so no export is ever dropped.
 */
export function exportDeclaration(
  local: string,
  declaration: AST.Function | AST.Class,
  exports: readonly UfExport[],
): AST.Statement[] {
  const [only] = exports;
  if (exports.length === 1 && only!.kind === "default") return [exportDefault(declaration)];
  if (exports.length === 1 && only!.name === local) return [exportNamed(declaration)];
  const names = exports.map((entry) => entry.name);
  return names.length ? [declaration, exportList(local, names)] : [declaration];
}

/** The exports of one component, in source order. */
export function exportsOf(component: string, exports: readonly UfExport[]): UfExport[] {
  return exports.filter((entry) => entry.local === component);
}
