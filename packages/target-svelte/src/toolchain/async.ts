// Which Svelte files compile under the `experimental.async` compiler option (ADR-0101): a
// component whose instance script awaits at its top level, as an async setup's output does.
// Svelte has no `<svelte:options>` key for the option, and a module compiled with it turns on a
// page-global runtime flag that changes `tick()` and batching, so the toolchain sets it per file:
// a page that loads no async component runs as it did.
import type { AST, CompileOptions } from "svelte/compiler";
import type * as SvelteCompilerModule from "svelte/compiler";

type Parse = (typeof SvelteCompilerModule)["parse"];

/** The functions whose bodies run later, where an `await` is the function's own. */
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

/**
 * Whether a component's instance script awaits outside any function: an `await` expression or a
 * `for await`. A file that does not parse is left to the compiler, which reports why.
 */
export function awaitsAtTop(parse: Parse, code: string): boolean {
	// Most files hold no `await` at all: no parse for them.
	if (!code.includes("await")) {
		return false;
	}
	let root: AST.Root;
	try {
		root = parse(code, { modern: true });
	} catch {
		return false;
	}
	return root.instance ? holdsAwait(root.instance.content) : false;
}

/** The compiler options one component adds: `experimental.async` where it awaits at its top. */
export function componentOptions(parse: Parse, code: string): Partial<CompileOptions> {
	return awaitsAtTop(parse, code) ? { experimental: { async: true } } : {};
}

/** Whether an ESTree node holds an `await` its own scope runs, outside any nested function. */
function holdsAwait(node: unknown): boolean {
	if (Array.isArray(node)) {
		return node.some(holdsAwait);
	}
	if (typeof node !== "object" || node === null) {
		return false;
	}
	const { type } = node as { type?: unknown };
	if (typeof type !== "string") {
		return false;
	}
	if (type === "AwaitExpression") {
		return true;
	}
	if (type === "ForOfStatement" && (node as { await?: boolean }).await) {
		return true;
	}
	if (FUNCTIONS.has(type)) {
		return false;
	}
	return Object.entries(node).some(
		([key, value]) => key !== "metadata" && typeof value === "object" && holdsAwait(value),
	);
}
