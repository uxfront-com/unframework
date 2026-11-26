// A project on every target whose component imports `virtual:uf-fixture`, which only the plugin
// its Vite config names serves, with no declaration file (ADR-0104).
import { ufFixturePlugin } from "../uf-fixture.ts";

export default {
	targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
	vite: () => ({
		plugins: [ufFixturePlugin()],
		// The runtime the plugin's module imports, bundled before the run starts.
		optimizeDeps: { include: ["parse5"] },
	}),
	// Angular's compiler stack runs on TypeScript 6, which the workspace keeps in its toolchain.
	package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
