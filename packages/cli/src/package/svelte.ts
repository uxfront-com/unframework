import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Packager } from "./packager.ts";
import { binOf, dropDeclarationSideEffects, runScript, tscOf, writeFiles } from "./packager.ts";

/** Its `exports` name nothing else, so its script is found through its manifest. */
const MANIFEST = "@sveltejs/package/package.json";
const TYPESCRIPT = "typescript/package.json";
/** How svelte2tsx reports a declaration it couldn't write, a warning that still exits 0. */
const LOST_DECLARATION = "likely not generated";

/**
 * Plan §8.4: svelte-package, which keeps the components as Svelte, turns each `.ts` module into
 * JS, and writes the declarations. The scratch directory has no `svelte.config.js`, so a project's
 * preprocessors never run on what is already plain Svelte. The range is what the output needs:
 * `{@attach}`, from 5.29. Only `types` and `svelte` are exported, as Svelte's own packaging guide
 * says: a `.svelte` file means nothing to a resolver without that condition.
 */
export const svelte: Packager = {
  peer: { name: "svelte", range: "^5.29.0" },
  needs: [MANIFEST, TYPESCRIPT],
  types: "svelte",
  exports: { types: "./svelte/index.d.ts", svelte: "./svelte/index.js" },
  run: async ({ files, out, work, resolve }) => {
    await writeFiles(join(work, "in"), files);
    await writeFile(
      join(work, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "es2024",
          lib: ["es2024", "dom", "dom.iterable"],
          module: "esnext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          rewriteRelativeImportExtensions: true,
          types: [],
        },
        include: ["in/**/*.ts"],
      }),
    );
    // svelte-package transpiles a module without reading its diagnostics, so a syntax error would
    // ship as broken JS. A shared module is copied as written, so nothing has parsed it yet.
    await runScript(
      await tscOf(resolve(TYPESCRIPT)),
      ["-p", "tsconfig.json", "--noEmit", "--noCheck"],
      work,
    );
    const script = await binOf(resolve(MANIFEST), "svelte-package");
    const printed = await runScript(
      script,
      ["--input", "in", "--output", out, "--tsconfig", "tsconfig.json"],
      work,
    );
    if (printed.includes(LOST_DECLARATION)) throw new Error(printed);
    await dropDeclarationSideEffects(out);
  },
};
