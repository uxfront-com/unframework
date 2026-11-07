import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { OutputFile } from "@unframework/compiler";

import type { PackagerInput } from "./packager.ts";
import { dropSideEffectImports, runScript, writeFiles } from "./packager.ts";

/** What a target's tsconfig says about its JSX. */
export interface JsxOptions {
  jsx: "react-jsx" | "preserve";
  jsxImportSource: string;
}

/** One tsdown run over a target's tree. */
export interface TsdownRun {
  /** The extension of what it writes. */
  extension: ".js" | ".jsx";
  plugins?: readonly object[];
}

const SCRIPT = /\.[cm]?[jt]sx?$/;
/** What Rollup, and Rolldown after it, replace in a chunk's name. */
// oxlint-disable-next-line no-control-regex -- a helper's name starts with a null byte.
const UNSAFE_IN_A_NAME = /[\u0000-\u001F"#$%&*+,:;<=>?[\]^`{|}\u007F]/g;

/**
 * An output imports only its framework, a passed-through module and its own sheet (P7). None of
 * them is the package's to bundle, and tsdown's CSS support is a separate package this needs no
 * more of: each import stays as written, and the sheet is copied to where it points.
 */
const KEEP_IMPORTS = {
  name: "unframework:keep-imports",
  resolveId(id: string, importer: string | undefined) {
    if (importer === undefined) return null;
    const local = id.startsWith(".") || isAbsolute(id);
    return !local || id.endsWith(".css") ? { id, external: true } : null;
  },
};

/**
 * What tsdown's declarations would report, as an error. On TypeScript 7.0, rolldown-plugin-dts runs tsgo
 * with inherited output and rejects with only its exit code, so the cause would reach standard output
 * past `main`'s `io`, naming a scratch path. Its other generators throw what they find.
 */
async function checkDeclarations(tsdown: string, work: string): Promise<void> {
  const manifest = createRequire(tsdown).resolve("typescript/package.json");
  const { version, bin }: { version: string; bin: { tsc: string } } = JSON.parse(
    await readFile(manifest, "utf8"),
  );
  if (!version.startsWith("7.0")) return;
  await runScript(join(dirname(manifest), bin.tsc), ["--declaration", "--noCheck"], work);
}

/**
 * Runs tsdown over the tree in `work/in`, one module to a file, then again for its declarations, and
 * copies its sheets to `out`. A syntax error reaches the JS first, whose error names the file.
 */
export async function buildWithTsdown(
  { files, out, work, resolve }: PackagerInput,
  options: JsxOptions,
  runs: readonly TsdownRun[],
): Promise<void> {
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
        noEmit: true,
        types: [],
        ...options,
      },
      include: ["in"],
    }),
  );
  const tsdownPath = resolve("tsdown");
  const tsdown: { build(config: object): Promise<unknown> } = await import(
    /* @vite-ignore */ pathToFileURL(tsdownPath).href
  );
  const scratch = join(work, "in");
  const common = {
    config: false,
    cwd: work,
    entry: ["in/index.ts"],
    root: "in",
    unbundle: true,
    outDir: out,
    format: "esm",
    platform: "neutral",
    tsconfig: "tsconfig.json",
    clean: false,
    logLevel: "silent",
    // Off: `TSDOWN_` variables would reach the published JS, against P8.
    envPrefix: [],
    // Rolldown cleans a module's absolute path, then strips `root`, which then no longer matches
    // under a directory like `R&D`. So only what follows the scratch copy is cleaned here.
    outputOptions: {
      sanitizeFileName: (name: string) =>
        name.startsWith(scratch)
          ? scratch + name.slice(scratch.length).replace(UNSAFE_IN_A_NAME, "_")
          : name.replace(UNSAFE_IN_A_NAME, "_"),
    },
  };
  for (const { extension, plugins = [] } of runs) {
    await tsdown.build({
      ...common,
      dts: false,
      outExtensions: () => ({ js: extension }),
      plugins: [KEEP_IMPORTS, ...plugins],
    });
  }
  await checkDeclarations(tsdownPath, work);
  await tsdown.build({
    ...common,
    dts: { emitDtsOnly: true },
    outExtensions: () => ({ dts: ".d.ts" }),
    plugins: [
      KEEP_IMPORTS,
      { name: "unframework:declarations", renderChunk: dropSideEffectImports },
    ],
  });
  const sheets: OutputFile[] = files.filter((file) => !SCRIPT.test(file.path));
  await writeFiles(out, sheets);
}
