import { createDiagnostic } from "@unframework/diagnostics";
import type { Diagnostic, DiagnosticCode, DiagnosticInit, Fix } from "@unframework/diagnostics";

import type { UnportableCharacter } from "./characters.ts";
import type { Divergence, HtmlOnlyReference } from "./jsx/text.ts";

/** A node with a span: an AST node or a span. */
export interface Located {
  start: number;
  end: number;
}

const SUPPORTED_SUBSET =
  "This version of the compiler lowers exported components with typed props, a setup (state, derived values, watchers, lifecycle hooks, local functions and constants, `defineEmits`, template refs and ids), element listeners and JSX: expressions, conditionals, lists, class and style bindings, spreads with known keys and SVG. Composition (child components, slots, `v-model`) lands in M3, styles in M4 and imports of modules in M5.";

/** Collects the diagnostics of one file. */
export class Reporter {
  readonly file: string;
  readonly diagnostics: Diagnostic[] = [];

  constructor(file: string) {
    this.file = file;
  }

  report(
    code: DiagnosticCode,
    node: Located,
    message: string,
    init: Omit<DiagnosticInit, "file" | "span" | "message"> = {},
  ): void {
    this.diagnostics.push(
      createDiagnostic(code, {
        ...init,
        file: this.file,
        span: { start: node.start, end: node.end },
        message,
      }),
    );
  }

  /**
   * Reports a construct of the source language that this compiler cannot lower yet (UF1002).
   * The message is a full sentence such as "Props are not supported yet."
   */
  unsupported(node: Located, message: string, init: { help?: string; fixes?: Fix[] } = {}): void {
    this.report("UF1002", node, message, { ...init, help: init.help ?? SUPPORTED_SUBSET });
  }

  /** Whether any error was reported since `mark`. */
  hasErrorsSince(mark: number): boolean {
    return this.diagnostics.slice(mark).some((diagnostic) => diagnostic.severity === "error");
  }
}

/** Maps a range of raw text to the source. */
export type RawSpan = (range: { start: number; end: number }) => { start: number; end: number };

/** Reports where JSX implementations read a text or an attribute string differently (UF3009). */
export function reportDivergence(divergence: Divergence, at: RawSpan, reporter: Reporter): void {
  const span = at(divergence);
  const { replacement } = divergence;
  const title =
    replacement === " "
      ? "Write a space"
      : replacement === "\n"
        ? "Write a line break"
        : replacement === ""
          ? "Remove it"
          : `Write \`${replacement}\``;
  reporter.report("UF3009", span, divergence.message, {
    ...(divergence.help ? { help: divergence.help } : {}),
    ...(replacement === undefined
      ? {}
      : { fixes: [{ title, confidence: "likely", edits: [{ span, text: replacement }] }] }),
  });
}

/** Reports a character of a static value that HTML would not keep (UF3010). */
export function reportCharacter(
  character: UnportableCharacter,
  at: RawSpan,
  reporter: Reporter,
): void {
  const span = at(character);
  const { fix } = character;
  reporter.report("UF3010", span, character.message, {
    help: character.help,
    ...(fix
      ? { fixes: [{ title: fix.title, confidence: "safe", edits: [{ span, text: fix.text }] }] }
      : {}),
  });
}

/**
 * Reports a named reference only HTML decodes (UF3011). The fix writes its numeric reference,
 * and is offered only where the caller knows the change reveals and changes no other problem.
 */
export function reportHtmlOnlyReference(
  reference: HtmlOnlyReference,
  at: RawSpan,
  fixable: boolean,
  reporter: Reporter,
): void {
  const span = at(reference);
  const { name, numeric } = reference;
  const codePoints = reference.codePoints
    .map((code) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
  reporter.report(
    "UF3011",
    span,
    `\`&${name};\` is an HTML character reference, which JSX does not decode: every target renders it as the text \`&${name};\`.`,
    {
      help: `Write \`${numeric}\` for ${codePoints}, or \`&amp;${name};\` for the text itself.`,
      ...(fixable
        ? {
            fixes: [
              {
                title: `Write \`${numeric}\``,
                confidence: "likely",
                edits: [{ span, text: numeric }],
              },
            ],
          }
        : {}),
    },
  );
}
