// Solid 2's shared helper modules (ADR-0121): each helper of an emulated capability that one text
// serves is one module in the output tree's `_unframework/` directory, and each output that uses
// it imports it by a relative path. Inside a module, every framework name is imported by its own
// name, so its text depends only on the helper (R1). A component imports a helper by the module's
// export name, or under the name the source leaves free (`queueHook as queueHook_1`), the same in
// every component of a source, so the unplugin's join writes one import (ADR-0053). A module that
// holds JSX is a `.tsx` file, which Solid's compiler transforms as it does a component.
import { hookQueueCode, ImportSet, js, printProgram } from "@unframework.dev/codegen";
import type { EmitContext } from "@unframework.dev/codegen";

import { nextTickHelperCode, refHelperCode, stateHelperCode } from "./helpers.ts";
import {
	classHelperCode,
	enumeratedHelperCode,
	keyedHelperCode,
	scopeHelperCode,
	styleHelperCode,
	transitionHelperCode,
} from "./jsx.ts";
import { modelTextHelperCode, selectOptionsHelperCode } from "./models.ts";
import { SHARED_HELPER_NAMES } from "./shared-names.ts";

/** A shared helper: its file in `_unframework/`, and the module's code given its imports. */
interface SharedHelper {
	file: string;
	/** The module's code after its imports, with its imports added to `imports`. */
	code(imports: ImportSet): string;
}

/**
 * Exports the declaration of `name` in a helper's code, each of its overloads too: `function cx(`
 * → `export function cx(`.
 */
function exported(code: string, name: string): string {
	return code.replaceAll(new RegExp(`^function ${name}\\b`, "gm"), `export function ${name}`);
}

const solid = (imports: ImportSet) => (name: string) => imports.add("solid-js", name);

/**
 * Every helper Solid 2 shares, by the name a component imports. `cx` is one module, the variant
 * that reads an array's entries too: every other class part is a string or an object by the
 * analyser's check (UF3018), so it joins them as before (R1's superset, as on React).
 */
export const SHARED_HELPERS: Readonly<Record<string, SharedHelper>> = {
	clearedRef: {
		file: "clearedRef.ts",
		code: (imports) =>
			exported(refHelperCode("clearedRef", solid(imports)("onCleanup")), "clearedRef"),
	},
	// The variant without watchers: a file that has them keeps its own, whose write requests their
	// flush (R1).
	createState: {
		file: "createState.ts",
		code: (imports) =>
			exported(
				stateHelperCode("createState", {
					createSignal: solid(imports)("createSignal"),
					getObserver: solid(imports)("getObserver"),
				}),
				"createState",
			),
	},
	cx: { file: "cx.ts", code: () => exported(classHelperCode("cx", true), "cx") },
	enumeratedValue: {
		file: "enumeratedValue.ts",
		code: () => exported(enumeratedHelperCode("enumeratedValue"), "enumeratedValue"),
	},
	KeyedFor: {
		file: "KeyedFor.tsx",
		code: (imports) => exported(keyedHelperCode("KeyedFor", imports), "KeyedFor"),
	},
	modelText: {
		file: "modelText.ts",
		code: (imports) =>
			exported(modelTextHelperCode("modelText", solid(imports)("createRenderEffect")), "modelText"),
	},
	nextTick: {
		file: "nextTick.ts",
		code: () => exported(nextTickHelperCode("nextTick"), "nextTick"),
	},
	queueHook: {
		file: "queueHook.ts",
		code: () => exported(hookQueueCode("queueHook"), "queueHook"),
	},
	scopeAttributes: {
		file: "scopeAttributes.ts",
		code: () => exported(scopeHelperCode("scopeAttributes"), "scopeAttributes"),
	},
	selectOptions: {
		file: "selectOptions.ts",
		code: (imports) =>
			exported(
				selectOptionsHelperCode("selectOptions", {
					createEffect: solid(imports)("createEffect"),
					onCleanup: solid(imports)("onCleanup"),
				}),
				"selectOptions",
			),
	},
	styleProperties: {
		file: "styleProperties.ts",
		code: () => exported(styleHelperCode("styleProperties"), "styleProperties"),
	},
	Transition: {
		file: "Transition.tsx",
		code: (imports) => exported(transitionHelperCode("Transition", imports), "Transition"),
	},
};

// Each name the emit treats as shared has a module, and only those.
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
 * each into `imports` under its local name, the one the file claimed.
 */
export function importShared(
	helper: NonNullable<EmitContext["helper"]>,
	from: string,
	imports: ImportSet,
	used: ReadonlyMap<string, string>,
): void {
	for (const [name, local] of used) {
		// Solid's outputs import a sibling by its name, without the extension.
		const path = helper(SHARED_HELPERS[name]!.file, sharedModule(name), from);
		imports.add(path.replace(/\.tsx?$/, ""), name, { local, exact: true });
	}
}
