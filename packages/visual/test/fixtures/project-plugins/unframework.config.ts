// A project on every target whose example imports `virtual:uf-fixture`, which only the plugin
// its Vite config names serves, with no declaration file (ADR-0104).
import { ufFixturePlugin } from "../uf-fixture.ts";

export default {
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  vite: () => ({ plugins: [ufFixturePlugin()] }),
  // Angular's compiler stack runs on TypeScript 6, which the workspace keeps in its toolchain.
  package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
