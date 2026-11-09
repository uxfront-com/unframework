// Builds a stub document with Vite, with the page host in Vitest's place, as a Storybook build has
// it: a directory holding an `iframe.html`, which needs no Storybook.
import { join } from "node:path";

import { build } from "vite";

import { packageRoot } from "./project.ts";

/** Builds the `iframe.html` of `root` into `outDir`. */
export async function buildStubDocument(root: string, outDir: string): Promise<void> {
  await build({
    root,
    configFile: false,
    logLevel: "error",
    mode: "development",
    plugins: [
      {
        // The package's `sideEffects` names its setup files, not the stub specs and their target,
        // which a build would drop: they only register tests.
        name: "uf-stub-side-effects",
        enforce: "pre",
        transform: (code, id) =>
          id.includes("/test/") ? { code, moduleSideEffects: true, map: null } : undefined,
      },
    ],
    resolve: {
      alias: [{ find: /^vitest$/, replacement: join(packageRoot, "src/hosts/page/vitest.ts") }],
    },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      target: "esnext",
      rolldownOptions: { input: join(root, "iframe.html") },
    },
  });
}
