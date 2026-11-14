// The Vite configuration of the Angular test projects (the Angular+Qwik and SSR ADRs).
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ToolchainContext, ToolchainMode } from "@unframework.dev/codegen";
import type { Plugin } from "vite";
// Vite's config, with the `test` options Vitest declares on it.
import type { ViteUserConfig } from "vitest/config";

import { angularLinker, angularSsrLinker } from "./linker.ts";
import { ngtscVirtual } from "./ngtsc-virtual.ts";
import { loadCompiler, loadViteTools, packageVersion } from "./tools.ts";

/** One instance of each Angular package, wherever its importer lives (the adapters do too). */
const RUNTIME = ["@angular/core", "@angular/common", "@angular/platform-browser", "rxjs"];

/**
 * The plugins and options of an Angular project, merged after the unframework plugin:
 * `ngtscVirtual` compiles every virtual Angular module (AOT, strict templates), and Analog
 * stays in the chain as it would in an Analog app, with `jit: false` (its default under Vitest
 * is JIT). Nothing is JIT-compiled, as in production: browser projects pre-bundle the runtime
 * and link it in the dep optimizer, and SSR projects inline Angular's packages into their
 * module graph and link them there.
 */
export async function viteConfig(
  mode: ToolchainMode,
  context: ToolchainContext,
): Promise<ViteUserConfig> {
  const [compiler, tools] = await Promise.all([
    loadCompiler(context.toolchainDir),
    loadViteTools(context.toolchainDir),
  ]);
  // AOT output calls the instructions of the compiler's own release.
  const runtime = packageVersion(context.root, "@angular/core");
  if (runtime !== compiler.cli.VERSION.full) {
    throw new Error(
      `The project at ${context.root} runs @angular/core ${runtime}, but the Angular toolchain ` +
        `in ${context.toolchainDir} compiles with ${compiler.cli.VERSION.full}. Use one version.`,
    );
  }
  const plugins = [
    ngtscVirtual(compiler, context.declarations),
    ...tools
      .analog({ tsconfig: analogTsconfig(context.toolchainDir), jit: false })
      .map(sourcemapPluginOnFileNames),
  ];
  if (mode === "hydrate") {
    // A hydrate project (L12, ADR-0095) mounts in the page as a browser project does, and renders
    // in its server's SSR environment, which inlines every dependency: the SSR linker links the
    // packages there, and only there, since the page's are pre-bundled and linked already.
    return {
      plugins: [...plugins, { ...angularSsrLinker(tools), applyToEnvironment: isServer }],
      resolve: { dedupe: [...RUNTIME, "@angular/platform-server"] },
      // RxJS resolves to its CommonJS build on the server, which runs only from Node; it needs no
      // linking.
      environments: { ssr: { resolve: { external: ["rxjs"] } } },
      optimizeDeps: {
        include: ["@angular/core", "@angular/common", "@angular/platform-browser"],
        rolldownOptions: { plugins: [angularLinker(tools)] },
      },
    };
  }
  if (mode === "browser") {
    return {
      plugins,
      resolve: { dedupe: RUNTIME },
      optimizeDeps: {
        // The dependency scanner never sees the virtual modules: list what they and the mount
        // adapter import.
        include: ["@angular/core", "@angular/common", "@angular/platform-browser"],
        rolldownOptions: { plugins: [angularLinker(tools)] },
      },
    };
  }
  return {
    plugins: [...plugins, angularSsrLinker(tools)],
    resolve: { dedupe: [...RUNTIME, "@angular/platform-server"] },
    // Node would load the packages as published, partially compiled, and need the JIT compiler.
    // Vite matches the import specifier (`@angular/core`) and Vitest the resolved path.
    ssr: { noExternal: [/(?:^|\/node_modules\/)@angular\//] },
    // Analog switches a Node project to `vmThreads` unless a pool is set, which breaks isolation.
    test: { pool: "forks" },
  };
}

/** Whether an environment runs on the server: every environment but the page's. */
function isServer(environment: { name: string; config: { consumer: string } }): boolean {
  return environment.config.consumer === "server";
}

/** Analog's plugin that compiles, under Vitest, the `.ts` modules Angular did not. */
const ANALOG_SOURCEMAP_PLUGIN = "@analogjs/vitest-angular-sourcemap-plugin";

/**
 * Analog's source-map plugin with its `.ts` test applied to the file name only. Analog tests
 * the unanchored `/\.ts/` against the whole module id, so in a checkout whose path has a
 * directory containing `.ts` (`example.ts.net/…`) it compiles every module as TypeScript, and
 * the CSS of Vitest's page fails to parse, so no browser test runs. With the directories
 * removed, the decision is Analog's own on every other path. Remove this once the catalog
 * reaches an Analog whose test is anchored (3.0.0-beta.38 anchors it; 2.9.6 does not).
 */
function sourcemapPluginOnFileNames(plugin: Plugin): Plugin {
  const hook = plugin.transform;
  if (plugin.name !== ANALOG_SOURCEMAP_PLUGIN || hook === undefined) {
    return plugin;
  }
  const handler = typeof hook === "function" ? hook : hook.handler;
  const transform: typeof handler = function (code, id, options) {
    if (!/\.ts/.test(withoutDirectories(id))) {
      return;
    }
    return handler.call(this, code, id, options);
  };
  return {
    ...plugin,
    transform: typeof hook === "function" ? transform : { ...hook, handler: transform },
  };
}

/** A module id without its directories: the text after the last `/` that comes before any `?`. */
function withoutDirectories(id: string): string {
  const query = id.indexOf("?");
  const path = query === -1 ? id : id.slice(0, query);
  return id.slice(path.lastIndexOf("/") + 1);
}

/**
 * The tsconfig Analog reads: an empty program. Every Angular module of the project is virtual
 * and compiled by `ngtscVirtual` before Analog sees it, so Analog compiles nothing itself and
 * only needs a valid configuration. Written atomically, since several projects start at once.
 */
function analogTsconfig(toolchainDir: string): string {
  const file = join(toolchainDir, ".uf-tmp", "tsconfig.analog.json");
  const config = {
    compilerOptions: {
      target: "es2022",
      module: "preserve",
      moduleResolution: "bundler",
      strict: true,
      skipLibCheck: true,
    },
    files: [],
  };
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`);
  renameSync(temporary, file);
  return file;
}
