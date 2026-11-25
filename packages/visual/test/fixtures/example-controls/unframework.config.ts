// The example controls' fixture (ADR-0113): the seven targets and `solid@2`, each compiler stack
// resolved from the workspace's toolchains, as the sample design system's are.
export default {
	targets: ["react", "vue", "svelte", "solid", "solid@2", "angular", "qwik", "astro"],
	package: {
		resolveFrom: {
			angular: "../../../../../tests/toolchains/angular",
			vue: "../../../../../tests/toolchains/vue",
			svelte: "../../../../../tests/toolchains/svelte",
			solid2: "../../../../../tests/toolchains/solid2",
		},
	},
};
