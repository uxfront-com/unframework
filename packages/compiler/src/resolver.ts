import { isSharedModuleSpecifier } from "@unframework/analyzer";
import type { StylesheetSource } from "@unframework/analyzer";
import { scopeStylesheet } from "@unframework/codegen";
import type { ModuleApi } from "@unframework/ir";
import type { TypeOracle } from "@unframework/type-oracle";

/** What {@link compile}'s `resolve` option receives: an import's specifier, and its importer. */
export interface ResolveRequest {
  /**
   * The specifier as written, which ends in `.uf.tsx`, in `.css` for a stylesheet, or names a
   * shared `.ts` module, with its extension or without one.
   */
  specifier: string;
  /** The importing file's `filename`, as `compile()` was given it. */
  importer: string;
}

/** A stylesheet a resolver read (ADR-0063). */
export interface ResolvedStylesheet {
  /** The sheet's file, named as `compile()`'s `filename` is: diagnostics in the sheet name it. */
  file: string;
  /** The sheet's text. */
  source: string;
}

/**
 * A shared `.ts` module a resolver read (ADR-0070), with every relative `.ts` module it reaches:
 * each output tree holds a copy of each, unchanged.
 */
export interface ResolvedModule {
  /**
   * The module, then each module it reaches, in the order the resolver first reached them: each
   * file named as `compile()`'s `filename` is, and its text.
   */
  files: { file: string; source: string }[];
  /** The first import of a framework or `unframework` they make, and its file (UF1204). */
  framework?: { specifier: string; file: string };
  /**
   * The first relative import among them the resolver could not read, or the first load it
   * cannot follow (an `import()` of no string, `import.meta.glob`), as written, and its file
   * (UF1202).
   */
  unresolved?: { specifier: string; file: string };
}

/**
 * Resolves an imported `.uf.tsx` module to its public API (ADR-0053). Its `stylesheet` reads a
 * component's stylesheet, `import "./Card.css"` (ADR-0063), or gives `undefined` for one that does
 * not exist: without it, no sheet is read (UF5005). Its `module` reads a shared `.ts` module and
 * the modules it reaches (ADR-0070), or gives `undefined` for one that does not exist: without it,
 * a value import of one is UF1202. Its `cycle` gives the files of the import cycle an import
 * closes, from the importer back to it, or `undefined` where there is none (UF1205, ADR-0071):
 * without it, no cycle is found.
 */
export interface Resolver {
  (request: ResolveRequest): Promise<ModuleApi | undefined>;
  stylesheet?(request: ResolveRequest): Promise<ResolvedStylesheet | undefined>;
  module?(request: ResolveRequest): Promise<ResolvedModule | undefined>;
  cycle?(request: ResolveRequest): Promise<string[] | undefined>;
}

/** Options for `createFileResolver`, and the files of `createProject` (ADR-0071). */
export interface FileResolverOptions {
  /**
   * The directory the importers' file names are relative to, as `compile()`'s `filename` is. A
   * file name or an import may leave it (`../packages/ui/B.uf.tsx`): `readFile` decides what may
   * be read.
   */
  root: string;
  /**
   * Reads a file by its path under `root` (`root`, a `/` and the path relative to it), or gives
   * `undefined` for one that does not exist.
   */
  readFile(path: string): Promise<string | undefined>;
  /**
   * The type oracle a child's declarations are read through (ADR-0067), over the same `root`: a
   * prop, event, slot or model whose type the child imports, extends or builds with a utility
   * type reaches the parent's API, which also resolves the literals behind an alias (UF3039).
   * Without it, a child's types are read from its own module alone (`localShapes`), and what it
   * imports is unresolved. The caller owns it, and disposes of it.
   */
  typeOracle?: TypeOracle;
}

/** A shared module's file: the specifier as written, or with `.ts` where it has no extension. */
export function modulePath(request: ResolveRequest): string | undefined {
  return isSharedModuleSpecifier(request.specifier)
    ? joinPath(
        directoryOf(request.importer),
        request.specifier.endsWith(".ts") ? request.specifier : `${request.specifier}.ts`,
      )
    : undefined;
}

/**
 * A stylesheet as the analyser reads it: with whether its selectors use `:slotted()`, which only
 * the codegen scoper can tell, so the compiler asks it before analysis (ADR-0063).
 */
export function stylesheetSource(file: string, source: string): StylesheetSource {
  return { file, source, slotted: scopeStylesheet(file, source, "00000000").slotted };
}

/** The directory part of a forward-slashed path: `""` for a file at the root. */
export function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/**
 * `specifier` joined to `directory`, normalised with forward slashes, or `undefined` when it is
 * not relative. A `..` that leaves the root stays (`../b`), and one after it adds another.
 */
export function joinPath(directory: string, specifier: string): string | undefined {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return undefined;
  const parts = directory ? directory.split("/") : [];
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

/** `path` relative to `directory`, both under one root, with forward slashes. */
export function relativePath(directory: string, path: string): string {
  const from = directory ? directory.split("/") : [];
  const to = path.split("/");
  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared++;
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/");
}
