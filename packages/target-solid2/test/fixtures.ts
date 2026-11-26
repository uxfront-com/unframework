import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework.dev/codegen";
import type { Diagnostic, EmitContext, OutputFile, ToolchainFile } from "@unframework.dev/codegen";
import {
	createComponent,
	createElement,
	createExport,
	createModule,
	createStaticAttribute,
	createText,
} from "@unframework.dev/ir";
import type { ElementNode, RenderNode, UfModule } from "@unframework.dev/ir";
import { transformWithOxc } from "vite";

// The analyser, by path: the target's tests lower real sources as the compiler would, while the
// package itself depends only on ir and codegen (layering).
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";
import { loadCompiler } from "../src/toolchain/compile.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
/** The toolchain directory the harness passes for Solid 2, the only one that holds it (ADR-0102). */
export const toolchainDir: string = join(repo, "tests", "toolchains", "solid2");
const cases = join(repo, "tests", "integration", "cases");

let offset = 0;
/** A distinct span per node, so a test can tell which attribute a diagnostic points at. */
const next = () => ({ start: offset, end: ++offset });

/** An element, with attributes in the order given and text children as strings. */
export function el(
	tag: string,
	attributes: Record<string, string | true> = {},
	...children: Array<RenderNode | string>
): ElementNode {
	return createElement(
		tag,
		Object.entries(attributes).map(([name, value]) => createStaticAttribute(name, value, next())),
		children.map((child) => (typeof child === "string" ? createText(child, next()) : child)),
		next(),
	);
}

/** `basics/hello`, as the analyser lowers it. */
export const hello = (): ElementNode => el("p", { class: "greeting" }, "Hello, world!");

/** `basics/nested-and-void`, as the analyser lowers it. */
export const profileCard = (): ElementNode =>
	el(
		"article",
		{ class: "profile", "aria-labelledby": "profile-name" },
		el(
			"header",
			{ class: "profile-header" },
			el("img", {
				src: AVATAR,
				alt: "Ada's avatar",
				width: "48",
				height: "48",
			}),
			el("h2", { id: "profile-name" }, "Ada Lovelace"),
		),
		el("p", {}, "Mathematician & writer", el("br"), "of the first published program"),
		el("hr"),
		el("label", { for: "profile-note" }, "Note"),
		el("input", { id: "profile-note", type: "text", name: "note", placeholder: "Say hello" }),
	);

export const AVATAR =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E";

/** Emits one component through the Solid 2 target and collects what it reports. */
export function emit(
	render: ElementNode,
	{ name = "Fixture", kind = "default" }: { name?: string; kind?: "default" | "named" } = {},
): { files: Array<OutputFile>; reported: Array<Omit<Diagnostic, "file" | "target">> } {
	const component = createComponent(name, render, next());
	const module = createModule(`${name}.uf.tsx`, [component], [createExport(kind, name, next())]);
	const reported: Array<Omit<Diagnostic, "file" | "target">> = [];
	const context: EmitContext = {
		module,
		options: undefined,
		report: (diagnostic) => void reported.push(diagnostic),
	};
	return { files: target.emit(component, context), reported };
}

/**
 * Every committed golden output of a target, read from the integration corpus, but the scoped
 * sheets (`<source>.css`), which no framework compiler or checker reads: the compile project
 * parses them instead (ADR-0063).
 */
export function goldens(targetName: string): Array<ToolchainFile> {
	// A tree's shared helper modules too, in `_unframework/` (ADR-0121).
	const pattern = new RegExp(`(?:^|/)__output__/${targetName}/(?:_unframework/)?[^/]+$`);
	return readdirSync(cases, { recursive: true })
		.map((entry) => String(entry).split("\\").join("/"))
		.filter(
			(entry) =>
				pattern.test(entry) && !entry.endsWith(".css") && statSync(join(cases, entry)).isFile(),
		)
		.toSorted()
		.map((entry) => {
			const path = join(cases, entry);
			return { path, contents: readFileSync(path, "utf8") };
		});
}

/**
 * A source lowered by the analyser, which must accept it: a test of the emitter starts from the
 * IR the compiler would hand it.
 */
export function lower(source: string, file = "Fixture.uf.tsx"): UfModule {
	const { module, diagnostics } = analyze(parseModule(file, source));
	const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
	if (!module || errors.length) {
		throw new Error(
			`The analyser rejects ${JSON.stringify(source)}: ${JSON.stringify(errors, null, 2)}`,
		);
	}
	return module;
}

/**
 * The formatted Solid 2 output of a source's first component, or of the one `name` names, as
 * `compile()` would write it.
 * Throws when the target reports anything: it never reports (ADR-0033).
 */
export async function emitSource(source: string, name?: string): Promise<string> {
	const module = lower(source);
	const component = name
		? module.components.find((each) => each.name === name)!
		: module.components[0]!;
	const reported: Array<Omit<Diagnostic, "file" | "target">> = [];
	const context: EmitContext = {
		module,
		options: undefined,
		report: (diagnostic) => void reported.push(diagnostic),
	};
	const files = target.emit(component, context);
	if (reported.length || files.length !== 1) {
		throw new Error(`The Solid 2 target reported ${JSON.stringify(reported)}.`);
	}
	const outcome = await formatOutput(files[0]!);
	if (outcome.error) {
		throw new Error(`oxfmt rejects the output: ${outcome.error}`);
	}
	return outcome.file.contents;
}

/**
 * A TSX module as the `ssr` project serves it: @solidjs/compiler, the toolchain's own, compiles it
 * hydratable for the server (`ssr: true`), then Vite's transform strips the types, so Node can
 * import it.
 */
export async function compileForServer(contents: string, filename: string): Promise<string> {
	const compiler = await loadCompiler({ toolchainDir, root: packageDir });
	const { code } = compiler.transform(contents, { filename, generate: "ssr", hydratable: true });
	return (await transformWithOxc(code, filename, { lang: "ts" })).code;
}
