import type {
  Directive,
  Program,
  Statement,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
} from "oxc-parser";

import type { Span } from "./parse.ts";

/** A top-level `interface` or `type` declaration, exported or not. */
export interface TypeDeclarationStatement {
  /** The declared name. */
  name: string;
  /** The declaration itself, from `interface` or `type` (without `export`) to its end. */
  node: TSInterfaceDeclaration | TSTypeAliasDeclaration;
  /** Whether the statement exports it (`export interface X`, `export type X = …`). */
  exported: boolean;
  /** The whole statement, `export` included. */
  span: Span;
}

/**
 * Finds the top-level type declarations of a module, in source order: `interface X {…}` and
 * `type X = …`, plain or exported. A component's props type is one of them, or an object type
 * literal (ADR-0034); the analyser checks what they hold.
 */
export function findTypeDeclarations(program: Program): TypeDeclarationStatement[] {
  const found: TypeDeclarationStatement[] = [];
  for (const statement of program.body) {
    const declaration = typeDeclarationOf(statement);
    if (!declaration) continue;
    found.push({
      name: declaration.id.name,
      node: declaration,
      exported: statement.type === "ExportNamedDeclaration",
      span: { start: statement.start, end: statement.end },
    });
  }
  return found;
}

/** The type declaration a top-level statement makes, if it makes one. */
export function typeDeclarationOf(
  statement: Directive | Statement,
): TSInterfaceDeclaration | TSTypeAliasDeclaration | undefined {
  const declaration =
    statement.type === "ExportNamedDeclaration" && !statement.source
      ? statement.declaration
      : statement;
  return declaration?.type === "TSInterfaceDeclaration" ||
    declaration?.type === "TSTypeAliasDeclaration"
    ? declaration
    : undefined;
}
