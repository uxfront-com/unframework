// What `build` and `check` share, so `check` fails wherever `build`'s compile would.
import { glob, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";

import {
	createProject,
	createSyntacticOracle,
	loadConfig,
	resolveConfig,
} from "@unframework.dev/compiler";
import type {
	CompileResult,
	OutputFile,
	ResolvedConfig,
	TypeOracle,
} from "@unframework.dev/compiler";
import { createDiagnostic, hasErrors, sortDiagnostics } from "@unframework.dev/diagnostics";
import type { Diagnostic, Span } from "@unframework.dev/diagnostics";

import type { Io } from "./command.ts";

export const TYPE_ORACLE_OPTION = { "type-oracle": { type: "string" } } as const;

const TYPE_ORACLES = ["syntactic", "tsgo"];
const SOURCES = "**/*.uf.{tsx,ts}";
/**
 * An example (`*.example.uf.tsx`) is `unframework visual`'s to render, never a source to build or
 * package, even beside the components it shows (ADR-0087).
 */
const EXAMPLE = ".example.uf.tsx";
const NO_SPAN: Span = { start: 0, end: 0 };
/** Each target's barrel, at the top of its tree. */
const BARREL = "index.ts";
/** A component in one of these files is the file's default export, whatever the source calls it. */
const SINGLE_FILE_COMPONENT = /\.(vue|svelte|astro)$/;

/** What a command reads and writes after compiling a project's sources. */
export interface Compilation {
	/** The exit code. */
	status: number;
	diagnostics: Diagnostic[];
	/** The text of each diagnostic's file, which the renderers need. */
	sources: ReadonlyMap<string, string>;
	/** The resolved config, once it loaded and passed its checks. */
	config?: ResolvedConfig;
	/** Each target's files, at their paths in `outDir/<target>`. Empty unless `status` is 0. */
	trees: ReadonlyMap<string, OutputFile[]>;
	/**
	 * The paths in each tree that are shared helper modules (ADR-0121), `_unframework/<file>`:
	 * no source holds their text, so each one's map names the module itself.
	 */
	helpers: ReadonlyMap<string, ReadonlySet<string>>;
	/** The directory relative paths resolve against. */
	root: string;
	/** The config file as diagnostics name it. */
	configFile: string;
	/** The sources, and the files they read, relative to the root. Sorted. */
	authored: string[];
}

/** One source's compile, and where it sits under srcDir. */
interface Compiled {
	file: string;
	directory: string;
	result: CompileResult;
	copies: OutputFile[];
	/** What its compile read: files relative to the root, and packages as `pkg:<name>`. */
	read: string[];
}

/** A renderer's text as it goes to a terminal: nothing when there is nothing, else a whole line. */
export function printable(text: string): string {
	return text && `${text}\n`;
}

const read = (path: string) => readFile(path, "utf8").catch(() => undefined);

/** Whether `path` is `directory` or inside it. */
function within(directory: string, path: string): boolean {
	const rest = relative(directory, path);
	return rest === "" || (rest !== ".." && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}

/**
 * Loads the config from the working directory, then compiles every source through the project
 * graph (ADR-0071). Source maps are on for `check` too, because a map that can't follow formatting
 * is an error (UF9002) that `build` would fail on.
 */
export async function compileSources(
	io: Io,
	oracle: string | undefined,
	alsoCleans: readonly string[] = [],
): Promise<Compilation> {
	if (oracle !== undefined && !TYPE_ORACLES.includes(oracle)) {
		throw new Error(`--type-oracle takes syntactic or tsgo, not "${oracle}".`);
	}
	const loaded = await loadConfig(io.cwd);
	const root = loaded.directory ?? io.cwd;
	const finish = async (
		status: number,
		diagnostics: Diagnostic[],
		config?: ResolvedConfig,
		trees: ReadonlyMap<string, OutputFile[]> = new Map(),
		authored: string[] = [],
		helpers: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
	): Promise<Compilation> => {
		const sources = new Map<string, string>();
		for (const { file } of diagnostics) {
			if (!sources.has(file)) sources.set(file, (await read(join(root, file))) ?? "");
		}
		return {
			status,
			diagnostics: sortDiagnostics(diagnostics),
			sources,
			...(config ? { config } : {}),
			trees,
			helpers,
			root,
			configFile: loaded.file ?? "unframework.config.ts",
			authored,
		};
	};

	if (loaded.diagnostics.length > 0) return finish(2, loaded.diagnostics);
	const { config, diagnostics: invalid } = await resolveConfig(loaded.raw, loaded);
	if (!config) return finish(2, invalid);

	const named = (path: string) => relative(root, path).split(sep).join("/");
	const configProblem = (field: string, problem: string) =>
		createDiagnostic("UF7002", {
			file: loaded.file ?? "unframework.config.ts",
			span: NO_SPAN,
			message: `The configuration at ${JSON.stringify(field)} ${problem}`,
		});

	const files = await findSources(config, named);
	if (files.length === 0) {
		const srcDir = named(config.srcDir) || ".";
		const message = `No .uf.tsx or .uf.ts file was found under ${srcDir}.`;
		return finish(
			1,
			[createDiagnostic("UF7007", { file: srcDir, span: NO_SPAN, message })],
			config,
		);
	}

	// Cleaning a tree must never delete what it was compiled from.
	const cleaned = [...config.targets, ...alsoCleans];
	for (const target of cleaned) {
		const directory = join(config.outDir, target);
		const holds = [root, ...files.map((file) => join(root, file))];
		const held = holds.find((path) => within(directory, path));
		if (held) {
			const problem = `cleans ${named(directory)}, which holds ${named(held) || "the project"}. Set outDir to a directory of its own.`;
			return finish(2, [configProblem("/outDir", problem)], config);
		}
	}

	const typeOracle: TypeOracle =
		(oracle ?? config.typeOracle) === "tsgo"
			? (await import("@unframework.dev/type-oracle-tsgo")).createTsgoOracle({ root })
			: createSyntacticOracle({ root, readFile: read });
	const compiled: Compiled[] = [];
	try {
		const project = createProject({
			root,
			readFile: read,
			typeOracle,
			targets: config.targets,
			targetOptions: config.targetOptions,
			sourceMap: true,
			// One `_unframework/` per tree, at its root, which mirrors srcDir (ADR-0121).
			helperRoot: named(config.srcDir),
		});
		const srcDir = named(config.srcDir);
		for (const file of files) {
			const result = await project.compile(file);
			const directory = posix.relative(srcDir, posix.dirname(file));
			compiled.push({
				file,
				directory,
				result,
				copies: project.copies(file),
				read: project.dependencies(file),
			});
		}
	} finally {
		await typeOracle.dispose();
	}

	const diagnostics = compiled.flatMap(({ result }) =>
		result.diagnostics.map((diagnostic) => (config.strict ? strictly(diagnostic) : diagnostic)),
	);
	if (hasErrors(diagnostics)) return finish(1, diagnostics, config);

	// Nor what a source read, which the glob doesn't list: a child, a sheet, a shared module, a type.
	for (const { file, read: readFiles } of compiled) {
		for (const target of cleaned) {
			const directory = join(config.outDir, target);
			const held = readFiles.find((path) => within(directory, join(root, path)));
			if (held !== undefined) {
				const problem = `cleans ${named(directory)}, which holds ${held}, which ${file} reads. Set outDir to a directory of its own.`;
				return finish(2, [...diagnostics, configProblem("/outDir", problem)], config);
			}
		}
	}

	// Each tree mirrors srcDir and holds only what the glob found, so an output's import of anything
	// else breaks, and a copy above srcDir leaves its tree.
	for (const { file, directory, result, copies } of compiled) {
		const child = (result.ir?.imports ?? [])
			.map((each) => each.file)
			.find((path) => !files.includes(posix.join(posix.dirname(file), path)));
		const copy = copies
			.map((each) => each.path)
			.find((path) => posix.join(directory, path).startsWith("../"));
		const missed = child ?? copy;
		if (missed !== undefined) {
			const problem = `doesn't give the build ${missed}, which ${file} imports: it is outside srcDir, or in a directory the search skips. Set srcDir to a directory that holds both, or move the file.`;
			return finish(2, [...diagnostics, configProblem("/srcDir", problem)], config);
		}
	}

	const trees = new Map<string, OutputFile[]>();
	const helpers = new Map<string, ReadonlySet<string>>();
	for (const target of config.targets) {
		const tree = assembleTree(target, compiled, diagnostics);
		trees.set(target, tree.files);
		helpers.set(target, tree.helpers);
	}
	if (hasErrors(diagnostics)) return finish(1, diagnostics, config);
	const authored = await authoredFiles(files, compiled, root);
	return finish(0, diagnostics, config, trees, authored, helpers);
}

/** What a package's `source/` needs for its sources to compile in a consumer's app (ADR-0077). */
async function authoredFiles(
	files: readonly string[],
	compiled: readonly Compiled[],
	root: string,
): Promise<string[]> {
	const authored = new Set(files);
	for (const each of compiled.flatMap(({ read: readFiles }) => readFiles)) {
		// A read list also holds packages, as `pkg:<name>`, and what a compile looked for and missed.
		const found = await stat(join(root, each)).then(
			(entry) => entry.isFile(),
			() => false,
		);
		if (found) authored.add(each);
	}
	return [...authored].toSorted();
}

/** Every source under srcDir, relative to the root, in an order that holds on any file system (P8). */
async function findSources(
	config: ResolvedConfig,
	named: (path: string) => string,
): Promise<string[]> {
	const files: string[] = [];
	const entries = glob(SOURCES, {
		cwd: config.srcDir,
		withFileTypes: true,
		exclude: (entry) =>
			entry.name === "node_modules" || join(entry.parentPath, entry.name) === config.outDir,
	});
	for await (const entry of entries) {
		if (entry.isDirectory() || entry.name.endsWith(EXAMPLE)) continue;
		files.push(named(join(entry.parentPath, entry.name)));
	}
	return files.toSorted();
}

/** Plan §8.1: under `strict`, a portability warning is an error. */
function strictly(diagnostic: Diagnostic): Diagnostic {
	return diagnostic.severity === "warning" && diagnostic.code.startsWith("UF4")
		? { ...diagnostic, severity: "error" }
		: diagnostic;
}

/**
 * One target's files: each module's outputs and copies under its directory in srcDir, each shared
 * helper module once (ADR-0121), and the barrel. Two modules compile apart, so `compile()` can't
 * see them collide: a file they would overwrite, or a name the barrel would export twice, is
 * UF1104 here. A helper module two compiles give different texts is a target's bug, UF9001.
 */
function assembleTree(
	target: string,
	compiled: readonly Compiled[],
	diagnostics: Diagnostic[],
): { files: OutputFile[]; helpers: Set<string> } {
	const collision = (file: string, span: Span, message: string) =>
		diagnostics.push(createDiagnostic("UF1104", { file, span, message, target }));

	// Keyed as UF1104 compares files: without case, and as an output imports them, with no extension.
	type Kind = "output" | "copy" | "helper";
	const claimed = new Map<string, { output: OutputFile; module: string; kind: Kind }>();
	const claim = (output: OutputFile, module: string, kind: Kind = "output") => {
		const key = output.path.replace(/\.tsx?$/, "").toLowerCase();
		const held = claimed.get(key);
		if (!held) {
			claimed.set(key, { output, module, kind });
			return;
		}
		// A helper module every compile that uses it emits is one file, with one text (ADR-0121).
		if (kind === "helper" && held.kind === "helper" && held.output.path === output.path) {
			if (held.output.contents === output.contents) return;
			diagnostics.push(
				createDiagnostic("UF9001", {
					file: module,
					span: NO_SPAN,
					message: `The ${target} target gave the helper module ${output.path} one text for ${held.module} and another for ${module}: a helper's text must depend only on the target and the helper (ADR-0121).`,
					target,
				}),
			);
			return;
		}
		// Only a shared module reached from two importers is one file. Two modules with equal outputs
		// are two sources, and only one of them would reach the tree or its map.
		if (kind !== "copy" || held.kind !== "copy" || held.output.path !== output.path) {
			const message =
				kind === "helper" || held.kind === "helper"
					? `${module} and ${held.module} would both write ${output.path}, and \`_unframework/\` at the root of the ${target} tree holds the helper modules (ADR-0121). Rename the shared module, or the directory that holds it.`
					: `${module} and ${held.module} would both write ${output.path}. Rename one of them.`;
			collision(module, NO_SPAN, message);
		}
	};

	const exported = new Map<string, { specifier: string; line: string }>();
	const barrelLine = (
		name: string,
		from: string,
		specifier: string,
		module: string,
		span: Span,
	) => {
		const written = exported.get(name)?.specifier;
		// A component exported twice under one name, as default and by name, is one line.
		if (written === specifier) return;
		if (written !== undefined) {
			const message = `The ${target} barrel would export ${name} from both ${written} and ${specifier}. Rename one of them.`;
			collision(module, span, message);
			return;
		}
		const exportedAs = from === name ? name : `${from} as ${name}`;
		const line = `export { ${exportedAs} } from ${JSON.stringify(specifier)};`;
		exported.set(name, { specifier, line });
	};

	const helpers = new Set<string>();
	for (const { file, directory, result, copies } of compiled) {
		const shared = new Set(result.helpers[target] ?? []);
		for (const output of result.outputs[target] ?? []) {
			const path = posix.join(directory, output.path);
			if (shared.has(output.path)) {
				helpers.add(path);
				claim({ ...output, path }, file, "helper");
				continue;
			}
			claim({ ...output, path }, file);
			const owner = result.owners[target]?.[output.path];
			if (owner === undefined) continue;
			// An output imports a TypeScript file without its extension, and a component file with it.
			const specifier = `./${path.replace(/\.tsx?$/, "")}`;
			const whole = SINGLE_FILE_COMPONENT.test(path);
			const composable = result.ir?.composables?.find((each) => each.name === owner);
			if (composable) barrelLine(owner, owner, specifier, file, composable.span);
			for (const each of result.ir?.exports ?? []) {
				if (each.local !== owner) continue;
				const isDefault = each.kind === "default";
				const name = isDefault ? owner : each.name;
				barrelLine(name, whole || isDefault ? "default" : name, specifier, file, each.span);
			}
		}
		for (const copy of copies)
			claim({ ...copy, path: posix.join(directory, copy.path) }, file, "copy");
	}

	const lines = [...exported.values()].map(({ line }) => line).toSorted();
	const barrel = BARREL.replace(/\.ts$/, "");
	const held = claimed.get(barrel);
	if (held) {
		const message = `${held.module} would write ${held.output.path}, which takes the place of the ${target} barrel, ${BARREL}. Rename it.`;
		collision(held.module, NO_SPAN, message);
	}
	claimed.set(barrel, {
		output: { path: BARREL, contents: `${lines.join("\n")}\n` },
		module: BARREL,
		kind: "output",
	});
	return { files: [...claimed.values()].map(({ output }) => output), helpers };
}
