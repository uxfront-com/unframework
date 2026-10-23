// Imports that pass through (plan §4.4, ADR-0004, ADR-0064): an import whose specifier starts with
// one of the `passThrough` prefixes (`virtual:` by default, the modules a Vite plugin registers)
// reaches every output as written, and the plugin that registers the module resolves it. This is
// how a styling engine works, whatever the engine. Two forms pass through: named imports that a
// template only calls in a `class` (an engine's class functions), and a side-effect import (an
// engine's stylesheet or setup module). Any other use is UF5006: it would reach the targets
// unanalysed.
import {
  createPassThroughImport,
  createPassThroughName,
  isIdentifier,
  reservedSetupName,
} from "@unframework/ir";
import type { PassThroughImport, PassThroughName } from "@unframework/ir";
import { exportName } from "@unframework/parser";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";

/** The prefixes whose imports pass through when the options name none: Vite's virtual modules. */
export const DEFAULT_PASS_THROUGH: readonly string[] = ["virtual:"];

/** The module's pass-through imports, as its components' walks read them. */
export interface PassThrough {
  /**
   * The names a named pass-through import binds, by the identifier that declares each: its local
   * name, or `undefined` for one its import reported.
   */
  readonly names: ReadonlyMap<object, string | undefined>;
  /**
   * The identifiers that declare the names the module's code reads: a `class` part's call, or a
   * use reported as UF5006.
   */
  readonly read: Set<object>;
  /**
   * The names reported as named like a prop (UF2003), by the component's start and the name:
   * each once per component.
   */
  readonly clashes: Set<string>;
}

/** Whether a specifier starts with one of the prefixes whose imports pass through. */
export function isPassThroughSpecifier(specifier: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => specifier.startsWith(prefix));
}

/**
 * Checks an import that passes through, and lowers it into `imports` when nothing in it is
 * reported. The names it binds go into `names`, reported ones as `undefined`, so a read of them
 * is not reported again.
 */
export function passThroughImport(
  statement: AST.ImportDeclaration,
  reporter: Reporter,
  names: Map<object, string | undefined>,
  imports: PassThroughImport[],
): void {
  const specifier = statement.source.value;
  const at = { start: statement.start, end: statement.end };
  const help = `Import its class functions by name and call them in a \`class\`, as in \`import { button } from "${specifier}";\`, or import the module for its effect alone, as in \`import "${specifier}";\`.`;
  for (const item of statement.specifiers) names.set(item.local, undefined);
  if (statement.importKind === "type") {
    reporter.report(
      "UF5006",
      statement,
      `A type-only import of "${specifier}" names nothing a \`class\` calls, and no output keeps it.`,
      { help },
    );
    return;
  }
  const lowered: PassThroughName[] = [];
  const local = new Map<object, string>();
  for (const item of statement.specifiers) {
    if (item.type !== "ImportSpecifier" || item.importKind === "type") {
      reporter.report(
        "UF5006",
        item,
        item.type === "ImportNamespaceSpecifier"
          ? `A namespace import of "${specifier}" hides which name a \`class\` calls.`
          : item.type === "ImportDefaultSpecifier"
            ? `"${specifier}" is imported by the names a \`class\` calls, never by its default export.`
            : `A type-only name of "${specifier}" is nothing a \`class\` calls.`,
        { help },
      );
      continue;
    }
    const imported = exportName(item.imported);
    // A class function is exported under an identifier, never as the default export.
    if (!isIdentifier(imported) || imported === "default") {
      reporter.report(
        "UF5006",
        item.imported,
        imported === "default"
          ? `"${specifier}" is imported by the names a \`class\` calls, never by its default export.`
          : `"${imported}" is no identifier, which every output would have to import it under.`,
        { help },
      );
      continue;
    }
    // Every output declares the local name beside its own (ADR-0045's rules for a binding).
    const reserved = reservedSetupName(item.local.name);
    if (reserved) {
      reporter.report(
        "UF2003",
        item.local,
        `\`${item.local.name}\` cannot name an import that passes through: ${reserved}.`,
        {
          help: `Import it under another name, as in \`import { ${imported} as name } from "${specifier}";\`.`,
        },
      );
      continue;
    }
    lowered.push(
      createPassThroughName(imported, item.local.name, { start: item.start, end: item.end }),
    );
    local.set(item.local, item.local.name);
  }
  if (lowered.length !== statement.specifiers.length) return;
  for (const [declaration, name] of local) names.set(declaration, name);
  imports.push(createPassThroughImport(specifier, lowered, at));
}

/**
 * Reports each name a pass-through import binds and the module never reads (UF5006): its import
 * would reach every output unused. Returns whether it reported any.
 */
export function reportUnread(
  statements: readonly (AST.Directive | AST.Statement)[],
  passThrough: PassThrough,
  reporter: Reporter,
): boolean {
  let reported = false;
  for (const statement of statements) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const item of statement.specifiers) {
      const name = passThrough.names.get(item.local);
      if (name === undefined || passThrough.read.has(item.local)) continue;
      reporter.report(
        "UF5006",
        item,
        `\`${name}\` is imported from "${statement.source.value}", and no \`class\` calls it: every output would import it unused.`,
        { help: `Call it in a \`class\`, as in \`class={${name}()}\`, or remove the import.` },
      );
      reported = true;
    }
  }
  return reported;
}
