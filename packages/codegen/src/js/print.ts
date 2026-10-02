import type * as AST from "@oxc-project/types";
import { printSync } from "oxc-codegen";

import { program } from "./builders.ts";

/** Prints an ESTree program as TypeScript (with JSX when `jsx` is set). */
export function printProgram(node: AST.Program, options: { jsx?: boolean } = {}): string {
  return printSync(node, { jsx: options.jsx ?? false, ts: true, indent: "  " }).code;
}

/** Prints an expression on its own, for embedding in a larger template. */
export function printExpression(expression: AST.Expression): string {
  const statement = {
    type: "ExpressionStatement",
    expression,
    start: 0,
    end: 0,
  } as AST.ExpressionStatement;
  return printSync(statement, { jsx: true, ts: true, indent: "  " }).code.trim().replace(/;$/, "");
}

/**
 * Prints a module: its imports, a blank line, then its body, the way a person lays out a
 * file.
 */
export function printModule(
  imports: readonly AST.ImportDeclaration[],
  body: readonly AST.Statement[],
  options: { jsx?: boolean } = {},
): string {
  const head = imports.length ? printProgram(program([...imports]), options) : "";
  const rest = printProgram(program([...body]), options);
  return head ? `${head}\n${rest}` : rest;
}
