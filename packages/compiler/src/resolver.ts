import {
  analyze,
  frameworkOf,
  isAuthoringModule,
  isSharedModuleSpecifier,
  moduleSpecifiers,
  shapeQueries,
  stylesheetImports,
  unfollowedImports,
} from "@unframework/analyzer";
import type { StylesheetSource } from "@unframework/analyzer";
import { scopeStylesheet } from "@unframework/codegen";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { TypeOracle, TypeShape } from "@unframework/type-oracle";

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
 * a value import of one is UF1202.
 */
export interface Resolver {
  (request: ResolveRequest): Promise<ModuleApi | undefined>;
  stylesheet?(request: ResolveRequest): Promise<ResolvedStylesheet | undefined>;
  module?(request: ResolveRequest): Promise<ResolvedModule | undefined>;
}

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
  /**
   * The type oracle a child's declarations are read through (ADR-0067), over the same `root`: a
   * prop, event, slot or model whose type the child imports, extends or builds with a utility
   * type reaches the parent's API, which also resolves the literals behind an alias (UF3039).
   * Without it, a child's types are read from its own module alone (`localShapes`), and what it
   * imports is unresolved. The caller owns it, and disposes of it.
   */
  typeOracle?: TypeOracle;
}

/**
 * A resolver over files (ADR-0053): it reads the imported file, analyses it up to its
 * declarations, its types read through the type oracle (ADR-0067), and gives its API with its
 * `file` relative to the importer. The analysis is cached by the contents of the file, its
 * stylesheets and its shapes, so an edit that leaves the API alone resolves to the same API, and
 * the parent compiles to the same bytes. A child's own `.uf.tsx` imports are never resolved: its
 * API is read from its declarations alone, so a cycle cannot make it loop. Its stylesheets are
 * read, for the scope id its API carries (ADR-0063). It reads a stylesheet for `stylesheet` too,
 * and for `module` a shared `.ts` module, a specifier without an extension naming its `.ts`, and
 * follows its relative imports through every `.ts` module they reach, each read once (ADR-0070).
 * M5's project graph replaces it behind the same option (§5.10).
 */
export function createFileResolver(options: FileResolverOptions): Resolver {
  const root = options.root.replace(/\/+$/, "");
  const read = async (request: ResolveRequest) => {
    const path = joinPath(directoryOf(request.importer), request.specifier);
    if (path === undefined) return undefined;
    const source = await options.readFile(`${root}/${path}`);
    return source === undefined ? undefined : { path, source };
  };
  const cache = new Map<string, { key: string; api: ModuleApi | undefined }>();
  const resolve = async (request: ResolveRequest) => {
    const child = await read(request);
    if (!child) return undefined;
    const parsed = parseModule(child.path, child.source);
    const stylesheets = new Map<string, StylesheetSource | undefined>();
    for (const specifier of stylesheetImports(parsed)) {
      const sheet = await read({ specifier, importer: child.path });
      stylesheets.set(specifier, sheet && stylesheetSource(sheet.path, sheet.source));
    }
    // Each type the child's API is declared with, as `compile()` reads its source's (ADR-0067).
    // An oracle that throws makes the resolver throw, which `compile()` reports (UF9001).
    const shapes = new Map<string, TypeShape>();
    for (const query of options.typeOracle ? shapeQueries(parsed) : []) {
      shapes.set(
        `${query.span.start}:${query.span.end}`,
        await options.typeOracle!.resolveShape(query),
      );
    }
    const key = JSON.stringify([
      child.source,
      ...[...stylesheets.values()].map((sheet) => sheet?.source ?? null),
      ...shapes,
    ]);
    let cached = cache.get(child.path);
    if (cached?.key !== key) {
      const analysis = analyze(parsed, {
        stylesheets,
        ...(options.typeOracle
          ? { shapes: (span) => shapes.get(`${span.start}:${span.end}`) }
          : {}),
      });
      cached = { key, api: analysis.api };
      cache.set(child.path, cached);
    }
    return (
      cached.api && { ...cached.api, file: relativePath(directoryOf(request.importer), child.path) }
    );
  };
  const readModule = async (path: string | undefined) => {
    const source = path === undefined ? undefined : await options.readFile(`${root}/${path}`);
    return source === undefined ? undefined : { file: path!, source };
  };
  return Object.assign(resolve, {
    stylesheet: async (request: ResolveRequest) => {
      const sheet = await read(request);
      return sheet && { file: sheet.path, source: sheet.source };
    },
    module: async (request: ResolveRequest): Promise<ResolvedModule | undefined> => {
      const first = await readModule(modulePath(request));
      if (!first) return undefined;
      const files = [first];
      const seen = new Set([first.file]);
      const resolved: ResolvedModule = { files };
      for (let index = 0; index < files.length; index++) {
        const { file, source } = files[index]!;
        const parsed = parseModule(file, source);
        const [unfollowed] = unfollowedImports(parsed);
        if (unfollowed !== undefined) resolved.unresolved ??= { specifier: unfollowed, file };
        for (const specifier of moduleSpecifiers(parsed)) {
          if (frameworkOf(specifier) || isAuthoringModule(specifier)) {
            resolved.framework ??= { specifier, file };
            continue;
          }
          // A package is the module's own dependency, which no output tree copies.
          if (!specifier.startsWith("./") && !specifier.startsWith("../")) continue;
          const path = modulePath({ specifier, importer: file });
          if (path !== undefined && seen.has(path)) continue;
          const next = await readModule(path);
          if (!next) {
            resolved.unresolved ??= { specifier, file };
          } else {
            seen.add(next.file);
            files.push(next);
          }
        }
      }
      return resolved;
    },
  });
}

/** A shared module's file: the specifier as written, or with `.ts` where it has no extension. */
function modulePath(request: ResolveRequest): string | undefined {
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
