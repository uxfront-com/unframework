import { readFileSync, realpathSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { OutputFile } from "@unframework/compiler";

import type { Packager } from "./packager.ts";
import {
  dropDeclarationSideEffects,
  KEEP_ENV,
  KEEP_IMPORTS,
  runScript,
  sanitizeBelow,
  writeFiles,
} from "./packager.ts";

const VITE = "vite";
const PLUGIN_VUE = "@vitejs/plugin-vue";
const VUE_TSC = "vue-tsc/bin/vue-tsc.js";
/** The name plugin-vue registers, by which its `api` is found. */
const PLUGIN_VUE_NAME = "vite:vue";

/** A module this build compiles; anything else, a sheet, is copied as it is. */
const COMPILED = /\.(vue|[cm]?[jt]sx?)$/;

/**
 * plugin-vue's request for a `<style src>` sheet. The Vue target writes only this kind, unscoped,
 * so the sheet is the compiler's, already scoped (ADR-0063). The path is captured.
 */
const STYLE_REQUEST = /^(\.{1,2}\/[^?]+)\?vue&type=style&index=\d+&src=true&lang\.css$/;

/**
 * A component's sheet stays an import of the file beside it, as React's and Solid's do (P7). Vite's
 * library mode would gather every sheet into one `style.css` and drop the import. Any other style
 * request would mean the Vue target wrote a block this can't ship, which must not pass silently.
 */
const KEEP_SHEETS = {
  name: "unframework:keep-sheets",
  enforce: "pre",
  resolveId(id: string) {
    const path = STYLE_REQUEST.exec(id)?.[1];
    if (path !== undefined) return { id: path, external: true };
    if (id.includes("?vue&type=style")) {
      throw new Error(`The Vue packager can only ship a <style src> sheet, not ${id}.`);
    }
    return null;
  },
};

/**
 * Node's file system for `compileScript`, which reads a props type imported from another module
 * through it. Without one it falls back to TypeScript's `sys`, which TypeScript 7 doesn't export, so
 * packing would fail wherever the `vue` it compiles with sits beside TypeScript 7 (ADR-0082).
 */
const SCRIPT_FS = {
  fileExists: (file: string): boolean =>
    statSync(file, { throwIfNoEntry: false })?.isFile() ?? false,
  readFile: (file: string): string | undefined =>
    statSync(file, { throwIfNoEntry: false })?.isFile() ? readFileSync(file, "utf8") : undefined,
  realpath: (file: string): string => realpathSync(file),
};

/** The part of plugin-vue's `api` this sets. */
interface VueApi {
  options: Record<string, unknown>;
}

/**
 * A production compile whatever `NODE_ENV` says. plugin-vue takes `isProduction` from Vite, which
 * reads it from `NODE_ENV`, and outside production it attaches each component's file path and its
 * devtools hooks (P8). Its `configResolved` sets the options, so this runs after it.
 */
const PRODUCTION = {
  name: "unframework:vue-production",
  configResolved(config: { plugins: readonly { name: string; api?: VueApi }[] }) {
    const api = config.plugins.find(({ name }) => name === PLUGIN_VUE_NAME)?.api;
    if (!api) throw new Error(`${PLUGIN_VUE} exposes no options to compile for production with.`);
    api.options = { ...api.options, isProduction: true, devToolsEnabled: false };
  },
};

/** The part of Vite this calls. */
interface Vite {
  build(config: object): Promise<unknown>;
}

/**
 * Plan §8.4 and ADR-0082: the SFCs compiled to JS by a Vite library build through plugin-vue, one
 * module to a file, with `vue-tsc`'s declarations beside them. The package holds no `.vue` file, so
 * a consumer's plugin-vue compiles nothing of it and needs no file system for its types. The JS is
 * compiled with the `vue` the stage resolves, the one its declarations read. Declarations are
 * written with `noCheck`, as tsgo does under tsdown: this scratch project can't see what the project
 * declares, a `virtual:` module or a global, so a check here would refuse correct sources.
 */
export const vue: Packager = {
  peer: { name: "vue", range: "^3.5.0" },
  needs: [VITE, PLUGIN_VUE, VUE_TSC],
  types: "vue",
  exports: { types: "./vue/index.d.ts", default: "./vue/index.js" },
  run: async ({ files, out, work, resolve }) => {
    const scratch = join(work, "in");
    await writeFiles(scratch, files);
    // First, so that Vite finds this one and not the project's.
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
    const vite: Vite = await import(/* @vite-ignore */ pathToFileURL(resolve(VITE)).href);
    const { default: vuePlugin }: { default: (options: object) => object } = await import(
      /* @vite-ignore */ pathToFileURL(resolve(PLUGIN_VUE)).href
    );
    await vite.build({
      configFile: false,
      envFile: false,
      publicDir: false,
      logLevel: "silent",
      root: work,
      // Inline, or Vite searches upward from here and runs the project's own over the sheets (P8).
      css: { postcss: { plugins: [] } },
      build: {
        outDir: out,
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        lib: { entry: "in/index.ts", formats: ["es"] },
        rolldownOptions: {
          // Rolldown would mark each module's code with its path from the working directory (P8).
          experimental: { attachDebugInfo: "none" },
          output: {
            preserveModules: true,
            preserveModulesRoot: scratch,
            sanitizeFileName: sanitizeBelow(scratch),
            // A component's module keeps its `.vue`, as its declaration `Card.vue.d.ts` does.
            entryFileNames: ({ facadeModuleId }: { facadeModuleId: string | null }) =>
              facadeModuleId?.endsWith(".vue") ? "[name].vue.js" : "[name].js",
          },
        },
      },
      plugins: [
        KEEP_SHEETS,
        KEEP_IMPORTS,
        KEEP_ENV,
        // plugin-vue resolves `vue/compiler-sfc` from the root, the stage under `outDir`.
        vuePlugin({ script: { fs: SCRIPT_FS } }),
        PRODUCTION,
      ],
    });
    await runScript(resolve(VUE_TSC), ["-p", tsconfig], work);
    await dropDeclarationSideEffects(out);
    const sheets: OutputFile[] = files.filter((file) => !COMPILED.test(file.path));
    await writeFiles(out, sheets);
  },
};
