import { analyze, shapeQueries, stylesheetImports } from "@unframework/analyzer";
import type { StylesheetSource } from "@unframework/analyzer";
import { scopeStylesheet } from "@unframework/codegen";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { TypeOracle, TypeShape } from "@unframework/type-oracle";

/** What {@link compile}'s `resolve` option receives: an import's specifier, and its importer. */
export interface ResolveRequest {
  /** The specifier as written, which ends in `.uf.tsx`, or in `.css` for a stylesheet. */
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
 * Resolves an imported `.uf.tsx` module to its public API (ADR-0053). Its `stylesheet` reads a
 * component's stylesheet, `import "./Card.css"` (ADR-0063), or gives `undefined` for one that does
 * not exist: without it, no sheet is read (UF5005).
 */
export interface Resolver {
  (request: ResolveRequest): Promise<ModuleApi | undefined>;
  stylesheet?(request: ResolveRequest): Promise<ResolvedStylesheet | undefined>;
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
 * read, for the scope id its API carries (ADR-0063). It reads a stylesheet for `stylesheet` too.
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
    // One the oracle cannot read is left out, and the child's own compile reports it.
    const shapes = new Map<string, TypeShape>();
    for (const query of options.typeOracle ? shapeQueries(parsed) : []) {
      const shape = await options.typeOracle!.resolveShape(query).catch(() => undefined);
      if (shape) shapes.set(`${query.span.start}:${query.span.end}`, shape);
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
  return Object.assign(resolve, {
    stylesheet: async (request: ResolveRequest) => {
      const sheet = await read(request);
      return sheet && { file: sheet.path, source: sheet.source };
    },
  });
}

/**
 * A stylesheet as the analyser reads it: with whether its selectors use `:slotted()`, which only
 * the codegen scoper can tell, so the compiler asks it before analysis (ADR-0063).
 */
export function stylesheetSource(file: string, source: string): StylesheetSource {
  return { file, source, slotted: scopeStylesheet(file, source, "00000000").slotted };
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
