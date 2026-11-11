// Plan §8.1's configuration, with the `package` field ADR-0076 adds.
import { defineConfig } from "@uxfront/unframework/config";

export default defineConfig({
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  srcDir: "src",
  outDir: "dist",
  targetOptions: { react: { compiler: true } },
  typeOracle: "syntactic",
  strict: false,
  package: { targets: ["react"], resolveFrom: { vue: "../toolchains/vue" } },
});
