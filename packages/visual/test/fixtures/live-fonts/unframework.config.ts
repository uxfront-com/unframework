// A project on every target whose example draws its text in the system's font, which it lets
// into live captures (ADR-0105). The system's font has another name on each machine, so the test
// passes the names the font audit reported (`UF_FIXTURE_FONTS`, comma-separated).
export default {
	targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
	liveFonts: (process.env.UF_FIXTURE_FONTS ?? "").split(",").filter(Boolean),
	// Angular's compiler stack runs on TypeScript 6, which the workspace keeps in its toolchain.
	package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
