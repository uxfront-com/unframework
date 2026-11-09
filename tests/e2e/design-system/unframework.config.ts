import { defineConfig } from "unframework/config";

export default defineConfig({
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  package: {
    // The targets `build --package` has a packager for so far.
    targets: ["astro", "react", "solid", "vue"],
    // Their packagers need TypeScript 6, which the workspace keeps in the toolchains (AGENTS.md).
    resolveFrom: {
      angular: "../../toolchains/angular",
      vue: "../../toolchains/vue",
      svelte: "../../toolchains/svelte",
    },
  },
});
