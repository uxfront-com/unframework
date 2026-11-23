// L5 for Ember (ADR-0042): ESLint with eslint-plugin-ember over each `.gts` file, its class and
// its template, and oxlint's shared baseline over its code. Oxlint does not read `.gts`, so it
// reads a copy of each one whose `<template>`s are blanked, every line and column in its place.
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ToolchainContext, ToolchainMessage } from "@unframework.dev/codegen";
import {
  lintWithEslint,
  lintWithOxlint,
  mergeLintResults,
} from "@unframework.dev/codegen/toolchain-node";

/**
 * Oxlint's unused-variable rule cannot see the template's reads of the module's names, as it
 * cannot in a `.vue` script. typescript-eslint's runs in ESLint instead, where
 * ember-eslint-parser counts those reads.
 */
const TEMPLATE_BLIND = new Set(["no-unused-vars"]);

/** Lints `.gts` files with ESLint and oxlint, and any other file with oxlint alone. */
export async function lint(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  const components = files.filter((file) => file.endsWith(".gts"));
  const modules = files.filter((file) => !file.endsWith(".gts"));
  return mergeLintResults(
    await Promise.all([
      ...(components.length ? [lintWithEslint(components, context)] : []),
      ...(components.length ? [lintScripts(components, context)] : []),
      ...(modules.length ? [lintWithOxlint(modules, context)] : []),
    ]),
  );
}

/** Oxlint's baseline over each `.gts` file's code, reported against the file itself. */
async function lintScripts(
  files: readonly string[],
  context: ToolchainContext,
): Promise<Map<string, ToolchainMessage[]>> {
  const { Preprocessor } = await import("content-tag");
  const preprocessor = new Preprocessor();
  const directory = mkdtempSync(join(realpathSync(context.root), ".uf-ember-lint-"));
  try {
    const copies = files.map((file, index) => {
      const copy = join(directory, `${index}.ts`);
      writeFileSync(copy, blankTemplates(preprocessor, readFileSync(file, "utf8")));
      return copy;
    });
    const results = await lintWithOxlint(copies, context);
    return new Map(
      files.map((file, index) => [
        file,
        (results.get(copies[index]!) ?? []).filter(
          (message) => message.code === undefined || !TEMPLATE_BLIND.has(message.code),
        ),
      ]),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** What comes before a `<template>` that is a statement of its own: the module's default export. */
const STATEMENT_START = /(?:^|[;}])\s*$/;

/**
 * A `.gts` module's code with each `<template>` in its place replaced by code of the same
 * shape: a class member's by a static block, an expression's by `0`, and a statement's by the
 * default export it compiles to. The stand-in takes the template's first line, and the rest of
 * the template becomes spaces with its line breaks kept, so the code's lines and columns are
 * the file's own.
 */
export function blankTemplates(
  preprocessor: { parse(source: string): readonly TemplatePart[] },
  contents: string,
): string {
  let code = "";
  let last = 0;
  for (const { type, range } of preprocessor.parse(contents)) {
    const start = range.startUtf16Codepoint;
    const end = range.endUtf16Codepoint;
    const stand =
      type === "class-member"
        ? "static { void 0; }"
        : STATEMENT_START.test(contents.slice(0, start))
          ? "export default 0"
          : "0";
    const template = contents.slice(start, end);
    const lineEnd = template.includes("\n") ? template.indexOf("\n") : template.length;
    code += contents.slice(last, start) + stand.padEnd(lineEnd);
    code += template.slice(lineEnd).replace(/[^\n]/g, " ");
    last = end;
  }
  return code + contents.slice(last);
}

/** What content-tag's `parse` reports of a `<template>`: where it is, and what it stands for. */
interface TemplatePart {
  type: "expression" | "class-member";
  range: { startUtf16Codepoint: number; endUtf16Codepoint: number };
}
