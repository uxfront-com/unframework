// The Vite configuration of the Angular test projects (the Angular+Qwik and SSR ADRs).
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ToolchainContext } from "@unframework/codegen";
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
  mode: "browser" | "ssr",
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
    ngtscVirtual(compiler),
    ...tools.analog({ tsconfig: analogTsconfig(context.toolchainDir), jit: false }),
  ];
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
