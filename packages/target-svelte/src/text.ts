// Laying out the script's code (ADR-0041): the formatter indents the script block of every output
// it formats, and the target indents it too, so the output it serves unformatted reads alike.
// Code copied from the source keeps the source's indentation on its continuation lines, so it is
// shifted to where the target puts it; a line that starts inside a string or template literal
// never moves, as that would change the literal's value. The literals come from parsing the code,
// so a regular expression holding a quote or a backtick cannot mislead it.
import { parseExpression, parseStatementsSource } from "@unframework/codegen";

import { visit } from "./ast.ts";

/** One level of a Svelte script's indentation, as Svelte's own documentation writes it. */
export const INDENT = "  ";

/** The ranges of the string and template literals in code, or `undefined` when it does not parse. */
function literalRanges(code: string): { start: number; end: number }[] | undefined {
  let root: unknown;
  try {
    root = parseStatementsSource(code).statements;
  } catch {
    try {
      root = parseExpression(code);
    } catch {
      return undefined;
    }
  }
  const ranges: { start: number; end: number }[] = [];
  visit(root, (node) => {
    const literal =
      node.type === "TemplateLiteral" ||
      node.type === "TSTemplateLiteralType" ||
      (node.type === "Literal" && typeof node["value"] === "string");
    if (literal) ranges.push({ start: node.start, end: node.end });
  });
  return ranges;
}

/** Each line of code, with whether it starts inside a literal (its text must not move). */
function linesOf(code: string): { text: string; fixed: boolean }[] | undefined {
  const literals = literalRanges(code);
  if (!literals) return undefined;
  let offset = 0;
  return code.split("\n").map((text) => {
    const start = offset;
    offset += text.length + 1;
    return { text, fixed: literals.some((range) => range.start < start && start < range.end) };
  });
}

/**
 * Code moved to the indentation `pad`: its first line where the code starts, and its other
 * lines shifted by the same amount, keeping their indentation relative to each other (the source's
 * function body under its header, its closing brace under the header's start). A line inside a
 * literal stays as it is. Code that does not parse keeps its continuation lines as they are.
 */
export function reindent(code: string, pad: string): string {
  const lines = linesOf(code);
  if (!lines) {
    const [first = "", ...rest] = code.split("\n");
    return [`${pad}${first}`, ...rest].join("\n");
  }
  const [first, ...rest] = lines;
  const moved = rest.filter(({ text, fixed }) => !fixed && text.trim() !== "");
  const common = Math.min(...moved.map(({ text }) => /^[\t ]*/.exec(text)![0].length));
  const shift = Number.isFinite(common) ? common : 0;
  return [
    `${pad}${first!.text.trimStart()}`,
    ...rest.map(({ text, fixed }) =>
      fixed || text.trim() === "" ? (fixed ? text : "") : `${pad}${text.slice(shift)}`,
    ),
  ].join("\n");
}

/** A block the target writes: its opening line, its statements one level in, and its closing. */
export function block(open: string, statements: readonly string[], close: string): string {
  return [open, ...statements.map((statement) => reindent(statement, INDENT)), close].join("\n");
}

/**
 * Code copied into the script, with `</script` written `<\/script`: Svelte's parser ends the
 * block at the first `</script`, wherever it sits. It can only sit in a string or template
 * literal, or a comment, where `\/` is `/`. The analyser rejects the copied text that could hold
 * it (UF1002); the target escapes it anyway, as a guard, as Vue's does.
 */
export function escapeScriptEnd(code: string): string {
  return code.replace(/<\/(script)/gi, "<\\/$1");
}
