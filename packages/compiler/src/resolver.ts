import { analyze } from "@unframework/analyzer";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";

/** What {@link compile}'s `resolve` option receives: an import's specifier, and its importer. */
export interface ResolveRequest {
  /** The specifier as written, which ends in `.uf.tsx`. */
  specifier: string;
  /** The importing file's `filename`, as `compile()` was given it. */
  importer: string;
}

/** Resolves an imported `.uf.tsx` module to its public API (ADR-0053). */
export type Resolver = (request: ResolveRequest) => Promise<ModuleApi | undefined>;

/** Options for {@link createFileResolver}. */
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
}

/**
 * A resolver over files (ADR-0053): it reads the imported file, analyses it up to its
 * declarations, and gives its API with its `file` relative to the importer. The analysis is
 * cached by the file's contents, so an edit that leaves the API alone resolves to the same API,
 * and the parent compiles to the same bytes. A child's own imports are never resolved: its API
 * is read from its declarations alone, so a cycle cannot make it loop. M5's project graph
 * replaces it behind the same option (§5.10).
 */
export function createFileResolver(options: FileResolverOptions): Resolver {
  const cache = new Map<string, { source: string; api: ModuleApi | undefined }>();
  return async ({ specifier, importer }) => {
    const path = joinPath(directoryOf(importer), specifier);
    if (path === undefined) return undefined;
    const source = await options.readFile(`${options.root.replace(/\/+$/, "")}/${path}`);
    if (source === undefined) return undefined;
    let cached = cache.get(path);
    if (cached?.source !== source) {
      cached = { source, api: analyze(parseModule(path, source)).api };
      cache.set(path, cached);
    }
    return cached.api && { ...cached.api, file: relativePath(directoryOf(importer), path) };
  };
}

/** The directory part of a forward-slashed path: `""` for a file at the root. */
function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/**
 * `specifier` joined to `directory`, normalised with forward slashes, or `undefined` when it is
 * not relative. A `..` that leaves the root stays (`../b`), and one after it adds another.
 */
function joinPath(directory: string, specifier: string): string | undefined {
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
function relativePath(directory: string, path: string): string {
  const from = directory ? directory.split("/") : [];
  const to = path.split("/");
  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared++;
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/");
}
