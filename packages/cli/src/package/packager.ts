import { execFile } from "node:child_process";
import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import type { OutputFile } from "@unframework.dev/compiler";

/** A subpath's entry in `exports`: a path, or conditions that each hold one. */
export type SubpathExports = string | { readonly [condition: string]: SubpathExports };

/** An optional peer of the package. */
export interface PackagePeer {
  name: string;
  range: string;
}

/** What one target's packager works on. */
export interface PackagerInput {
  /** The target's files as `compile()` gave them, so with no map (ADR-0077). */
  files: readonly OutputFile[];
  /** The directory to fill, which becomes `package/<target>`. */
  out: string;
  /** A scratch directory inside the project, from which the framework resolves. */
  work: string;
  /** Resolves a module from `package.resolveFrom`. */
  resolve: (module: string) => string;
}

/** One target's line in the registry (ADR-0077). */
export interface Packager {
  /** The framework, an optional peer of the package, or its packages where there are several. */
  peer: PackagePeer | readonly PackagePeer[];
  /** What must resolve from `package.resolveFrom`, checked before anything is written (UF7008). */
  needs: readonly string[];
  /**
   * The package whose types a declaration's inferred types come from, which must be in the project.
   * tsgo and vue-tsc write declarations with `--noCheck`, so without it a return type is `any`,
   * silently.
   */
  types?: string;
  /** The target's subpath in the manifest's `exports`, or how to read it from a finished `out`. */
  exports: SubpathExports | ((out: string) => Promise<SubpathExports>);
  /** Fills `out`. What it throws is the packager's failure (UF7009). */
  run(input: PackagerInput): Promise<void>;
}

/**
 * A declaration's side-effect imports gone. One holds no types, and one a declaration keeps is an
 * error (TS2882) in a consumer with `skipLibCheck` off, since nothing declares a sheet's module there.
 */
export const dropSideEffectImports = (code: string): string =>
  code.replace(/^import "[^"]+";\n/gm, "");

/** {@link dropSideEffectImports} over every declaration a tool wrote to a directory. */
export async function dropDeclarationSideEffects(directory: string): Promise<void> {
  for await (const file of glob("**/*.d.ts", { cwd: directory })) {
    const path = join(directory, file);
    await writeFile(path, dropSideEffectImports(await readFile(path, "utf8")));
  }
}

/** In a Vite build, an output's framework and its passed-through modules stay imports (P7). */
export const KEEP_IMPORTS: object = {
  name: "unframework:keep-imports",
  enforce: "pre",
  resolveId(id: string, importer: string | undefined) {
    if (importer === undefined) return null;
    const local = id.startsWith(".") || isAbsolute(id) || id.startsWith("\0");
    return local ? null : { id, external: true };
  },
};

/**
 * `import.meta.env` stays for the app's build to read. Vite would write this build's own values into
 * the package, `VITE_` variables included (P8), and it has no option to leave them. So the name is
 * held out of its way until the chunk is done.
 */
const ENV = "import.meta.env";
const HELD_ENV = "__unframework_import_meta_env__";
export const KEEP_ENV: object = {
  name: "unframework:keep-env",
  enforce: "pre",
  transform: (code: string) => (code.includes(ENV) ? code.replaceAll(ENV, HELD_ENV) : null),
  renderChunk: (code: string) => code.replaceAll(HELD_ENV, ENV),
};

/** What Rollup, and Rolldown after it, replace in a chunk's name. */
// oxlint-disable-next-line no-control-regex -- a helper's name starts with a null byte.
const UNSAFE_IN_A_NAME = /[\u0000-\u001F"#$%&*+,:;<=>?[\]^`{|}\u007F]/g;

/**
 * Rolldown's `sanitizeFileName` for a build of the scratch copy at `scratch`, one module to a file.
 * Rolldown cleans a module's absolute path, then strips the root, which then no longer matches
 * under a directory like `R&D`. So only what follows the scratch copy is cleaned.
 */
export const sanitizeBelow =
  (scratch: string): ((name: string) => string) =>
  (name) =>
    name.startsWith(scratch)
      ? scratch + name.slice(scratch.length).replace(UNSAFE_IN_A_NAME, "_")
      : name.replace(UNSAFE_IN_A_NAME, "_");

/** The script a package's manifest names for the first of these binaries it has. */
export async function binOf(manifest: string, ...names: readonly string[]): Promise<string> {
  const { name: owner, bin }: { name: string; bin: Readonly<Record<string, string>> } = JSON.parse(
    await readFile(manifest, "utf8"),
  );
  const script = names.map((name) => bin[name]).find((path) => path !== undefined);
  if (script === undefined) throw new Error(`${owner} has no ${names.join(" or ")} binary.`);
  return join(dirname(manifest), script);
}

/** TypeScript's compiler. `@typescript/typescript6`, installed under the name `typescript`, calls it `tsc6`. */
export const tscOf = (manifest: string): Promise<string> => binOf(manifest, "tsc", "tsc6");

/**
 * Runs a tool's script in `cwd`, and gives what it warned on stderr. A failure throws what the tool
 * printed: tsc prints to stdout, and a tool that reports progress there, like ng-packagr, passes
 * `"stderr"` to skip it.
 */
export async function runScript(
  script: string,
  args: readonly string[],
  cwd: string,
  errors: "stdout" | "stderr" = "stdout",
): Promise<string> {
  const { stderr } = await promisify(execFile)(process.execPath, [script, ...args], {
    cwd,
    maxBuffer: 2 ** 28,
  }).catch((error: { stdout?: string; stderr?: string; message: string }) => {
    const printed = errors === "stderr" ? error.stderr : error.stdout || error.stderr;
    throw new Error(printed || error.message);
  });
  return stderr;
}

export async function writeFiles(directory: string, files: readonly OutputFile[]): Promise<void> {
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.contents);
  }
}
