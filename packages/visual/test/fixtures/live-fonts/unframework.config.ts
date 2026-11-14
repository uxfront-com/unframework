// A project on every target whose example draws its text in the system's font, which it lets
// into live captures (ADR-0105).
export default {
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  liveFonts: "any",
  // Angular's compiler stack runs on TypeScript 6, which the workspace keeps in its toolchain.
  package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
