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
  arrowParens: "always",
  endOfLine: "lf",
  embeddedLanguageFormatting: "off",
  insertFinalNewline: true,
};

/**
 * Extensions oxfmt formats: code only. Vue, Svelte and Astro files keep the printer's layout,
 * for the reason above (and risk R14). When the Vue and Svelte targets emit `<script>` blocks
 * (M2), format each block's content as TypeScript on its own rather than the whole file.
 */
const FORMATTED = /\.[cm]?[jt]sx?$/;

/** Whether {@link formatOutput} formats a file, or leaves the printer's layout. */
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
 * Formats an output file with oxfmt. Files oxfmt does not format keep the printer's layout,
 * with one trailing newline. Never throws.
 */
export async function formatOutput(file: OutputFile): Promise<FormatOutcome> {
  if (!isFormatted(file.path)) {
    return { file: { ...file, contents: `${file.contents.trimEnd()}\n` } };
  }
  try {
    const result = await format(file.path, file.contents, OUTPUT_FORMAT);
    if (result.errors.length) {
      return { file, error: result.errors.map((error) => error.message).join("\n") };
    }
    return { file: { ...file, contents: result.code } };
  } catch (error) {
    return { file, error: error instanceof Error ? error.message : String(error) };
  }
}
