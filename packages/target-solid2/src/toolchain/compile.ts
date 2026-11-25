// L3 for Solid 2: @solidjs/compiler, Solid 2's native JSX compiler, in the two modes the Vite
// plugin compiles with: `dom` for the browser and hydratable `ssr` for the server. It loads from
// `context.toolchainDir`, as every solid2 layer does (ADR-0102).
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type {
	FrameworkCompileResult,
	ToolchainContext,
	ToolchainFile,
	ToolchainMessage,
} from "@unframework.dev/codegen";
import { assertFilesToCompile } from "@unframework.dev/codegen/toolchain-node";

/** The part of @solidjs/compiler this toolchain calls. */
interface SolidCompiler {
	transform(
		code: string,
		options: { filename: string; generate: "dom" | "ssr"; hydratable: boolean },
	): { code: string };
}

/** The template validation's errors start with this line. */
const MALFORMED = "The HTML provided is malformed";

/**
 * The compiler @solidjs/vite-plugin compiles with, from the toolchain directory. It is the one
 * the plugin itself resolves, or the check would judge the output with another compiler than the
 * browser and SSR projects run.
 */
export async function loadCompiler(context: ToolchainContext): Promise<SolidCompiler> {
	const fromToolchain = createRequire(join(context.toolchainDir, "package.json"));
	const plugin = fromToolchain.resolve("@solidjs/vite-plugin");
	const compiler = fromToolchain.resolve("@solidjs/compiler");
	const pluginsCompiler = createRequire(plugin).resolve("@solidjs/compiler");
	if (pluginsCompiler !== compiler) {
		throw new Error(
			`@solidjs/vite-plugin compiles with ${pluginsCompiler}, but this check would use ${compiler}: install one @solidjs/compiler.`,
		);
	}
	return (await import(pathToFileURL(compiler).href)) as SolidCompiler;
}

/**
 * Compiles each file in `dom` and then `ssr` mode. The compiler throws for a parse error and for a
 * template a browser would parse otherwise ("The HTML provided is malformed…"); both are errors,
 * since the compiler refuses the file. It prints nothing, so it has no warnings.
 */
export async function compileWithSolid(
	files: readonly ToolchainFile[],
	context: ToolchainContext,
): Promise<Map<string, FrameworkCompileResult>> {
	assertFilesToCompile(files);
	const compiler = await loadCompiler(context);
	return new Map(files.map((file) => [file.path, compileFile(compiler, file)] as const));
}

/**
 * L15: Solid's client output for each file, as a client build compiles it: the JSX compiled for
 * the DOM, then the types stripped, as Vite's own transform does after the plugin.
 */
export async function emitWithSolid(
	files: readonly ToolchainFile[],
	context: ToolchainContext,
): Promise<Map<string, ToolchainFile[]>> {
	assertFilesToCompile(files);
	const compiler = await loadCompiler(context);
	const { transformWithOxc } = await import("vite");
	const emitted = new Map<string, ToolchainFile[]>();
	for (const file of files) {
		const { code } = compiler.transform(file.contents, {
			filename: file.path,
			generate: "dom",
			hydratable: false,
		});
		const stripped = await transformWithOxc(code, file.path, {
			lang: "ts",
			typescript: { onlyRemoveTypeImports: true },
		});
		emitted.set(file.path, [{ path: file.path, contents: stripped.code }]);
	}
	return emitted;
}

function compileFile(compiler: SolidCompiler, file: ToolchainFile): FrameworkCompileResult {
	for (const generate of ["dom", "ssr"] as const) {
		try {
			compiler.transform(file.contents, {
				filename: file.path,
				generate,
				hydratable: generate === "ssr",
			});
		} catch (error) {
			return { errors: [fromCompilerError(error)], warnings: [] };
		}
	}
	return { errors: [], warnings: [] };
}

/**
 * A compiler error as a message. Its text ends its first line with `(line:column)`, 1-based,
 * which becomes the message's position.
 */
function fromCompilerError(error: unknown): ToolchainMessage {
	if (!(error instanceof Error)) return { message: String(error) };
	const [first = error.message, ...rest] = error.message.split("\n");
	const at = /\s\((\d+):(\d+)\)$/.exec(first);
	const message = [at ? first.slice(0, at.index) : first, ...rest].join("\n").trim();
	return {
		message,
		...(at ? { line: Number(at[1]), column: Number(at[2]) } : {}),
		code: message.startsWith(MALFORMED) ? "solid/malformed-html" : "solid/compile",
	};
}
