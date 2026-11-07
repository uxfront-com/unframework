import { glob, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Packager } from "./packager.ts";
import { dropSideEffectImports, runScript, writeFiles } from "./packager.ts";

const VUE_TSC = "vue-tsc/bin/vue-tsc.js";

/**
 * Plan §8.4: the SFC sources, with `vue-tsc`'s declarations beside them. Vue's compiler builds them
 * in the consumer's app, and an SFC imports a shared module by its `.ts` name, so those stay too.
 * It writes with `noCheck`, as tsgo does under tsdown: this scratch project can't see what the
 * project declares, a `virtual:` module or a global, so a check here would refuse correct sources.
 */
export const vue: Packager = {
  peer: { name: "vue", range: "^3.5.0" },
  needs: [VUE_TSC],
  types: "vue",
  exports: { types: "./vue/index.d.ts", default: "./vue/index.ts" },
  run: async ({ files, out, work, resolve }) => {
    await writeFiles(out, files);
    await writeFiles(join(work, "in"), files);
    const tsconfig = join(work, "tsconfig.json");
    await writeFile(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          target: "es2024",
          lib: ["es2024", "dom", "dom.iterable"],
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "preserve",
          strict: true,
          skipLibCheck: true,
          allowImportingTsExtensions: true,
          declaration: true,
          emitDeclarationOnly: true,
          noCheck: true,
          rootDir: "in",
          outDir: out,
          types: [],
        },
        include: ["in/**/*.ts", "in/**/*.vue"],
      }),
    );
    await runScript(resolve(VUE_TSC), ["-p", tsconfig], work);
    for await (const file of glob("**/*.d.ts", { cwd: out })) {
      const path = join(out, file);
      await writeFile(path, dropSideEffectImports(await readFile(path, "utf8")));
    }
  },
};
