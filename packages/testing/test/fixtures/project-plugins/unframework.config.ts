// A project on every target whose component imports `virtual:uf-fixture`, which only the plugin
// named here serves, typed by the declaration file named here (ADR-0104).
import { ufFixturePlugin } from "../uf-fixture.ts";

export default {
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  vitePlugins: () => [ufFixturePlugin()],
  declarations: ["../uf-fixture.d.ts"],
  // Angular's compiler stack runs on TypeScript 6, which the workspace keeps in its toolchain.
  package: { resolveFrom: { angular: "../../../../../tests/toolchains/angular" } },
};
