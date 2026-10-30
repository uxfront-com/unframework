// The project graph (plan §5.10, ADR-0071): the modules a project compiles, the files each one
// read, and the reverse edges between them, so a change recompiles exactly its dependents, and
// stops where what a dependent read is unchanged (early cutoff). It replaces ADR-0053's file
// resolver behind `compile()`'s `resolve` option, and reports a cycle of component edges (UF1205).
import {
  analyze,
  frameworkOf,
  isAuthoringModule,
  moduleSpecifiers,
  shapeQueries,
  stylesheetImports,
  unfollowedImports,
} from "@unframework/analyzer";
import type { StylesheetSource } from "@unframework/analyzer";
import type { ModuleApi } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { ShapeQuery, TypeOracle, TypeShape } from "@unframework/type-oracle";

import { compile } from "./compile.ts";
import type { CompileOptions, CompileResult } from "./compile.ts";
import {
  componentImportNames,
  directoryOf,
  joinPath,
  modulePath,
  relativePath,
  stylesheetSource,
  takesComponent,
} from "./resolver.ts";
import type {
  FileResolverOptions,
  ResolvedModule,
  ResolvedStylesheet,
  ResolveRequest,
  Resolver,
} from "./resolver.ts";

/**
 * Options for {@link createProject}: its files, as `createFileResolver`'s, and the options each of
 * its compiles takes, but the file name and the resolver, which are the project's.
 */
export type ProjectOptions = FileResolverOptions &
  Omit<CompileOptions, "filename" | "resolve" | "typeOracle">;

/** What {@link Project.update} did. */
export interface ProjectUpdate {
  /** The modules compiled again, sorted, each once. */
  compiled: string[];
  /** The shared `.ts` modules whose copy was added, changed or went, sorted. */
  copied: string[];
}

/** A project's module graph (ADR-0071). Every file is named relative to its root. */
export interface Project {
  /**
   * The resolver its compiles read imports through (ADR-0053), for a caller that runs
   * `compile()` itself: `createFileResolver` gives it.
   */
  readonly resolve: Resolver;
  /**
   * Compiles a `.uf.tsx` or `.uf.ts` module, or gives its last result: {@link Project.update}
   * compiles it again when what it read changed. The result's outputs leave out the copies of
   * shared `.ts` modules, which belong to each module's own node: {@link Project.copy} gives them.
   */
  compile(file: string): Promise<CompileResult>;
  /**
   * The text of a shared `.ts` module that a compiled module reaches, which every output tree
   * holds unchanged (ADR-0070), or `undefined` for a file no compile copied.
   */
  copy(file: string): string | undefined;
  /** What a module read, sorted: files, and packages as `pkg:<name>` (ADR-0071). */
  dependencies(file: string): string[];
  /**
   * Routes changed, created or deleted files through the project: it tells the type oracle,
   * reads again the copies among them, then checks each compiled module that depends on a file, directly or
   * not, and compiles it again only where what it read changed.
   */
  update(files: readonly string[]): Promise<ProjectUpdate>;
}

/** One question a compile asked the project, kept so an update asks it again. */
type Call =
  | { kind: "api" | "stylesheet" | "module" | "cycle"; request: ResolveRequest }
  | { kind: "shape"; query: ShapeQuery };

/** A compiled module's node: its result, the key it was compiled under, and its edges. */
interface Compiled {
  result: CompileResult;
  key: string;
  calls: Call[];
  edges: Set<string>;
  /** The shared modules its compile reached, whose copies are their own nodes. */
  copies: Set<string>;
}

/** A child's API, and the shapes it was analysed with: a parent's key holds both. */
interface Child {
  api: ModuleApi | undefined;
  shapes: [string, TypeShape][];
}

/**
 * The project graph (ADR-0071) over the files `readFile` gives. A module's cache key is a hash of
 * its source and of everything it read through the project: its children's APIs and the shapes
 * they were analysed with, its stylesheets, the files of its shared modules, its import cycles
 * and its own types' shapes. A shared module's text is no part of it: its copy is the module's own
 * node, so an edit that changes only a copy recompiles nothing. The caller owns `typeOracle`.
 */
