import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { Packager } from "./packager.ts";
import { writeFiles } from "./packager.ts";

const VUE_TSC = "vue-tsc/bin/vue-tsc.js";

/**
 * Plan §8.4: the SFC sources, with `vue-tsc`'s declarations beside them. Vue's compiler builds them
 * in the consumer's app, and an SFC imports a shared module by its `.ts` name, so those stay too.
 */
export const vue: Packager = {
  peer: { name: "vue", range: "^3.5.0" },
  needs: [VUE_TSC],
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
          rootDir: "in",
          outDir: out,
          types: [],
        },
        include: ["in/**/*.ts", "in/**/*.vue"],
      }),
    );
    await promisify(execFile)(process.execPath, [resolve(VUE_TSC), "-p", tsconfig], {
      cwd: work,
      maxBuffer: 2 ** 28,
    }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
      // tsc writes its errors to standard output.
      throw new Error(error.stdout || error.stderr || error.message);
    });
  },
};
