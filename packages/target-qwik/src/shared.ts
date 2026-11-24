// Qwik's shared helper modules (ADR-0121): each helper of an emulated capability is one module in
// the output tree's `_unframework/` directory, and each output that uses it imports it by a
// relative path. Inside a module, every framework name is imported by its own name, so its text
// depends only on the helper (R1). A component imports a helper by the module's export name, or
// under the name the source leaves free (`nextTick as nextTick_1`), the same in every component of
// a source, so the unplugin's join writes one import (ADR-0053). Qwik's optimizer imports a helper
// that a `$()` closure calls into that closure's segment, as it does any module import.
//
// The directive runner and the `once` listeners' WeakSets keep per-file state (R2), and
// `exposeRef`, `toggle`, `selectedValues` and `rendered` are short and rare (R4): they stay
// inline. `restAttributes` stays inline until its sharing is decided.
import { hookQueueCode, ImportSet, js, printProgram } from "@unframework.dev/codegen";
import type { EmitContext } from "@unframework.dev/codegen";

import {
  modelTextHelper,
  nextTickHelper,
  scopeAttributesHelper,
  styleObjectHelper,
} from "./helpers.ts";
import { teleportHelper } from "./teleport.ts";
import { transitionHelpers } from "./transition.ts";

/** A shared module: its file in `_unframework/`, what it exports, and its text. */
interface SharedModule {
  file: string;
  /** The names a component imports from it, its types among them. */
  exports: readonly string[];
  /** The module's code after its imports, with its imports added to `imports`. */
  code(imports: ImportSet): string;
}

/**
 * Exports the declaration of `name` in a helper's code: `function nextTick(` →
 * `export function nextTick(`.
 */
function exported(code: string, ...names: string[]): string {
  return names.reduce(
    (text, name) =>
      text.replace(new RegExp(`^(function|interface|const) ${name}\\b`, "m"), `export $1 ${name}`),
    code,
  );
}

/**
 * Every module Qwik shares, by its name. The transition set is one module: its helpers share the
 * element-keyed `transitionStops`, which stays the module's own, and a component imports the ones
 * it calls. The teleport's `teleported` and `QWIK_CONTAINER` stay the module's own too.
 */
export const SHARED_MODULES: Readonly<Record<string, SharedModule>> = {
  scopeAttributes: {
    file: "scopeAttributes.ts",
    exports: ["scopeAttributes"],
    code: () => exported(scopeAttributesHelper("scopeAttributes"), "scopeAttributes"),
  },
  styleObject: {
    file: "styleObject.ts",
    exports: ["styleObject"],
    code: () => exported(styleObjectHelper("styleObject"), "styleObject"),
  },
  nextTick: {
    file: "nextTick.ts",
    exports: ["nextTick"],
    code: () => exported(nextTickHelper("nextTick"), "nextTick"),
  },
  // `TextModifiers` is exported for `modelText`'s declaration, which names it.
  modelText: {
    file: "modelText.ts",
    exports: ["modelText"],
    code: () =>
      exported(modelTextHelper("modelText", "TextModifiers"), "modelText", "TextModifiers"),
  },
  queueHook: {
    file: "queueHook.ts",
    exports: ["queueHook"],
    code: () => exported(hookQueueCode("queueHook"), "queueHook"),
  },
  teleport: {
    file: "teleport.ts",
    exports: ["teleport"],
    code: () =>
      exported(
        teleportHelper({
          mounted: "mounted",
          helper: "teleport",
          taken: "teleported",
          container: "QWIK_CONTAINER",
        }),
        "teleport",
      ),
  },
  transition: {
    file: "transition.ts",
    exports: ["transition", "runTransition", "stopTransition", "TransitionState"],
    code: (imports) =>
      exported(
        transitionHelpers(
          "transition",
          "runTransition",
          "TransitionState",
          "transitionStops",
          "stopTransition",
          imports.add("@qwik.dev/core/build", "isServer"),
        ),
        "transition",
        "runTransition",
        "stopTransition",
        "TransitionState",
      ),
  },
};

/** The names a component imports from a shared module that are types. */
const TYPES: ReadonlySet<string> = new Set(["TransitionState"]);

/** The module of each name a component imports, by the name. */
const MODULE_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(SHARED_MODULES).flatMap(([module, { exports }]) =>
    exports.map((name) => [name, module] as const),
  ),
);

/** Every name a component imports from a shared module, which the source's components share. */
export const SHARED_HELPER_NAMES: readonly string[] = [...MODULE_OF.keys()];

/** The text of a shared module: its imports, then its code. */
export function sharedModule(module: string): string {
  const imports = new ImportSet();
  const code = SHARED_MODULES[module]!.code(imports);
  const declarations = imports.toDeclarations();
  const head = declarations.length ? `${printProgram(js.program(declarations)).trim()}\n\n` : "";
  return `${head}${code}\n`;
}

/**
 * Puts the shared modules an output file uses through `helper`, and imports each name into
 * `imports` under its local name, the one the output claimed (`used`, by name).
 */
export function importShared(
  helper: NonNullable<EmitContext["helper"]>,
  from: string,
  imports: ImportSet,
  used: ReadonlyMap<string, string>,
): void {
  for (const [name, local] of used) {
    const module = MODULE_OF.get(name);
    if (module === undefined) throw new Error(`No shared module exports ${name}.`);
    // Qwik's outputs import a sibling by its name, without the extension.
    const path = helper(SHARED_MODULES[module]!.file, sharedModule(module), from).replace(
      /\.ts$/,
      "",
    );
    imports.add(path, name, { local, exact: true, type: TYPES.has(name) });
  }
}
