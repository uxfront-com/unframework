// Angular's shared helper modules (ADR-0121): each helper of an emulated capability that passes
// R1 to R4 is one module in the output tree's `_unframework/` directory, and each output that uses
// it imports it by a relative path and lists a directive or a pipe in its `imports`, as ngtsc's
// type-check needs (NG3004). Inside a module, every framework name is imported by its own name,
// so its text depends only on the helper (R1, A2). A component imports a helper by the module's
// export name, or under the name the source leaves free (`ScopeAttributes as ScopeAttributes_1`),
// the same in every component of a source, so the unplugin's join writes one import (A3,
// ADR-0053). `Transition` and `TransitionRegion` stay inline: `inject(TransitionRegion)` looks
// through every ancestor's injector, across component hosts, so one shared class would let a
// child's transition find its parent's region (R2). So do the directive runner, `Teleport`,
// `idCounter`, `nextTick`, the once-guard, `Fallthrough` and the short model helpers (R2 to R4).
import { hookQueueCode, ImportSet, js, Placeholders, printProgram } from "@unframework.dev/codegen";
import type { EmitContext } from "@unframework.dev/codegen";

import {
  directiveCode,
  scopeDirectiveCode,
  spaced,
  textCaretDirectiveCode,
  trustedHtmlPipeCode,
} from "./directives.ts";
import type { DirectiveSpec } from "./directives.ts";
import { modelHelperCode } from "./models.ts";

/**
 * A shared helper: its module's code after its imports, which it adds to `imports`, or a function
 * that prints that code once the placeholders it made can be printed.
 */
type ModuleCode = (imports: ImportSet, placeholders: Placeholders) => string | (() => string);

/** Exports the declaration of `name`: `function styleObject(` → `export function styleObject(`. */
function exported(code: string, name: string): string {
  return code.replace(new RegExp(`^(function|class) ${name}\\b`, "m"), "export $1 " + name);
}

/** Imports a sibling helper module, `./looseToNumber`, as a helper module imports another (A1). */
function sibling(imports: ImportSet, name: string): string {
  return imports.add(`./${name}`, name, { exact: true });
}

/** The helpers each shared helper's module imports. */
const DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  modelText: ["looseToNumber"],
  writeModelText: ["looseToNumber"],
};

/**
 * Every helper Angular shares by a fixed name, the module's export name. The event directives
 * are shared too, one module per event and option (`ClickCapture.ts`), named by
 * {@link directiveModule}.
 */
const SHARED_HELPERS: Readonly<Record<string, ModuleCode>> = {
  // `scopes` stays the module's own: only the directive's `ngOnInit` reads and writes it, keyed by
  // its component's host, so sharing the map changes no lookup (R2).
  ScopeAttributes: (imports) =>
    scopeDirectiveCode({ className: "ScopeAttributes", scopes: "scopes" }, imports),
  TextCaret: (imports) => textCaretDirectiveCode("TextCaret", imports),
  TrustedHtmlPipe: (imports) =>
    exported(trustedHtmlPipeCode("TrustedHtmlPipe", imports), "TrustedHtmlPipe"),
  queueHook: () => exported(hookQueueCode("queueHook"), "queueHook"),
  styleObject: () => exported(modelHelperCode("styleObject", "styleObject"), "styleObject"),
  looseToNumber: () => exported(modelHelperCode("looseToNumber", "looseToNumber"), "looseToNumber"),
  modelText: (imports) =>
    exported(
      modelHelperCode("modelText", "modelText", sibling(imports, "looseToNumber")),
      "modelText",
    ),
  writeModelText: (imports) => {
    imports.add("@angular/core", "WritableSignal", { type: true });
    return exported(
      modelHelperCode("writeModelText", "writeModelText", sibling(imports, "looseToNumber")),
      "writeModelText",
    );
  },
};

/** The names of the helpers Angular shares by a fixed name. */
export const SHARED_HELPER_NAMES: readonly string[] = Object.keys(SHARED_HELPERS);

/** The text of a module: its imports, then its code. */
function moduleText(code: ModuleCode): string {
  const imports = new ImportSet();
  const placeholders = new Placeholders();
  const built = code(imports, placeholders);
  return placeholders.print(() => {
    const body = (typeof built === "string" ? built : built()).trim();
    const declarations = imports.toDeclarations();
    const head = declarations.length ? `${printProgram(js.program(declarations)).trim()}\n\n` : "";
    return `${head}${body}\n`;
  });
}

/** The text of a shared helper's module, by its export name. */
export function sharedModule(name: string): string {
  return moduleText(SHARED_HELPERS[name]!);
}

/** The module of the directive that listens to one event with one option, `ClickCapture.ts`. */
export function directiveModule(spec: DirectiveSpec): string {
  return moduleText((imports, placeholders) => {
    const { decorator, statements } = directiveCode(
      { ...spec, className: spec.name },
      imports,
      placeholders,
    );
    return () => `${decorator}\n${spaced(printProgram(js.program(statements)))}`;
  });
}

/** A shared helper an output file uses: its export name, its local name and its module. */
export interface SharedUse {
  name: string;
  local: string;
  /** The module's text, for a helper of no fixed name (an event directive). */
  contents?: string;
}

/**
 * Puts the shared helpers an output file uses in their modules, through `helper`, and imports
 * each into `imports` under its local name, the one the plan claimed.
 */
export function importShared(
  helper: NonNullable<EmitContext["helper"]>,
  from: string,
  imports: ImportSet,
  used: Iterable<SharedUse>,
): void {
  const put = (name: string, contents = sharedModule(name)): string => {
    for (const dependency of DEPENDENCIES[name] ?? []) put(dependency);
    // Angular's outputs import a sibling by its name, without the extension (`./card-icon`).
    return helper(`${name}.ts`, contents, from).replace(/\.ts$/, "");
  };
  for (const { name, local, contents } of used) {
    imports.add(put(name, contents), name, { local, exact: true });
  }
}
