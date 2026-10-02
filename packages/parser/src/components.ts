import type { Function as FunctionNode, Program } from "oxc-parser";

import { exportName } from "./early-errors.ts";
import type { Span } from "./parse.ts";

/** How a component is exported. */
export interface ComponentExport {
  kind: "default" | "named";
  /** The exported name: `"default"` for the default export. */
  name: string;
  span: Span;
}

/** A top-level PascalCase function declaration: a component candidate. */
export interface ComponentDeclaration {
  name: string;
  node: FunctionNode;
  /** The statement that declares it, including any `export` keywords. */
  span: Span;
  /** Empty for a local (non-exported) component. */
  exports: ComponentExport[];
}

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/** Whether a name is PascalCase, which marks a function as a component. */
export function isComponentName(name: string): boolean {
  return PASCAL_CASE.test(name);
}

/**
 * Finds the component candidates of a module: top-level function declarations with
 * PascalCase names, with how each is exported (`export default function`,
 * `export function`, `export { Name }`, `export { Name as Other }` and `export default Name`).
 * A type-only export (`export type { Name }`, `export { type Name }`) exports no value, so it
 * does not make a component exported.
 */
export function findComponents(program: Program): ComponentDeclaration[] {
  const components = new Map<string, ComponentDeclaration>();
  const exportsByLocal = new Map<string, ComponentExport[]>();
  const addExport = (local: string, entry: ComponentExport) => {
    const list = exportsByLocal.get(local) ?? [];
    list.push(entry);
    exportsByLocal.set(local, list);
  };

  for (const statement of program.body) {
    let declaration: FunctionNode | undefined;
    let direct: ComponentExport | undefined;
    const span = { start: statement.start, end: statement.end };
    if (statement.type === "FunctionDeclaration") {
      declaration = statement;
    } else if (
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "FunctionDeclaration"
    ) {
      declaration = statement.declaration;
      const name = declaration.id?.name;
      if (name) direct = { kind: "named", name, span };
    } else if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "FunctionDeclaration"
    ) {
      declaration = statement.declaration;
      direct = { kind: "default", name: "default", span };
    } else if (
      statement.type === "ExportNamedDeclaration" &&
      !statement.source &&
      statement.exportKind !== "type"
    ) {
      for (const specifier of statement.specifiers) {
        if (specifier.local.type !== "Identifier" || specifier.exportKind === "type") continue;
        const exported = exportName(specifier.exported);
        addExport(specifier.local.name, {
          kind: exported === "default" ? "default" : "named",
          name: exported,
          span: { start: specifier.start, end: specifier.end },
        });
      }
    } else if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier"
    ) {
      addExport(statement.declaration.name, { kind: "default", name: "default", span });
    }

    const name = declaration?.id?.name;
    if (declaration && name && isComponentName(name)) {
      components.set(name, { name, node: declaration, span, exports: direct ? [direct] : [] });
    }
  }

  for (const [local, entries] of exportsByLocal) {
    components.get(local)?.exports.push(...entries);
  }
  return [...components.values()];
}
