import { docsUrl } from "./catalogue.ts";
import { LineIndex } from "./location.ts";
import type { Diagnostic, Span } from "./types.ts";

/** Options for {@link formatDiagnostic}. */
export interface FormatOptions {
  /** Colours the output with ANSI escapes. Defaults to `false`, so output is stable. */
  color?: boolean;
  /** Prints the documentation link. Defaults to `true`. */
  docs?: boolean;
}

const styles = {
  error: "\u001B[1;31m",
  warning: "\u001B[1;33m",
  info: "\u001B[1;36m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  reset: "\u001B[0m",
} as const;

/**
 * Renders a diagnostic as a code frame for people:
 *
 * ```text
 * error[UF1201]: "react" is a React module, and components are framework-free.
 *  --> Widget.uf.tsx:1:26
 *   |
 * 1 | import { useState } from "react";
 *   |                          ^^^^^^^
 *   |
 *   = help: Write the component with the authoring API from "unframework".
 *   = see: https://unframework.dev/diagnostics/UF1201
 * ```
 */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string | undefined,
  options: FormatOptions = {},
): string {
  const paint = (style: keyof typeof styles, text: string) =>
    options.color ? `${styles[style]}${text}${styles.reset}` : text;
  const index = source === undefined ? undefined : new LineIndex(source);
  const start = index?.position(diagnostic.span.start);
  const target = diagnostic.target ? ` (${diagnostic.target})` : "";
  const header = `${paint(diagnostic.severity, `${diagnostic.severity}[${diagnostic.code}]`)}${paint("bold", `${target}: ${diagnostic.message}`)}`;
  const location = start ? `${diagnostic.file}:${start.line}:${start.column}` : diagnostic.file;

  const frames: { span: Span; label: string | undefined }[] = [
    { span: diagnostic.span, label: undefined },
    ...(diagnostic.related ?? []).map((related) => ({
      span: related.span,
      label: related.message,
    })),
  ];
  const lines = index ? frames.map((frame) => frameLines(index, frame.span, frame.label)) : [];
  const gutterWidth = Math.max(
    1,
    ...lines.flat().map((line) => (line.number === undefined ? 0 : String(line.number).length)),
  );
  const gutter = (number?: number) =>
    paint("dim", `${(number === undefined ? "" : String(number)).padStart(gutterWidth)} |`);
  const pad = " ".repeat(gutterWidth);

  const output = [header, `${pad}${paint("dim", "-->")} ${location}`];
  for (const frame of lines) {
    output.push(gutter());
    for (const line of frame) {
      output.push(line.text ? `${gutter(line.number)} ${line.text}` : gutter(line.number));
    }
  }
  if (lines.length) output.push(gutter());
  if (diagnostic.help) output.push(`${pad} = ${paint("bold", "help")}: ${diagnostic.help}`);
  for (const fix of diagnostic.fixes ?? []) {
    output.push(`${pad} = ${paint("bold", `fix (${fix.confidence})`)}: ${fix.title}`);
  }
  if (options.docs !== false) output.push(`${pad} = see: ${docsUrl(diagnostic.code)}`);
  return output.join("\n");
}

/** Renders several diagnostics, separated by blank lines. */
export function formatDiagnostics(
  diagnostics: readonly Diagnostic[],
  sources: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
  options: FormatOptions = {},
): string {
  // Own keys only: a file named `constructor` has no source on the prototype.
  const sourceOf = (file: string) =>
    sources instanceof Map
      ? sources.get(file)
      : Object.hasOwn(sources, file)
        ? (sources as Record<string, string>)[file]
        : undefined;
  return diagnostics
    .map((diagnostic) => formatDiagnostic(diagnostic, sourceOf(diagnostic.file), options))
    .join("\n\n");
}

interface FrameLine {
  number: number | undefined;
  text: string;
}

/** The source line of a span and a caret line under it; multi-line spans show both ends. */
function frameLines(index: LineIndex, span: Span, label: string | undefined): FrameLine[] {
  const start = index.position(span.start);
  const end = index.position(Math.max(span.start, span.end));
  const first = index.line(start.line);
  const lines: FrameLine[] = [{ number: start.line, text: first }];
  const caretEnd = start.line === end.line ? end.column : first.length + 1;
  const width = Math.max(1, caretEnd - start.column);
  const indent = first.slice(0, start.column - 1).replace(/[^\t]/g, " ");
  lines.push({
    number: undefined,
    text: `${indent}${"^".repeat(width)}${label ? ` ${label}` : ""}`,
  });
  if (end.line > start.line) {
    const last = index.line(end.line);
    if (end.line > start.line + 1) lines.push({ number: undefined, text: "..." });
    lines.push({ number: end.line, text: last });
    const covered = last.slice(0, end.column - 1);
    if (covered) lines.push({ number: undefined, text: covered.replace(/[^\t]/g, "^") });
  }
  return lines;
}
