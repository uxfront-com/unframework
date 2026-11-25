// Where every solid2 layer finds Solid 2 (ADR-0102): the toolchain's Vite fragment resolves
// Solid's packages in the toolchain directory, though the project's root, the corpus, holds Solid 1.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toolchain } from "../src/toolchain/index.ts";

const repository = fileURLToPath(new URL("../../..", import.meta.url));
const toolchainDir = join(repository, "tests/toolchains/solid2");
const corpus = join(repository, "tests/integration");
/** A module of the corpus, as an output importing Solid would be. */
const importer = join(corpus, "cases/state/counter/Counter.uf.tsx");

/** The version of the package whose file `path` is, from its nearest `package.json`. */
function versionOf(path: string): string {
	for (let dir = dirname(path); dir !== dirname(dir); dir = dirname(dir)) {
		try {
			const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
				name?: string;
				version?: string;
			};
			if (manifest.name && manifest.version) {
				return manifest.version;
			}
		} catch {
			// No manifest here: look further up.
		}
	}
	throw new Error(`No package.json above ${path}.`);
}

let server: ViteDevServer;

beforeAll(async () => {
	const fragment = await toolchain.vite("browser", { toolchainDir, root: corpus });
	server = await createServer({
		...fragment,
		root: corpus,
		configFile: false,
		logLevel: "silent",
		server: { middlewareMode: true, ws: false },
	});
});

afterAll(async () => {
	await server.close();
});

describe("the solid2 fragment's resolution of Solid 2", () => {
	it("resolves Solid 2's packages to 2.0.0 from the corpus, which holds Solid 1", async () => {
		// Node, from the corpus: Solid 1.
		expect(versionOf(createRequire(importer).resolve("solid-js"))).toBe("1.9.15");
		// The fragment, from the same importer: Solid 2's browser builds.
		const container = server.environments.client.pluginContainer;
		for (const name of ["solid-js", "@solidjs/web"]) {
			const resolved = await container.resolveId(name, importer);
			expect(resolved, name).not.toBeNull();
			expect(versionOf(resolved!.id.split("?")[0]!), name).toBe("2.0.0");
		}
		const solid = await container.resolveId("solid-js", importer);
		expect(solid!.id).not.toContain("server");
		// Solid's own dependency resolves from Solid, 2.0.0 too.
		const signals = await container.resolveId("@solidjs/signals", solid!.id.split("?")[0]);
		expect(versionOf(signals!.id.split("?")[0]!)).toBe("2.0.0");
	});

	it("resolves Solid 2 the same as the toolchain directory's own install", async () => {
		const own = createRequire(join(toolchainDir, "package.json"));
		const container = server.environments.client.pluginContainer;
		const resolved = await container.resolveId("solid-js", importer);
		expect(dirname(dirname(resolved!.id.split("?")[0]!))).toBe(
			dirname(own.resolve("solid-js/package.json")).replace(/\/$/, ""),
		);
	});
});
