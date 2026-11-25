// What a project's `unframework.config.ts` lets into the visual run and the preview: its own Vite
// config (ADR-0104), and the font families a live capture may take besides the bundled one
// (ADR-0105).
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig, resolveConfig } from "@unframework.dev/compiler";
import type { ResolvedConfig, ViteContext } from "@unframework.dev/compiler";
import { resolveConfig as resolveViteConfig } from "vite";
import { describe, expect, it } from "vitest";

import { startFailure, startPreview, targetServerOptions } from "../src/preview/index.ts";
import { targetServerConfig } from "../src/preview/servers.ts";
import { runVisual } from "../src/run.ts";

const fixture = (name: string) =>
	realpathSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)));

const SEVEN = ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"];

async function projectConfig(root: string): Promise<ResolvedConfig> {
	const loaded = await loadConfig(root);
	const { config, diagnostics } = await resolveConfig(loaded.raw, loaded);
	expect(diagnostics).toEqual([]);
	return config!;
}

describe("a project's Vite config", () => {
	it(
		"renders an example that imports a module only the project serves on every target",
		{ timeout: 300_000 },
		async () => {
			const result = await runVisual({
				root: fixture("project-plugins"),
				env: {},
				stdout: () => undefined,
			});
			const [example] = result.report!.examples;
			expect(example?.id).toBe("examples/Greeting");
			expect(example!.cells.map((cell) => [cell.target, cell.status])).toEqual(
				SEVEN.map((target) => [target, "passed"]),
			);
			expect(result.exitCode).toBe(0);
		},
	);

	it("reaches each preview server from the config, before the unframework plugin", async () => {
		const root = fixture("project-plugins");
		const config = await projectConfig(root);
		for (const target of ["vue", "react", "svelte"] as const) {
			const { config: server } = await targetServerConfig(
				targetServerOptions(root, config, target, {}),
			);
			// Vite resolves the configuration as `createServer` would, without listening.
			const resolved = await resolveViteConfig(server, "serve");
			const names = resolved.plugins.map((plugin) => plugin.name);
			expect(names, target).toContain("uf-fixture");
			expect(names.indexOf("uf-fixture"), target).toBeLessThan(
				names.findIndex((name) => name.startsWith("unframework") && name !== "unframework:preview"),
			);
		}
	});

	it("is called for the preview's server, and merges its other keys in", async () => {
		const seen: Array<ViteContext> = [];
		const { config: server } = await targetServerConfig({
			root: fixture("project-plugins"),
			target: "vue",
			toolchainDir: fixture("project-plugins"),
			entries: {},
			vite: (each) => {
				seen.push(each);
				return {
					plugins: [{ name: "engine" }],
					optimizeDeps: { include: ["@styleframe/runtime"] },
				};
			},
		});
		expect(seen).toEqual([{ target: "vue", mode: "preview" }]);
		const names = (server.plugins ?? []).flat().map((plugin) => (plugin as { name: string }).name);
		expect(names.indexOf("engine")).toBeLessThan(names.indexOf("unframework"));
		// The preview's own entries stay beside the project's.
		expect(server.optimizeDeps).toMatchObject({
			include: expect.arrayContaining(["@styleframe/runtime"]),
			exclude: expect.arrayContaining(["@unframework.dev/visual"]),
			entries: [],
		});
		expect(server).toMatchObject({ configFile: false, server: { host: "127.0.0.1", port: 0 } });
	});

	it.each([
		["configFile", { configFile: "vite.config.ts" }],
		["server.host", { server: { host: true } }],
	])("refuses %s, which the preview sets itself", async (key, given) => {
		await expect(
			targetServerConfig({
				root: fixture("project-plugins"),
				target: "vue",
				toolchainDir: fixture("project-plugins"),
				entries: {},
				vite: () => given,
			}),
		).rejects.toThrow(
			`[uf] vite in unframework.config.ts sets \`${key}\`, which the preview server for vue sets itself: leave it out.`,
		);
	});
});

describe("a preview whose servers fail to start", () => {
	it("says why, once for the targets that failed alike, when a project's plugins throw", async () => {
		await expect(startPreview({ root: fixture("throwing-plugins") })).rejects.toThrow(
			"[uf:preview] 2 target servers failed to start:\n  vue, react: [uf] vite in unframework.config.ts threw: no licence key found in styleframe.config.ts",
		);
	});

	it("gives one server's own error, and a line per reason for several", () => {
		const own = new Error("port in use");
		expect(startFailure([{ target: "vue", reason: own }])).toBe(own);
		const several = startFailure([
			{ target: "vue", reason: new Error("a") },
			{ target: "react", reason: new Error("b") },
			{ target: "svelte", reason: new Error("a") },
		]);
		expect(several).toBeInstanceOf(AggregateError);
		expect((several as AggregateError).message).toBe(
			"[uf:preview] 3 target servers failed to start:\n  vue, svelte: a\n  react: b",
		);
		expect((several as AggregateError).errors).toHaveLength(3);
	});
});

/** The example's run in a fixture, quiet. */
const visual = (name: string, pixels?: "live" | "baseline") =>
	runVisual({
		root: fixture(name),
		env: {},
		stdout: () => undefined,
		...(pixels ? { pixels } : {}),
	});

let systemFonts: Promise<Array<string>> | undefined;

/**
 * The families Chromium drew the example's system font with on this machine, as the
 * `font-fallback` message of a run that lists none names them: they differ from one machine to
 * the next, so the fixtures that list them read them from `UF_FIXTURE_FONTS`.
 */
function drawnFonts(): Promise<Array<string>> {
	systemFonts ??= visual("live-fonts-bundled").then((result) => {
		const [cell] = result.report!.examples[0]!.cells;
		expect(cell).toMatchObject({ target: "vue", status: "failed", outcome: "font-fallback" });
		const families = [...(cell!.message ?? "").matchAll(/ with "([^"]+)"/g)].map(
			([, name]) => name!,
		);
		expect(families.length).toBeGreaterThan(0);
		process.env.UF_FIXTURE_FONTS = [...new Set(families)].join(",");
		return families;
	});
	return systemFonts;
}

describe("a project's live fonts", () => {
	it(
		"fail the system's font in a live capture when the project lists none",
		{ timeout: 180_000 },
		async () => {
			// The run's own expectations are in `drawnFonts`.
			expect(await drawnFonts()).not.toContain("Inter");
		},
	);

	it(
		"let a live capture draw in the families the project lists, on every target",
		{ timeout: 300_000 },
		async () => {
			await drawnFonts();
			const result = await visual("live-fonts");
			const [example] = result.report!.examples;
			expect(example!.cells.map((cell) => [cell.target, cell.status])).toEqual(
				SEVEN.map((target) => [target, "passed"]),
			);
			expect(result.exitCode).toBe(0);
		},
	);

	it(
		"fail the system's font when the project lists another family",
		{ timeout: 180_000 },
		async () => {
			const result = await visual("live-fonts-other");
			const [cell] = result.report!.examples[0]!.cells;
			expect(cell).toMatchObject({ target: "vue", status: "failed", outcome: "font-fallback" });
			expect(result.exitCode).toBe(1);
		},
	);

	it(
		"fail the system's font against committed baselines, listed or not",
		{ timeout: 180_000 },
		async () => {
			await drawnFonts();
			const result = await visual("live-fonts-baseline", "baseline");
			const [cell] = result.report!.examples[0]!.cells;
			expect(cell).toMatchObject({ target: "vue", status: "failed", outcome: "font-fallback" });
			expect(result.exitCode).toBe(1);
		},
	);
});
