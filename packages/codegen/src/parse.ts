// Parsing code copied from the source (plan §5.4): printers splice only code the analyser
// accepted, so these parse it to check its shape, to find where it needs parentheses and to read
// its literals, never to re-print it. Setup code is an expression (an initial value, an arrow's
// expression body) or statements (a function's block body), ADR-0045.
import type * as AST from "@oxc-project/types";
import { parseModule } from "@unframework/parser";
import type { ParsedModule } from "@unframework/parser";

/** A comment in parsed code. */
export type ExpressionComment = ParsedModule["comments"][number];

/** An expression parsed on its own: offsets are relative to its code. */
export interface ParsedExpression {
  expression: AST.Expression;
  /** The comments inside the code, in source order. */
  comments: ExpressionComment[];
}

/** Statements parsed on their own: offsets are relative to their code. */
export interface ParsedStatements {
  /** The statements, in order: a block body (`{ … }`) is one block statement. */
  statements: (AST.Statement | AST.Directive)[];
  /** The comments inside the code, in source order. */
  comments: ExpressionComment[];
}

/**
 * What code is: one expression (an initial value, an arrow's expression body, a condition), or
 * statements (a function's block body, `{ … }`, or the statements inside one). Code alone does
 * not say which: `{ a }` is an object as an expression and a block as statements.
 */
export type CodeKind = "expression" | "statements";

// `(` and a line break before the code, and a line break before `)`: an object literal is
// not read as a block, and a trailing line comment cannot swallow the `)`.
const EXPRESSION_PREFIX = "(\n";
const EXPRESSION_SUFFIX = "\n);";
// Statements parse as an async function's body, where `return` and `await` are allowed, as they
// are in the setup's functions; a line break after them keeps a trailing line comment off the `}`.
const STATEMENTS_PREFIX = "async function $uf() {\n";
const STATEMENTS_SUFFIX = "\n}";

/**
 * Parses code that must be exactly one expression, with its comments, through
 * `@unframework/parser` (oxc). Offsets in the result are relative to `code`. Throws when the
 * code is not one complete expression: printers splice only code the analyser accepted, so
 * that is a compiler bug, reported as an internal error.
 */
export function parseExpressionSource(code: string): ParsedExpression {
  // `@unframework/parser` has no expression entry: wrap the code in parentheses and parse a
  // module. Code that closes the wrapper's parentheses itself (`a) + (b`) parses too, but
  // then the expression reaches past the code, which the span check rejects.
  const parsed = parseModule("expression.tsx", `${EXPRESSION_PREFIX}${code}${EXPRESSION_SUFFIX}`);
  const [statement, ...rest] = parsed.program.body;
  const expression = statement?.type === "ExpressionStatement" ? statement.expression : undefined;
  if (
    parsed.errors.length > 0 ||
    rest.length > 0 ||
    !expression ||
    expression.start < EXPRESSION_PREFIX.length ||
    expression.end > EXPRESSION_PREFIX.length + code.length
  ) {
    const reason = parsed.errors[0]?.message ?? "it is not one expression";
    throw new Error(`Cannot parse \`${code}\` as an expression: ${reason}.`);
  }
  shift(expression, EXPRESSION_PREFIX.length);
  return { expression, comments: comments(parsed, EXPRESSION_PREFIX.length) };
}

/** Parses code that must be exactly one expression: see {@link parseExpressionSource}. */
export function parseExpression(code: string): AST.Expression {
  return parseExpressionSource(code).expression;
}

/**
 * Parses code that must be a list of statements (a function's body, with or without its
 * braces), with its comments, as {@link parseExpressionSource} parses an expression: offsets are
 * relative to `code`, and code that is not complete statements throws. `return` and `await` are
 * allowed, as in an async function's body.
 */
export function parseStatementsSource(code: string): ParsedStatements {
  const source = `${STATEMENTS_PREFIX}${code}${STATEMENTS_SUFFIX}`;
  const parsed = parseModule("statements.tsx", source);
  const [statement, ...rest] = parsed.program.body;
  // Code that closes the wrapper's brace itself (`} f() {`) leaves more than the one function.
  const body =
    statement?.type === "FunctionDeclaration" && statement.end === source.length
      ? statement.body
      : undefined;
  if (parsed.errors.length > 0 || rest.length > 0 || !body) {
    const reason = parsed.errors[0]?.message ?? "it is not a list of statements";
    throw new Error(`Cannot parse \`${code}\` as statements: ${reason}.`);
  }
  const statements = body.body;
  shift(statements, STATEMENTS_PREFIX.length);
  return { statements, comments: comments(parsed, STATEMENTS_PREFIX.length) };
}

/** The AST of code of either kind, with its comments: see {@link CodeKind}. */
export function parseCodeSource(
  code: string,
  kind: CodeKind,
): { root: AST.Expression | ParsedStatements["statements"]; comments: ExpressionComment[] } {
  if (kind === "expression") {
    const { expression, comments: found } = parseExpressionSource(code);
    return { root: expression, comments: found };
  }
  const { statements, comments: found } = parseStatementsSource(code);
  return { root: statements, comments: found };
}

function comments(parsed: ParsedModule, offset: number): ExpressionComment[] {
  return parsed.comments.map((comment) => ({
    ...comment,
    start: comment.start - offset,
    end: comment.end - offset,
  }));
}

/** Moves every node of a parsed tree back by the length of the wrapper before the code. */
function shift(root: unknown, offset: number): void {
  visitNodes(root, (node) => {
    node.start -= offset;
    node.end -= offset;
  });
}

/** A node of oxc's AST, as far as a walk reads it. */
export interface Node {
  type: string;
  start: number;
  end: number;
}

export function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

/** Calls `visit` on every node of an AST, depth-first, parents before their children. */
export function visitNodes(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visitNodes(item, visit);
    return;
  }
  if (!isNode(root)) return;
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") visitNodes(value, visit);
  }
}
