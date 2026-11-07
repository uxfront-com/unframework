import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

import type { OutputFile } from "@unframework/compiler";

import type { PackagerInput } from "./packager.ts";
import { writeFiles } from "./packager.ts";

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
 * Runs tsdown over the tree in `work/in`, one module to a file, then again for its declarations, and
 * copies its sheets to `out`. The declarations run last and apart because tsgo prints its errors to
 * standard output and fails with only an exit code, where Rolldown's error says what is wrong.
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
  const tsdown: { build(config: object): Promise<unknown> } = await import(
    /* @vite-ignore */ pathToFileURL(resolve("tsdown")).href
  );
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
  };
  for (const { extension, plugins = [] } of runs) {
    await tsdown.build({
      ...common,
      dts: false,
      outExtensions: () => ({ js: extension }),
      plugins: [KEEP_IMPORTS, ...plugins],
    });
  }
  await tsdown.build({
    ...common,
    dts: { emitDtsOnly: true },
    outExtensions: () => ({ dts: ".d.ts" }),
    plugins: [KEEP_IMPORTS],
  });
  const sheets: OutputFile[] = files.filter((file) => !SCRIPT.test(file.path));
  await writeFiles(out, sheets);
}
