import type * as AST from "@oxc-project/types";
import { parseModule } from "@unframework/parser";
import { format } from "oxfmt";
import type { FormatConfig } from "oxfmt";

import type { OutputFile } from "./target.ts";

/**
 * The formatting every output gets: the repo's own style, so golden files read like
 * hand-written code. oxfmt is pinned exactly, so formatting is deterministic (P8).
 *
 * Markup is never formatted, only code. oxfmt lays HTML out by CSS's whitespace model, which
 * is not any template compiler's: it moves a space between inline elements onto a line break
 * that Vue's `condense` then deletes, and trims or adds text at block edges, which Angular and
 * Vue keep as DOM text. The printer's own layout is whitespace-safe for each dialect, so
 * templates embedded in code (Angular's `template:`) are left as printed.
 *
 * Objects collapse: oxc-codegen prints every object of two or more properties over several
 * lines, which says nothing about intent, so oxfmt lays them out by width alone
 * (`style={{ color: "red", marginTop: gap }}`), as it would code written from scratch.
 */
export const OUTPUT_FORMAT: FormatConfig = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  objectWrap: "collapse",
  arrowParens: "always",
  endOfLine: "lf",
  embeddedLanguageFormatting: "off",
  insertFinalNewline: true,
};

/** Extensions oxfmt formats whole: code only. */
const FORMATTED = /\.[cm]?[jt]sx?$/;

/**
 * Whether {@link formatOutput} formats a whole file. Vue, Svelte and Astro files keep the
 * printer's layout, for the reason above (and risk R14), except for their TypeScript blocks.
 */
export function isFormatted(path: string): boolean {
  return FORMATTED.test(path);
}

/** The result of formatting one file. */
export interface FormatOutcome {
  file: OutputFile;
  /** oxfmt's error, when the printed code did not parse: a compiler bug. */
  error?: string;
}

/**
 * Formats an output file with oxfmt. Code files are formatted whole. In a markup file, each
 * TypeScript block is formatted as TypeScript on its own (ADR-0041): a `.vue` file's
 * `<script lang="ts">` blocks, a `.svelte` file's (indented two spaces, as Svelte code is
 * written) and an `.astro` file's frontmatter. The markup keeps the printer's layout, and the
 * file ends in one newline. Idempotent, and never throws.
 */
export async function formatOutput(file: OutputFile): Promise<FormatOutcome> {
  try {
    if (isFormatted(file.path)) {
      const result = await format(file.path, file.contents, OUTPUT_FORMAT);
      if (result.errors.length) return { file, error: formatErrors(result.errors) };
      return { file: { ...file, contents: result.code } };
    }
    const contents = await formatBlocks(file.path, file.contents);
    return { file: { ...file, contents: `${contents.trimEnd()}\n` } };
  } catch (error) {
    return { file, error: error instanceof Error ? error.message : String(error) };
  }
}

function formatErrors(errors: readonly { message: string }[]): string {
  return errors.map((error) => error.message).join("\n");
}

/**
 * A `<script>` block whose code is TypeScript, starting a line (the top level of a `.vue` or
 * `.svelte` file: printed markup never starts a line with `<script`, as the analyser rejects
 * the element and text escapes `<`). Its code runs to the first `</script`, where Vue's and
 * Svelte's parsers end it too; the targets write `<\/script` inside copied literals.
 */
const SCRIPT_BLOCK = /^<script\b[^>]*\blang="ts"[^>]*>/gm;
const SCRIPT_END = /<\/script/i;

/** Astro's frontmatter fence: `---` alone on a line. */
const FENCE = /^---$/m;

/** Formats the TypeScript blocks of a markup file, leaving everything else as it is. */
async function formatBlocks(path: string, contents: string): Promise<string> {
  if (path.endsWith(".astro")) {
    if (!contents.startsWith("---\n")) return contents;
    const close = FENCE.exec(contents.slice(4));
    if (!close) throw new Error("The frontmatter has no closing `---`.");
    const end = 4 + close.index;
    return `---\n${await formatCode(contents.slice(4, end), "")}${contents.slice(end)}`;
  }
  const indent = path.endsWith(".svelte") ? "  " : path.endsWith(".vue") ? "" : undefined;
  if (indent === undefined) return contents;
  let result = "";
  let last = 0;
  for (const open of contents.matchAll(SCRIPT_BLOCK)) {
    // A line of a block's own code that looks like an opening tag is code.
    if (open.index < last) continue;
    const start = open.index + open[0].length;
    const close = SCRIPT_END.exec(contents.slice(start));
    if (!close) throw new Error("A <script> block has no closing tag.");
    const end = start + close.index;
    result += `${contents.slice(last, start)}\n${await formatCode(contents.slice(start, end), indent)}`;
    last = end;
  }
  return result + contents.slice(last);
}

/**
 * Formats code as TypeScript, each line then indented by `indent` (narrowing the print width
 * to match), except the lines inside a template or string literal, whose text that would
 * change. Ends in a newline unless the code is empty.
 */
async function formatCode(code: string, indent: string): Promise<string> {
  const config = { ...OUTPUT_FORMAT, printWidth: OUTPUT_FORMAT.printWidth! - indent.length };
  const result = await format("block.ts", code, config);
  if (result.errors.length) throw new Error(formatErrors(result.errors));
  if (!indent) return result.code;
  const literals = multilineLiterals(result.code);
  let offset = 0;
  return result.code
    .split("\n")
    .map((line) => {
      const start = offset;
      offset += line.length + 1;
      const inside = literals.some((range) => range.start < start && start < range.end);
      return line && !inside ? indent + line : line;
    })
    .join("\n");
}

/** The spans of the literals in code that run over more than one line. */
function multilineLiterals(code: string): { start: number; end: number }[] {
  const parsed = parseModule("block.ts", code);
  if (parsed.errors.length) throw new Error(parsed.errors[0]!.message);
  const ranges: { start: number; end: number }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const { type, start, end } = node as AST.Span & { type?: unknown };
    const literal =
      type === "TemplateLiteral" ||
      type === "TSTemplateLiteralType" ||
      (type === "Literal" && typeof (node as AST.StringLiteral).value === "string");
    if (literal && code.slice(start, end).includes("\n")) ranges.push({ start, end });
    for (const value of Object.values(node)) if (typeof value === "object") visit(value);
  };
  visit(parsed.program);
  return ranges;
}
