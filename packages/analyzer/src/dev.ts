// `isDev` (ADR-0117): code that runs only in a development build. It is read in one form, the
// whole test of an `if` with no `else`, at the top level of the setup or in client code, where
// each target writes its framework's own check in its place. Any other read is UF2040.

import type { AST } from "@unframework.dev/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { Reporter } from "./context.ts";
import type { Scopes } from "./scope.ts";
import { visit } from "./shapes.ts";

/** What resolves a name to its declaration, and the authoring API an import declares. */
interface DevScope {
	readonly scopes: Scopes;
	readonly authoring: ReadonlyMap<object, AuthoringApi | undefined>;
}

/** Whether an identifier is `isDev`, by the binding its import declares (ADR-0006). */
export function isDevIdentifier(node: AST.IdentifierReference, scope: DevScope): boolean {
	const resolution = scope.scopes.resolve(node);
	return resolution.kind === "import" && scope.authoring.get(resolution.declaration) === "isDev";
}

/** The `isDev` test of an `if` with no `else`, in its one form: `if (isDev) { … }`. */
export function devTest(
	node: AST.IfStatement,
	scope: DevScope,
): AST.IdentifierReference | undefined {
	const { test } = node;
	if (node.alternate || test.type !== "Identifier") return undefined;
	return isDevIdentifier(test, scope) ? test : undefined;
}

/** `isDev` read anywhere but as the test of an `if` with no `else` where code may test it. */
export function misplacedDev(
	node: AST.IdentifierReference | { start: number; end: number },
	reporter: Reporter,
	why?: string,
): void {
	const name = "name" in node ? node.name : "isDev";
	reporter.report(
		"UF2040",
		node,
		why ??
			`\`${name}\` is read only as the whole test of an \`if\` with no \`else\`: each target writes its framework's own development check in its place, which a production build drops with its block.`,
		{ help: `Write \`if (${name}) { … }\` at the top of the setup or in client code.` },
	);
}

/**
 * The names a target's development check reads (ADR-0117), with who reads it: a component that
 * reads `isDev` may declare none, which would shadow the global the check needs.
 */
const CHECK_NAMES: ReadonlyMap<string, string> = new Map([
	["process", "React, Vue and Svelte write `isDev` as `process.env.NODE_ENV`"],
	["ngDevMode", "Angular writes `isDev` as a test of the global `ngDevMode`"],
]);

/**
 * Reports each declaration in a component that reads `isDev` named like the global a target's
 * check reads (UF2003, ADR-0117): a parameter, a variable or a function in its body, and a prop
 * named `process` in the object form, which some targets destructure. Angular reports a prop
 * named `ngDevMode` itself, among the names its class declares.
 */
export function reportDevShadows(
	fn: AST.Node & { start: number; end: number; params: readonly AST.Node[] },
	props: readonly { name: string; span: { start: number; end: number } }[],
	scope: DevScope,
	reporter: Reporter,
): void {
	let reads = false;
	visit(fn, (node) => {
		if (reads) return false;
		if (node.type === "Identifier" && scope.scopes.isReference(node)) {
			reads = isDevIdentifier(node as AST.IdentifierReference, scope);
		}
		return !reads;
	});
	if (!reads) return;
	const [parameter] = fn.params;
	const inProps = (node: { start: number }) =>
		parameter !== undefined && node.start >= parameter.start && node.start < parameter.end;
	for (const [name, why] of CHECK_NAMES) {
		const declared = scope.scopes
			.declarationsOf(name)
			.filter((node) => node.start >= fn.start && node.end <= fn.end)
			.filter((node) => name === "process" || !inProps(node));
		const at: { start: number; end: number }[] = [...declared];
		if (!declared.length && name === "process") {
			at.push(...props.filter((prop) => prop.name === name).map((prop) => prop.span));
		}
		for (const span of at) {
			// A setup binding named `ngDevMode` is UF2003 already, among the names a target reserves.
			if (
				reporter.diagnostics.some(
					(each) => each.code === "UF2003" && each.span.start === span.start,
				)
			) {
				continue;
			}
			reporter.report(
				"UF2003",
				span,
				`\`${name}\` cannot be declared in a component that reads \`isDev\`: ${why}, which this name would shadow.`,
				{ help: "Rename it." },
			);
		}
	}
}
