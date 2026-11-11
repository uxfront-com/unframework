import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Packager } from "./packager.ts";
import {
  dropDeclarationSideEffects,
  KEEP_ENV,
  KEEP_IMPORTS,
  runScript,
  tscOf,
  writeFiles,
} from "./packager.ts";

const VITE = "vite";
/** The manifests: `@qwik.dev/core/optimizer` has only an `import` condition, which `resolve` can't read. */
const CORE = "@qwik.dev/core/package.json";
const TYPESCRIPT = "typescript/package.json";
const BUNDLE = "index.qwik.mjs";
/** Writes an app's manifest and bundle graph, and warns on the console that a library has neither. */
const APP_PLUGIN = "vite-plugin-qwik-post";

/** The part of Qwik's optimizer this calls. */
interface Optimizer {
  qwikVite: (options: object) => readonly { name: string }[];
}

/**
 * Plan §8.4: a Qwik library build. The `lib` mode makes `qwikVite()` inline every QRL for the app's
 * optimizer to split, and the name `.qwik.mjs` marks the file for it. Vite doesn't read a `qwik`
 * condition by itself, so `default` names the same file. Everything goes in that one file, since a
 * chunk wouldn't have the name. The declarations are `tsc`'s, as in Qwik's own library starter, with
 * `noCheck` for the reason Vue's have it (ADR-0077).
 */
export const qwik: Packager = {
  peer: { name: "@qwik.dev/core", range: "^2.0.0-beta.47" },
  needs: [VITE, CORE, TYPESCRIPT],
  types: "@qwik.dev/core",
  exports: {
    types: "./qwik/index.d.ts",
    qwik: `./qwik/${BUNDLE}`,
    default: `./qwik/${BUNDLE}`,
  },
  run: async ({ files, out, work, resolve }) => {
    await writeFiles(join(work, "in"), files);
    // First, so that Vite finds this one and not the project's.
    await writeFile(
      join(work, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "es2024",
          lib: ["es2024", "dom", "dom.iterable"],
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          jsxImportSource: "@qwik.dev/core",
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
        include: ["in"],
      }),
    );
    const core = resolve(CORE);
    const manifest: { exports: { "./optimizer": { import: string } } } = JSON.parse(
      await readFile(core, "utf8"),
    );
    const optimizer = join(dirname(core), manifest.exports["./optimizer"].import);
    const { qwikVite }: Optimizer = await import(/* @vite-ignore */ pathToFileURL(optimizer).href);
    const vite: { build(config: object): Promise<unknown> } = await import(
      /* @vite-ignore */ pathToFileURL(resolve(VITE)).href
    );
    await vite.build({
      configFile: false,
      envFile: false,
      publicDir: false,
      logLevel: "silent",
      mode: "lib",
      root: work,
      // Inline, or Vite searches upward from here and runs the project's own over the sheets (P8).
      css: { postcss: { plugins: [] } },
      build: {
        outDir: out,
        emptyOutDir: false,
        lib: { entry: "in/index.ts", formats: ["es"], fileName: () => BUNDLE },
        rolldownOptions: { output: { codeSplitting: false } },
      },
      plugins: [
        KEEP_IMPORTS,
        KEEP_ENV,
        ...qwikVite({ srcDir: "in", lint: false }).filter(({ name }) => name !== APP_PLUGIN),
      ],
    });
    await runScript(await tscOf(resolve(TYPESCRIPT)), ["-p", "tsconfig.json"], work);
    await dropDeclarationSideEffects(out);
  },
};
