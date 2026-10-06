import type * as AST from "@oxc-project/types";
import type { TypeDeclaration } from "@unframework/ir";
import { printSync } from "oxc-codegen";

import { typeDeclarationCode } from "../exports.ts";
import { ImportSet } from "../imports.ts";
import { program } from "./builders.ts";
import { Placeholders } from "./placeholders.ts";

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

/** The parts of a component's output file, in the order {@link printComponentModule} prints them. */
export interface ComponentModule {
  /** The imports, sorted by `ImportSet`. */
  imports?: ImportSet | readonly AST.ImportDeclaration[];
  /** The type declarations the component's props use, copied as written (`componentTypes`). */
  types?: readonly TypeDeclaration[];
  /** The component's own statements: its declaration and exports. */
  body: readonly AST.Statement[];
  /**
   * The inline helpers of emulated capabilities, after the component (a reader meets the
   * component first): built statements, or source code joined as written.
   */
  helpers?: readonly (AST.Statement | string)[];
  /** The placeholders the statements hold, spliced once the module is printed. */
  placeholders?: Placeholders;
}

/**
 * Prints a JSX target's output file: the imports, the copied type declarations, the
 * component, then its helpers, a blank line between each, with every placeholder spliced.
 * Code copied from the source enters only as text joined between printed pieces or through
 * placeholders, never re-printed (design §4.2).
 */
export function printComponentModule(
  parts: ComponentModule,
  options: { jsx?: boolean } = {},
): string {
  const imports =
    parts.imports instanceof ImportSet ? parts.imports.toDeclarations() : (parts.imports ?? []);
  const placeholders = parts.placeholders ?? new Placeholders();
  return placeholders.print(() =>
    [
      imports.length ? printProgram(program([...imports]), options) : undefined,
      ...(parts.types ?? []).map((declaration) => `${typeDeclarationCode(declaration)}\n`),
      printProgram(program([...parts.body]), options),
      ...(parts.helpers ?? []).map((helper) =>
        typeof helper === "string"
          ? `${helper.trimEnd()}\n`
          : printProgram(program([helper]), options),
      ),
    ]
      .filter((piece) => piece !== undefined)
      .join("\n"),
  );
}
