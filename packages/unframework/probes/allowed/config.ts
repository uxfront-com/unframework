// Plan §8.1's configuration, with the `package` field ADR-0076 adds and the fields of ADR-0104
// and ADR-0105.
import { defineConfig } from "@uxfront/unframework/config";

export default defineConfig({
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  srcDir: "src",
  outDir: "dist",
  targetOptions: { react: { compiler: true } },
  typeOracle: "syntactic",
  strict: false,
  package: { targets: ["react"], resolveFrom: { vue: "../toolchains/vue" } },
  // ADR-0104 and ADR-0105: a project's Vite plugins, in any shape Vite's `plugins` takes, the
  // declarations that type their modules, and the fonts a live capture may take.
  vitePlugins: async () => [{ name: "engine" }, [Promise.resolve({ name: "engine:css" }), false]],
  declarations: [".engine/virtual.d.ts"],
  liveFonts: "any",
});
