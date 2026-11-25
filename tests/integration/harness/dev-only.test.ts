// The production proof of `isDev` (ADR-0117), in each `toolchain:<target>` project: for each
// `cases/dev/*` case, the target's framework compile of the committed outputs, then two rolldown
// bundles, as an app's production and development builds would resolve and replace them.
// - Production: `process.env.NODE_ENV` is "production", `ngDevMode` false, `import.meta.env.DEV`
//   false, the `production` export condition, minified. The warning's text must be gone.
// - Development: "development", `ngDevMode` undefined, `import.meta.env.DEV` true, the
//   `development` condition. The text must be there, so the production check can't pass by
//   accident.
// The framework's own flag module (`solid-js/web`, `@solidjs/web`, `@qwik.dev/core/build`) is
// bundled, so the condition picks its value; every other package stays external. Where the case's
// code is inert on the target, as a hook is on Astro, which declares `interactivity` unsupported
// (its expected UF4001), both bundles must lack the text: an assertion, never a skip.
import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

import type { ToolchainFile } from "@unframework.dev/codegen";
import { rolldown } from "rolldown";
import type { Plugin } from "rolldown";
import { beforeAll, describe, expect, inject, it } from "vitest";

import { listCases } from "./cases.ts";
import { ENGINE_DECLARATIONS } from "./engines.ts";
import { committedOutputFiles } from "./output-files.ts";
import { ROOT, toolchainDir } from "./paths.ts";
import { loadToolchain } from "./targets.ts";

const target = inject("target");
const harness = inject("ufHarness");
const cases = listCases(harness.casesDir).filter((info) => info.id.startsWith("dev/"));

/** The modules that hold a framework's own development flag, which the bundle resolves. */
const FLAG_MODULES: ReadonlySet<string> = new Set([
	"solid-js/web",
	"@solidjs/web",
	"@qwik.dev/core/build",
]);

/** The warning each case logs: the text of its source's `console.warn`. */
function warningOf(source: string): string {
	const match = /console\.warn\("([^"]+)"\)/.exec(readFileSync(source, "utf8"));
	if (!match) throw new Error(`${source} logs no warning to look for.`);
	return match[1]!;
}

/**
 * What the component renders whatever the build, its icon's path: the positive control, which
 * the production bundle must hold, so a missing warning means the build dropped the check, not
 * the component.
 */
function rendered(source: string): string {
	const match = / d="([^"]+)"/.exec(readFileSync(source, "utf8"));
	if (!match) throw new Error(`${source} renders no path to look for.`);
	return match[1]!;
}

/** Whether the target declares a capability the case needs unsupported: its UF4001. */
function inert(dir: string): boolean {
	const expected = JSON.parse(
		readFileSync(join(dir, "__expected__", "diagnostics.json"), "utf8"),
	) as { code: string; target?: string }[];
	return expected.some((each) => each.code === "UF4001" && each.target === target);
}

/** A build's settings: what it replaces, the export condition it resolves, and minification. */
interface Build {
	define: Record<string, string>;
	condition: "production" | "development";
	minify: boolean;
}

const PRODUCTION: Build = {
	define: {
		"process.env.NODE_ENV": '"production"',
		ngDevMode: "false",
		"import.meta.env.DEV": "false",
	},
	condition: "production",
	minify: true,
};

const DEVELOPMENT: Build = {
	define: { "process.env.NODE_ENV": '"development"', "import.meta.env.DEV": "true" },
	condition: "development",
	minify: false,
};

/** The path a module is found by, with no script extension: imports name either kind. */
const moduleKey = (path: string) => path.replace(/\.[cm]?[jt]sx?$/, "");

/** The code of one build of a case's compiled modules. */
async function bundled(modules: readonly ToolchainFile[], build: Build): Promise<string> {
	const byKey = new Map(modules.map((module) => [moduleKey(module.path), module] as const));
	// `@solidjs/web` is installed only beside the Solid 2 toolchain (ADR-0102).
	const base = join(target === "solid2" ? toolchainDir(target) : ROOT, "index.js");
	const memory: Plugin = {
		name: "uf-dev-only:memory",
		async resolveId(source, importer) {
			if (!importer && byKey.has(moduleKey(source))) return moduleKey(source);
			if (FLAG_MODULES.has(source)) {
				return this.resolve(source, base, { skipSelf: true });
			}
			if (/^\.\.?\//.test(source) && importer && byKey.has(importer)) {
				const key = moduleKey(posix.join(dirname(importer), source));
				return byKey.has(key) ? key : { id: source, external: true };
			}
			// A flag module's own relative imports resolve; every package stays external.
			if (/^\.\.?\//.test(source) || source.startsWith("/")) return null;
			return { id: source, external: true };
		},
		load(id) {
			const module = byKey.get(id);
			if (!module) return undefined;
			return { code: module.contents, moduleType: /\.[jt]sx$/.test(module.path) ? "tsx" : "ts" };
		},
	};
	const bundle = await rolldown({
		input: modules.map((module) => module.path),
		plugins: [memory],
		platform: "browser",
		logLevel: "silent",
		tsconfig: false,
		resolve: { conditionNames: ["browser", "import", build.condition] },
		transform: { jsx: { runtime: "automatic" }, define: build.define },
	});
	try {
		const { output } = await bundle.generate({ format: "es", minify: build.minify });
		return output.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
	} finally {
		await bundle.close();
	}
}

describe(`dev-only production build › ${target}`, () => {
	/** Each case's compiled modules, by build: a compiler may decide the build itself (Qwik's). */
	const compiled = new Map<string, Record<Build["condition"], ToolchainFile[]>>();

	beforeAll(async () => {
		const toolchain = await loadToolchain(target);
		const emit = async (paths: readonly string[], mode: Build["condition"]) => {
			const contents = paths.map((path) => ({ path, contents: readFileSync(path, "utf8") }));
			const emitted = await toolchain.frameworkEmit(contents, {
				toolchainDir: toolchainDir(target),
				root: ROOT,
				declarations: ENGINE_DECLARATIONS,
				mode,
			});
			return paths.flatMap((path) => emitted.get(path) ?? []);
		};
		for (const info of cases) {
			const paths = committedOutputFiles(info, target);
			compiled.set(info.id, {
				production: await emit(paths, "production"),
				development: await emit(paths, "development"),
			});
		}
	});

	for (const info of cases) {
		it(`${info.id} › ${target}`, async () => {
			const modules = compiled.get(info.id)!;
			expect(modules.production.length, "the case has compiled modules").toBeGreaterThan(0);
			const warning = warningOf(info.source);
			const production = await bundled(modules.production, PRODUCTION);
			const development = await bundled(modules.development, DEVELOPMENT);
			expect(
				production.includes(rendered(info.source)),
				"the production bundle holds the component",
			).toBe(true);
			expect(production.includes(warning), "the production bundle holds the warning").toBe(false);
			expect(development.includes(warning), "the development bundle holds the warning").toBe(
				!inert(info.dir),
			);
		});
	}
});
