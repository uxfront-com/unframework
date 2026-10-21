// A component's stylesheets (plan §4.4, ADR-0063): a relative `.css` side-effect import is the
// sheet of the module's one component. The compiler reads each sheet through its resolver before
// analysis, and scopes it in codegen after; the analyser checks the import, lowers the sheet into
// the IR, and gives the component its scope id.
import { createDiagnostic } from "@unframework/diagnostics";
import { createStyleSheet } from "@unframework/ir";
import type { StyleSheet } from "@unframework/ir";
import { parseStylesheet } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";

import type { Reporter } from "./context.ts";

/** A stylesheet the source imports, as the compiler's resolver read it (ADR-0063). */
export interface StylesheetSource {
  /** The sheet's file as diagnostics name it, as the resolver gave it. */
  file: string;
  /** The sheet's text. */
  source: string;
  /** Whether the sheet's selectors use `:slotted()`, as the codegen scoper read them. */
  slotted: boolean;
}

/** A sheet the analyser lowered, and whether it uses `:slotted()`. */
export interface LoweredSheet {
  sheet: StyleSheet;
  slotted: boolean;
}

/** A specifier of a stylesheet, in CSS or a preprocessor's language. */
export const STYLESHEET_SPECIFIER: RegExp = /\.(css|scss|sass|less|styl|pcss)$/;

const PREPROCESSOR = /\.(scss|sass|less|styl|pcss)$/;

/** A component's sheet: a relative `.css` file. */
const SHEET = /^\.\.?\/.*\.css$/;

/**
 * The specifiers of the stylesheets a parsed module imports as its components' sheets, `import
 * "./Card.css"`, in source order, each once: what `compile()` asks its resolver to read before
 * the module is analysed.
 */
export function stylesheetImports(parsed: ParsedModule): string[] {
  const found = new Set<string>();
  for (const statement of parsed.program.body) {
    if (statement.type === "ImportDeclaration" && isSheetImport(statement)) {
      found.add(statement.source.value);
    }
  }
  return [...found];
}

function isSheetImport(statement: AST.ImportDeclaration): boolean {
  return (
    statement.importKind !== "type" &&
    !statement.specifiers.length &&
    SHEET.test(statement.source.value)
  );
}

const encoder = new TextEncoder();

/**
 * A component's scope id (ADR-0063): the 32-bit FNV-1a hash of the UTF-8 bytes of its name, a
 * NUL, and each sheet's text in import order, each followed by a NUL, as 8 lower-case hex digits.
 * No path goes into it, so it is the same on every machine and in every target (P8).
 */
export function scopeIdOf(name: string, sources: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const byte of encoder.encode(`${[name, ...sources].join("\0")}\0`)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Checks an import of a stylesheet, and lowers it into `sheets` when it is a component's sheet:
 * UF5003 for a preprocessor's language, UF5001 in a module of several components, UF5005 for a
 * file the resolver could not read, and UF5002 where it does not parse.
 */
export function stylesheetImport(
  statement: AST.ImportDeclaration,
  stylesheets: ReadonlyMap<string, StylesheetSource | undefined>,
  components: number,
  reporter: Reporter,
  sheets: LoweredSheet[],
): void {
  const specifier = statement.source.value;
  if (PREPROCESSOR.test(specifier)) {
    reporter.report(
      "UF5003",
      statement.source,
      `"${specifier}" is written in a preprocessor's language, and the compiler scopes plain CSS only.`,
      { help: "Compile the sheet to a `.css` file, and import that." },
    );
    return;
  }
  if (!isSheetImport(statement)) {
    reporter.unsupported(
      statement,
      SHEET.test(specifier)
        ? `A stylesheet is imported for its effect alone, as \`import "${specifier}";\`.`
        : `"${specifier}" is not a relative path: a component's stylesheet is a file of the project, imported as \`import "./Card.css";\`.`,
    );
    return;
  }
  if (components > 1) {
    reporter.report(
      "UF5001",
      statement.source,
      `"${specifier}" has no single owner: this module declares ${components} components, and a stylesheet scopes the elements of one.`,
      {
        help: "Move each component that needs styles into a module of its own, with its own stylesheet.",
      },
    );
    return;
  }
  const read = stylesheets.get(specifier);
  if (!read) {
    reporter.report(
      "UF5005",
      statement.source,
      `"${specifier}" cannot be read: the compiler finds no stylesheet there.`,
      { help: "Check the path and its case, or create the file." },
    );
    return;
  }
  const { errors } = parseStylesheet(read.file, read.source);
  for (const error of errors) {
    reporter.diagnostics.push(
      createDiagnostic("UF5002", {
        file: read.file,
        span: error.span,
        message: `This stylesheet is not valid CSS: ${error.message}.`,
      }),
    );
  }
  if (errors.length) return;
  sheets.push({
    sheet: createStyleSheet(specifier, read.source, {
      start: statement.start,
      end: statement.end,
    }),
    slotted: read.slotted,
  });
}
