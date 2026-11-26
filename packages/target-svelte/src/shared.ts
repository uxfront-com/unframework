// Svelte's shared helper modules (ADR-0121): each helper of an emulated capability is one module
// in the output tree's `_unframework/` directory, and each component that uses it imports it from
// its instance script by a relative path. Inside a module, every framework name is imported by its
// own name, so its text depends only on the helper (R1). `refObject` stays inline (R4), and so
// does the fallthrough helper `restAttributes`, which the plan of UXF-982 decides on.
import type { EmitContext } from "@unframework.dev/codegen";

import {
	mergeStyleHelper,
	modelTextHelper,
	onceHelper,
	scopeAttributesHelper,
	styleTextHelper,
	teleportHelper,
	transitionHelpers,
} from "./script.ts";
import type { SharedHelper } from "./script.ts";

/** Exports the declaration of `name` in a helper's code: `function once<` → `export function once<`. */
function exported(code: string, name: string): string {
	return code.replace(new RegExp(`^function ${name}\\b`, "m"), `export function ${name}`);
}

/**
 * Every module Svelte shares, by the helper a component imports: its file in `_unframework/`, and
 * its text. `modelText` calls `$effect`, which Svelte allows only in a component or a `.svelte.ts`
 * module, so its module is one. The transition set is one module, `transition.ts`, which exports
 * `enter` and `leave` and keeps what they share to itself: a component imports the phases its
 * markup runs (R1's superset). Its `WeakMap` is keyed by element, and only one component's `in:`
 * and `out:` reach an element, so sharing it gives no component another's entries (R2).
 */
const MODULES: Readonly<Record<SharedHelper, { file: string; code: string }>> = {
	once: { file: "once.ts", code: exported(onceHelper("once"), "once") },
	modelText: {
		file: "modelText.svelte.ts",
		code: `import { on } from "svelte/events";\n\n${exported(modelTextHelper("modelText", "on"), "modelText")}`,
	},
	mergeStyle: {
		file: "mergeStyle.ts",
		code: exported(mergeStyleHelper("mergeStyle"), "mergeStyle"),
	},
	styleText: { file: "styleText.ts", code: exported(styleTextHelper("styleText"), "styleText") },
	scopeAttributes: {
		file: "scopeAttributes.ts",
		code: exported(scopeAttributesHelper("scopeAttributes"), "scopeAttributes"),
	},
	teleport: { file: "teleport.ts", code: exported(teleportHelper("teleport"), "teleport") },
	enter: { file: "transition.ts", code: transitionModule() },
	leave: { file: "transition.ts", code: transitionModule() },
};

/** The transition module's text: both phases, exported, over the classes and runs they share. */
function transitionModule(): string {
	const code = transitionHelpers({
		enter: "enter",
		leave: "leave",
		classes: "transitionClasses",
		runs: "transitionRuns",
		config: "TransitionConfig",
	}).join("\n\n");
	return `import type { TransitionConfig } from "svelte/transition";\n\n${exported(exported(code, "enter"), "leave")}`;
}

/**
 * Puts a shared helper in its module through `helper`, for the output at `from`, and gives the
 * specifier its instance script imports it by: without `.ts`, as Svelte imports a `.ts` module,
 * so `modelText.svelte.ts` is `./_unframework/modelText.svelte`, as a composable's module is.
 */
export function sharedHelper(
	helper: NonNullable<EmitContext["helper"]>,
	from: string,
): (name: SharedHelper) => string {
	return (name) => {
		const { file, code } = MODULES[name];
		return helper(file, `${code}\n`, from).replace(/\.ts$/, "");
	};
}
