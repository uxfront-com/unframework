// React's shared helper modules (ADR-0121): each helper of an emulated capability is one module in
// the output tree's `_unframework/` directory, and each output that uses it imports it by a
// relative path. Inside a module, every framework name is imported by its own name, so its text
// depends only on the helper (R1). A component imports a helper by the module's export name, or
// under the name the source leaves free (`cx as cx_1`), the same in every component of a source,
// so the unplugin's join writes one import (ADR-0053). `refObject` and `toggle` stay inline (R4).
import { hookQueueCode, ImportSet, js, printProgram } from "@unframework.dev/codegen";
import type { EmitContext } from "@unframework.dev/codegen";

import { setupPendingHelper } from "./async.ts";
import { cxHelper, styleObjectHelper } from "./dialect.ts";
import { mergeRefsHelper, useDirectiveHelper } from "./directive.ts";
import {
  listenHelper,
  modelTextHelper,
  nextTickHelper,
  onceHelper,
  scopeAttributesHelper,
} from "./helpers.ts";
import { SHARED_HELPER_NAMES } from "./shared-names.ts";
import { teleportHelper } from "./teleport.ts";
import { transitionHelpers } from "./transition.ts";

/** A shared helper: its file in `_unframework/`, and the module's text given its imports. */
interface SharedHelper {
  file: string;
  /** The module's code after its imports, with its imports added to `imports`. */
  code(imports: ImportSet): string;
}

/** Exports the declaration of `name` in a helper's code: `function cx(` → `export function cx(`. */
function exported(code: string, name: string): string {
  return code.replace(new RegExp(`^(function|interface) ${name}\\b`, "m"), "export $1 " + name);
}

/** Imports a sibling helper module, `./queueHook`, as a helper module imports another (A1). */
function sibling(imports: ImportSet, name: string): string {
  return imports.add(`./${name}`, name);
}

const react = (imports: ImportSet) => (name: string) => imports.add("react", name);
const reactType = (imports: ImportSet) => (name: string) =>
  imports.add("react", name, { type: true });

/**
 * Every helper React shares, by the name a component imports. `cx` is one module, the variant
 * that reads an array's entries too: every other class part is a string or an object by the
 * analyser's check (UF3018), so it joins them as before (R1's superset).
 */
export const SHARED_HELPERS: Readonly<Record<string, SharedHelper>> = {
  cx: { file: "cx.ts", code: () => exported(cxHelper("cx", true), "cx") },
  styleObject: {
    file: "styleObject.ts",
    code: (imports) =>
      exported(
        styleObjectHelper("styleObject", reactType(imports)("CSSProperties")),
        "styleObject",
      ),
  },
  listen: { file: "listen.ts", code: () => exported(listenHelper("listen"), "listen") },
  useOnce: {
    file: "useOnce.ts",
    code: (imports) => exported(onceHelper("useOnce", react(imports)("useRef")), "useOnce"),
  },
  useNextTick: {
    file: "useNextTick.ts",
    code: (imports) =>
      exported(
        nextTickHelper("useNextTick", {
          useRef: react(imports)("useRef"),
          useReducer: react(imports)("useReducer"),
          useEffect: react(imports)("useEffect"),
        }),
        "useNextTick",
      ),
  },
  useModelText: {
    file: "useModelText.ts",
    code: (imports) =>
      exported(
        modelTextHelper("useModelText", {
          useState: react(imports)("useState"),
          ChangeEvent: reactType(imports)("ChangeEvent"),
          looseToNumber: "looseToNumber",
        }),
        "useModelText",
      ),
  },
  scopeAttributes: {
    file: "scopeAttributes.ts",
    code: () => exported(scopeAttributesHelper("scopeAttributes"), "scopeAttributes"),
  },
  queueHook: {
    file: "queueHook.ts",
    code: () => exported(hookQueueCode("queueHook"), "queueHook"),
  },
  useDirective: {
    file: "useDirective.ts",
    code: (imports) =>
      exported(
        exported(
          useDirectiveHelper(
            { hook: "useDirective", hooks: "DirectiveHooks", queue: sibling(imports, "queueHook") },
            imports,
          ),
          "DirectiveHooks",
        ),
        "useDirective",
      ),
  },
  useElementDirective: {
    file: "useElementDirective.ts",
    code: (imports) =>
      exported(
        exported(
          useDirectiveHelper(
            {
              each: "useElementDirective",
              hooks: "DirectiveHooks",
              queue: sibling(imports, "queueHook"),
            },
            imports,
          ),
          "DirectiveHooks",
        ),
        "useElementDirective",
      ),
  },
  mergeRefs: {
    file: "mergeRefs.ts",
    code: (imports) =>
      exported(
        mergeRefsHelper("mergeRefs", {
          Ref: reactType(imports)("Ref"),
          RefCallback: reactType(imports)("RefCallback"),
        }),
        "mergeRefs",
      ),
  },
  SetupPending: {
    file: "SetupPending.ts",
    code: (imports) =>
      exported(setupPendingHelper("SetupPending", react(imports)("useEffect")), "SetupPending"),
  },
  subscribeNothing: {
    file: "subscribeNothing.ts",
    code: () => `/**
 * Subscribes to nothing, for \`useSyncExternalStore\`: whether a component renders on a client,
 * and whether it has mounted, never change once they are true.
 */
export function subscribeNothing(): () => void {
  return () => {};
}`,
  },
  teleport: {
    file: "teleport.ts",
    code: (imports) => exported(teleportHelper("teleport", imports), "teleport"),
  },
  Transition: {
    file: "Transition.tsx",
    code: (imports) =>
      exported(
        transitionHelpers(
          {
            component: "Transition",
            item: "TransitionItem",
            entry: "TransitionEntry",
            attach: "attachRef",
            subscribe: sibling(imports, "subscribeNothing"),
          },
          imports,
          false,
        ).join("\n\n"),
        "Transition",
      ),
  },
};

/** The helpers each shared helper's module imports. */
const DEPENDENCIES: Readonly<Record<string, ReadonlyArray<string>>> = {
  useDirective: ["queueHook"],
  useElementDirective: ["queueHook"],
  Transition: ["subscribeNothing"],
};

// Each name the plan treats as shared has a module, and only those.
if (Object.keys(SHARED_HELPERS).join() !== SHARED_HELPER_NAMES.join()) {
  throw new Error("SHARED_HELPERS and SHARED_HELPER_NAMES name different helpers.");
}

/** The text of a shared helper's module: its imports, then its code. */
export function sharedModule(name: string): string {
  const helper = SHARED_HELPERS[name]!;
  const imports = new ImportSet();
  const code = helper.code(imports);
  const declarations = imports.toDeclarations();
  const head = declarations.length ? `${printProgram(js.program(declarations)).trim()}\n\n` : "";
  return `${head}${code}\n`;
}

/**
 * Puts the shared helpers an output file uses in their modules, through `helper`, and imports
 * each into `imports` under its local name, the one the component claimed.
 */
export function importShared(
  helper: NonNullable<EmitContext["helper"]>,
  from: string,
  imports: ImportSet,
  used: ReadonlyMap<string, string>,
): void {
  const put = (name: string): string => {
    for (const dependency of DEPENDENCIES[name] ?? []) {
      put(dependency);
    }
    const path = helper(SHARED_HELPERS[name]!.file, sharedModule(name), from);
    // React's outputs import a sibling by its name, without the extension.
    return path.replace(/\.tsx?$/, "");
  };
  for (const [name, local] of used) {
    imports.add(put(name), name, { local, exact: true });
  }
}