export function createProject(options: ProjectOptions): Project {
  const root = options.root.replace(/\/+$/, "");
  const { typeOracle } = options;
  // What each compile takes besides the project's own options.
  const compileOptions: Omit<CompileOptions, "filename" | "resolve" | "typeOracle"> = {
    ...options,
  };
  for (const key of ["root", "readFile", "typeOracle"]) Reflect.deleteProperty(compileOptions, key);
  const readPath = (path: string | undefined) =>
    path === undefined ? Promise.resolve(undefined) : options.readFile(`${root}/${path}`);

  /** Each child's analysis, by its file, with the key it was analysed under. */
  const children = new Map<string, { key: string; child: Child }>();
  /** What each child's analysis read: its stylesheets and its types' files and packages. */
  const childEdges = new Map<string, Set<string>>();
  /** Each file's `.uf.tsx` imports, by its text, which the cycle search follows. */
  const imported = new Map<
    string,
    { source: string; imports: ReturnType<typeof componentImportNames> }
  >();
  const compiled = new Map<string, Compiled>();
  const copies = new Map<string, string>();

  const resolveChild = async (request: ResolveRequest): Promise<Child | undefined> => {
    const path = joinPath(directoryOf(request.importer), request.specifier);
    const source = await readPath(path);
    if (path === undefined || source === undefined) return undefined;
    const parsed = parseModule(path, source);
    const edges = new Set<string>();
    const stylesheets = new Map<string, StylesheetSource | undefined>();
    for (const specifier of stylesheetImports(parsed)) {
      const sheet = joinPath(directoryOf(path), specifier);
      if (sheet !== undefined) edges.add(sheet);
      const text = await readPath(sheet);
      stylesheets.set(specifier, text === undefined ? undefined : stylesheetSource(sheet!, text));
    }
    // Each type the child's API is declared with, as `compile()` reads its source's (ADR-0067).
    // An oracle that throws makes the resolver throw, which `compile()` reports (UF9001).
    const shapes = new Map<string, TypeShape>();
    for (const query of typeOracle ? shapeQueries(parsed) : []) {
      const shape = await typeOracle!.resolveShape(query);
      shapes.set(`${query.span.start}:${query.span.end}`, shape);
      for (const dependency of shape.dependencies) edges.add(dependency);
    }
    childEdges.set(path, edges);
    const key = JSON.stringify([
      source,
      ...[...stylesheets.values()].map((sheet) => sheet?.source ?? null),
      ...shapes,
    ]);
    let cached = children.get(path);
    if (cached?.key !== key) {
      const analysis = analyze(parsed, {
        stylesheets,
        ...(typeOracle ? { shapes: (span) => shapes.get(`${span.start}:${span.end}`) } : {}),
      });
      cached = { key, child: { api: analysis.api, shapes: [...shapes] } };
      children.set(path, cached);
    }
    const { api } = cached.child;
    return {
      api: api && { ...api, file: relativePath(directoryOf(request.importer), path) },
      shapes: cached.child.shapes,
    };
  };

  const readStylesheet = async (
    request: ResolveRequest,
  ): Promise<ResolvedStylesheet | undefined> => {
    const path = joinPath(directoryOf(request.importer), request.specifier);
    const source = await readPath(path);
    return source === undefined ? undefined : { file: path!, source };
  };

  const readModule = async (path: string | undefined) => {
    const source = await readPath(path);
    return source === undefined ? undefined : { file: path!, source };
  };

  /**
   * A shared module and every `.ts` module it reaches (`module`), with each relative `.ts` file
   * among them it looked for and could not read: an edge too, so creating one recompiles the
   * modules that reach it.
   */
  const followModules = async (request: ResolveRequest) => {
    const first = await readModule(modulePath(request));
    if (!first) return undefined;
    const files = [first];
    const seen = new Set([first.file]);
    const missing: string[] = [];
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
          if (path !== undefined) missing.push(path);
        } else {
          seen.add(next.file);
          files.push(next);
        }
      }
    }
    return { resolved, missing };
  };

  const readModules = async (request: ResolveRequest): Promise<ResolvedModule | undefined> =>
    (await followModules(request))?.resolved;

  /**
   * The components a module imports to render, by file: its component edges (ADR-0071), each
   * read by the API of the module it imports, which the project's analysis caches by content.
   */
  const componentEdgesOf = async (file: string, read: Set<string>): Promise<string[]> => {
    const source = await readPath(file);
    if (source === undefined) return [];
    let cached = imported.get(file);
    if (cached?.source !== source) {
      cached = { source, imports: componentImportNames(parseModule(file, source)) };
      imported.set(file, cached);
    }
    const files: string[] = [];
    for (const { specifier, names } of cached.imports) {
      const request = { specifier, importer: file };
      const path = joinPath(directoryOf(file), specifier);
      if (path === undefined) continue;
      // Every module whose API was read: a change to one may make its import a component edge.
      read.add(path);
      if (takesComponent((await resolveChild(request))?.api, names)) files.push(path);
    }
    return files;
  };

  /**
   * The shortest cycle of component edges a component edge closes, from the importer back to it,
   * and every file the search read. A component that renders itself is UF1203's, not a cycle
   * (ADR-0053), and a cycle that a key, a type or a shared module closes is none (ADR-0071).
   */
  const findCycle = async (request: ResolveRequest) => {
    const start = joinPath(directoryOf(request.importer), request.specifier);
    if (start === undefined || start === request.importer) return { read: [] };
    const read = new Set([start]);
    const previous = new Map([[start, request.importer]]);
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const file = queue[index]!;
      for (const next of await componentEdgesOf(file, read)) {
        if (next === request.importer) {
          const chain = [file];
          while (chain[0] !== start) chain.unshift(previous.get(chain[0]!)!);
          return { cycle: [request.importer, ...chain, request.importer], read: [...read] };
        }
        if (next === file || previous.has(next)) continue;
        previous.set(next, file);
        queue.push(next);
      }
    }
    return { read: [...read] };
  };

  const resolve: Resolver = Object.assign(
    async (request: ResolveRequest) => (await resolveChild(request))?.api,
    {
      stylesheet: readStylesheet,
      module: readModules,
      cycle: async (request: ResolveRequest) => (await findCycle(request)).cycle,
    },
  );

  /**
   * Asks one question again: its answer, what of it a dependent's key holds, and the files it
   * read, which become the asking module's edges.
   */
  const ask = async (call: Call): Promise<{ value: unknown; held: unknown; edges: string[] }> => {
    if (call.kind === "shape") {
      const shape = await typeOracle!.resolveShape(call.query);
      return { value: shape, held: shape, edges: shape.dependencies };
    }
    const { request } = call;
    const path = joinPath(directoryOf(request.importer), request.specifier);
    if (call.kind === "api") {
      const child = await resolveChild(request);
      return { value: child?.api, held: child ?? null, edges: path === undefined ? [] : [path] };
    }
    if (call.kind === "stylesheet") {
      const sheet = await readStylesheet(request);
      return { value: sheet, held: sheet ?? null, edges: path === undefined ? [] : [path] };
    }
    if (call.kind === "module") {
      const followed = await followModules(request);
      const resolved = followed?.resolved;
      const files = resolved?.files.map(({ file }) => file) ?? [];
      const first = modulePath(request);
      return {
        value: resolved,
        // Without the texts: each copy is its module's own node.
        held: resolved ? { ...resolved, files } : null,
        edges: [...(first === undefined ? [] : [first]), ...files, ...(followed?.missing ?? [])],
      };
    }
    const { cycle, read } = await findCycle(request);
    return { value: cycle, held: cycle ?? null, edges: read };
  };

  /** The key a module compiles under: a hash of its source and of every answer it was given. */
  const keyOf = async (source: string, calls: readonly Call[]) => {
    const held: unknown[] = [];
    for (const call of calls) {
      try {
        held.push((await ask(call)).held);
      } catch (error) {
        held.push({ threw: error instanceof Error ? error.message : String(error) });
      }
    }
    return hash(JSON.stringify([source, held]));
  };

  const build = async (file: string, source: string): Promise<CompileResult> => {
    const calls: Call[] = [];
    const held: unknown[] = [];
    const edges = new Set<string>();
    const copied = new Set<string>();
    const reached = new Set<string>();
    const record = async (call: Call): Promise<unknown> => {
      calls.push(call);
      try {
        const answer = await ask(call);
        held.push(answer.held);
        for (const edge of answer.edges) edges.add(edge);
        if (call.kind === "module") {
          for (const module of (answer.value as ResolvedModule | undefined)?.files ?? []) {
            copies.set(module.file, module.source);
            reached.add(module.file);
            copied.add(relativePath(directoryOf(file), module.file));
          }
        }
        return answer.value;
      } catch (error) {
        held.push({ threw: error instanceof Error ? error.message : String(error) });
        // The file the question named, so a fix to it recompiles this module (UF9001 otherwise
        // stays until this module's own source changes).
        const named =
          call.kind === "shape"
            ? call.query.file
            : call.kind === "module"
              ? modulePath(call.request)
              : joinPath(directoryOf(call.request.importer), call.request.specifier);
        if (named !== undefined) edges.add(named);
        throw error;
      }
    };
    const recording: Resolver = Object.assign(
      (request: ResolveRequest) =>
        record({ kind: "api", request }) as Promise<ModuleApi | undefined>,
      {
        stylesheet: (request: ResolveRequest) =>
          record({ kind: "stylesheet", request }) as Promise<ResolvedStylesheet | undefined>,
        module: (request: ResolveRequest) =>
          record({ kind: "module", request }) as Promise<ResolvedModule | undefined>,
        cycle: (request: ResolveRequest) =>
          record({ kind: "cycle", request }) as Promise<string[] | undefined>,
      },
    );
    const oracle: TypeOracle | undefined = typeOracle && {
      resolveShape: (query) => record({ kind: "shape", query }) as Promise<TypeShape>,
      printType: (query) => typeOracle.printType(query),
      update: (changes) => typeOracle.update(changes),
      dispose: () => typeOracle.dispose(),
    };
    const result = await compile(source, {
      ...compileOptions,
      filename: file,
      resolve: recording,
      ...(oracle ? { typeOracle: oracle } : {}),
    });
    for (const dependency of result.dependencies) edges.add(dependency);
    edges.delete(file);
    const outputs = Object.fromEntries(
      Object.entries(result.outputs).map(([target, files]) => [
        target,
        files.filter(({ path }) => !copied.has(path)),
      ]),
    );
    const own = { ...result, outputs };
    compiled.set(file, {
      result: own,
      key: await hash(JSON.stringify([source, held])),
      calls,
      edges,
      copies: reached,
    });
    return own;
  };

  const edgesOf = (file: string) =>
    new Set([...(compiled.get(file)?.edges ?? []), ...(childEdges.get(file) ?? [])]);

  return {
    resolve,
    compile: async (file) => {
      const cached = compiled.get(file);
      if (cached) return cached.result;
      const source = await readPath(file);
      if (source === undefined) throw new Error(`The project has no file "${file}".`);
      return build(file, source);
    },
    copy: (file) => copies.get(file),
    dependencies: (file) => [...edgesOf(file)].toSorted(),
    update: async (files) => {
      await typeOracle?.update({ files: [...files] });
      const before = new Map(copies);
      for (const file of files) {
        if (!copies.has(file)) continue;
        const source = await readPath(file);
        if (source === undefined) copies.delete(file);
        else copies.set(file, source);
      }
      // The reverse edges, from every module compiled or analysed as a child.
      const dependents = new Map<string, Set<string>>();
      for (const file of new Set([...compiled.keys(), ...childEdges.keys()])) {
        for (const edge of edgesOf(file)) {
          if (!dependents.has(edge)) dependents.set(edge, new Set());
          dependents.get(edge)!.add(file);
        }
      }
      const affected = new Set(files);
      for (const file of affected) {
        for (const dependent of dependents.get(file) ?? []) affected.add(dependent);
      }
      const recompiled: string[] = [];
      for (const file of [...affected].toSorted()) {
        const node = compiled.get(file);
        if (!node) continue;
        const source = await readPath(file);
        if (source === undefined) {
          compiled.delete(file);
          continue;
        }
        if ((await keyOf(source, node.calls)) === node.key) continue;
        await build(file, source);
        recompiled.push(file);
      }
      // A copy no compiled module reaches any more goes with its last importer.
      const live = new Set([...compiled.values()].flatMap((node) => [...node.copies]));
      for (const file of copies.keys()) if (!live.has(file)) copies.delete(file);
      const copied = [...new Set([...before.keys(), ...copies.keys()])].filter(
        (file) => before.get(file) !== copies.get(file),
      );
      return { compiled: recompiled, copied: copied.toSorted() };
    },
  };
}

/**
 * A resolver over files (ADR-0053): a project's (ADR-0071), which reads the imported file,
 * analyses it up to its declarations, its types read through the type oracle (ADR-0067), and
 * gives its API with its `file` relative to the importer. The analysis is cached by the contents
 * of the file, its stylesheets and its shapes, so an edit that leaves the API alone resolves to
 * the same API, and the parent compiles to the same bytes. A child's API is read from its
 * declarations alone, never from its own `.uf.tsx` imports, so a cycle cannot make it loop: only
 * `cycle` resolves those, for their APIs.
 * Its stylesheets are read, for the scope id its API carries (ADR-0063). It reads a stylesheet for
 * `stylesheet` too, and for `module` a shared `.ts` module, a specifier without an extension
 * naming its `.ts`, and follows its relative imports through every `.ts` module they reach, each
 * read once (ADR-0070). Its `cycle` follows the component edges from an import, each a value
 * import of a component from a `.uf.tsx` module, for the shortest cycle back to the importer
 * (UF1205).
 */
export function createFileResolver(options: FileResolverOptions): Resolver {
  return createProject({ ...options, targets: [] }).resolve;
}

/** A SHA-256 of a text, in hex. */
async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
