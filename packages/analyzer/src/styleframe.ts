// Styleframe's imports (plan §4.4, ADR-0004, ADR-0064): every output keeps them as written, and
// Styleframe's own plugin resolves them. Two forms pass through: named imports of recipes from
// `virtual:styleframe`, which a template only calls in a `class`, and the side-effect import of
// Styleframe's stylesheet, `virtual:styleframe.css`. Any other import of a `virtual:styleframe`
// module, or another use of a name it binds, is UF5006: it would reach the targets unanalysed.
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

const RECIPES = "virtual:styleframe";
const STYLESHEET = "virtual:styleframe.css";

/** The module's Styleframe imports, as its components' walks read them. */
export interface Styleframe {
  /**
   * The names a recipe import binds, by the identifier that declares each: its local name, or
   * `undefined` for one its import reported.
   */
  readonly names: ReadonlyMap<object, string | undefined>;
  /**
   * The identifiers that declare the names the module's code reads: a `class` part's call, or a
   * use reported as UF5006.
   */
  readonly read: Set<object>;
}

/** Whether a specifier names one of Styleframe's virtual modules. */
export function isStyleframeSpecifier(specifier: string): boolean {
  return specifier.startsWith(RECIPES);
}

/**
 * Checks an import of a Styleframe module, and lowers it into `imports` when it passes through.
 * The names it binds go into `names`, reported ones as `undefined`, so a read of them is not
 * reported again.
 */
export function styleframeImport(
  statement: AST.ImportDeclaration,
  reporter: Reporter,
  names: Map<object, string | undefined>,
  imports: PassThroughImport[],
): void {
  const specifier = statement.source.value;
  const at = { start: statement.start, end: statement.end };
  for (const item of statement.specifiers) names.set(item.local, undefined);
  if (specifier === STYLESHEET) {
    if (statement.importKind === "type" || statement.specifiers.length) {
      reporter.report(
        "UF5006",
        statement,
        `"${STYLESHEET}" is Styleframe's stylesheet, which a component imports for its effect alone.`,
        { help: `Import it as \`import "${STYLESHEET}";\`.` },
      );
      return;
    }
    imports.push(createPassThroughImport(STYLESHEET, [], at));
    return;
  }
  if (specifier !== RECIPES) {
    reporter.report(
      "UF5006",
      statement.source,
      `"${specifier}" is not a module the compiler passes through: it passes through "${RECIPES}" and "${STYLESHEET}" only.`,
      {
        help: `Import recipes by name from "${RECIPES}", or Styleframe's stylesheet as \`import "${STYLESHEET}";\`.`,
      },
    );
    return;
  }
  if (statement.importKind === "type" || !statement.specifiers.length) {
    reporter.report(
      "UF5006",
      statement,
      statement.importKind === "type"
        ? `A type-only import of "${RECIPES}" names no recipe a \`class\` calls.`
        : `\`import "${RECIPES}"\` imports no recipe: a component imports Styleframe's recipes by name.`,
      { help: `Import each recipe by name, as in \`import { button } from "${RECIPES}";\`.` },
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
          ? `A namespace import of "${RECIPES}" hides which recipe a \`class\` calls.`
          : item.type === "ImportDefaultSpecifier"
            ? `"${RECIPES}" is imported by its recipes' names: its default export is no recipe.`
            : `A type-only name of "${RECIPES}" is no recipe a \`class\` calls.`,
        { help: `Import each recipe by name, as in \`import { button } from "${RECIPES}";\`.` },
      );
      continue;
    }
    const imported = exportName(item.imported);
    // A recipe is exported under an identifier, and Styleframe's module has no default export.
    if (!isIdentifier(imported) || imported === "default") {
      reporter.report(
        "UF5006",
        item.imported,
        imported === "default"
          ? `"${RECIPES}" is imported by its recipes' names: its default export is no recipe.`
          : `"${imported}" names no recipe: Styleframe exports each recipe under an identifier.`,
        { help: `Import each recipe by name, as in \`import { button } from "${RECIPES}";\`.` },
      );
      continue;
    }
    // Every output declares the local name beside its own (ADR-0045's rules for a binding).
    const reserved = reservedSetupName(item.local.name);
    if (reserved) {
      reporter.report(
        "UF2003",
        item.local,
        `\`${item.local.name}\` cannot name a recipe: ${reserved}.`,
        {
          help: `Import it under another name, as in \`import { ${imported} as recipe } from "${RECIPES}";\`.`,
        },
      );
      continue;
    }
    lowered.push(
      createPassThroughName(imported, item.local.name, {
        start: item.start,
        end: item.end,
      }),
    );
    local.set(item.local, item.local.name);
  }
  if (lowered.length !== statement.specifiers.length) return;
  for (const [declaration, name] of local) names.set(declaration, name);
  imports.push(createPassThroughImport(RECIPES, lowered, at));
}

/**
 * Reports each recipe a module imports and never reads (UF5006): its import would reach every
 * output unused. Returns whether it reported any.
 */
export function reportUncalled(
  statements: readonly (AST.Directive | AST.Statement)[],
  styleframe: Styleframe,
  reporter: Reporter,
): boolean {
  let reported = false;
  for (const statement of statements) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const item of statement.specifiers) {
      const name = styleframe.names.get(item.local);
      if (name === undefined || styleframe.read.has(item.local)) continue;
      reporter.report(
        "UF5006",
        item,
        `\`${name}\` is imported from "${RECIPES}", and no \`class\` calls it: every output would import it unused.`,
        { help: `Call it in a \`class\`, as in \`class={${name}()}\`, or remove the import.` },
      );
      reported = true;
    }
  }
  return reported;
}
