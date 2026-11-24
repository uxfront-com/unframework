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
  // ADR-0104 and ADR-0105: a project's Vite config for each server, its plugins in any shape
  // Vite's `plugins` takes beside any other key, and the fonts a live capture may take.
  vite: async ({ target, mode }) => ({
    plugins: [
      { name: `engine:${target}:${mode}` },
      [Promise.resolve({ name: "engine:css" }), false],
    ],
    optimizeDeps: { include: ["@styleframe/runtime"] },
  }),
  liveFonts: ["Inkline Sans"],
});

// A config typed by an interface, as Vite's own `UserConfig` is: an interface has no implicit index
// signature, so the field's type must take one without (ADR-0104). The probes also run in a
// consumer of the packed package, which has no Vite, so the interface stands for it here, and
// `packages/testing/test/project-vite.test.ts` type-checks Vite's own.
interface UserConfigLike {
  root?: string;
  plugins?: Array<{ name: string }>;
  optimizeDeps?: { include?: Array<string> };
}

export const annotated = defineConfig({
  vite: (): UserConfigLike => ({ plugins: [], optimizeDeps: { include: ["@styleframe/runtime"] } }),
});
