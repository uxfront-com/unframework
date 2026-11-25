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
} from "@unframework.dev/analyzer";
import type { StylesheetSource } from "@unframework.dev/analyzer";
import type { OutputFile } from "@unframework.dev/codegen";
import type { ModuleApi } from "@unframework.dev/ir";
import { parseModule } from "@unframework.dev/parser";
import type {
  DirectiveValueChecks,
  DirectiveValueQuery,
  ShapeQuery,
  TypeOracle,
  TypeShape,
} from "@unframework.dev/type-oracle";

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
  Omit<CompileOptions, "filename" | "resolve" | "typeOracle" | "helperRoot"> & {
    /**
     * The directory whose output tree holds `_unframework/`, the shared helper modules
     * (ADR-0121), relative to the root: one for every module, or one per module, given its file.
     * Defaults to each module's own directory, as `compile()`'s does.
     */
    helperRoot?: string | ((file: string) => string);
  };

/** What {@link Project.update} did. */
export interface ProjectUpdate {
  /** The modules compiled again, sorted, each once. */
  compiled: Array<string>;
  /** The shared `.ts` modules whose copy was added, changed or went, sorted. */
  copied: Array<string>;
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
  /**
   * The copies of shared `.ts` modules that a compiled module's result leaves out, at their paths
   * relative to it, each with its module's current text: what `compile()` adds to every output
   * tree beside the module's own files (ADR-0070). Empty for a module the project has not compiled.
   */
  copies(file: string): Array<OutputFile>;
  /** What a module read, sorted: files, and packages as `pkg:<name>` (ADR-0071). */
  dependencies(file: string): Array<string>;
  /**
   * Routes changed, created or deleted files through the project: it tells the type oracle, reads
   * again the copies among them, then checks each compiled module that depends on a file,
   * directly or not, and compiles it again only where what it read changed.
   */
  update(files: ReadonlyArray<string>): Promise<ProjectUpdate>;
}

/** One question a compile asked the project, kept so an update asks it again. */
type Call =
  | { kind: "api" | "stylesheet" | "module" | "cycle"; request: ResolveRequest }
  | { kind: "shape"; query: ShapeQuery }
  | { kind: "directive-values"; file: string; source: string; queries: Array<DirectiveValueQuery> };

/** A compiled module's node: its result, the key it was compiled under, and its edges. */
interface Compiled {
  result: CompileResult;
  key: string;
  calls: Array<Call>;
  edges: Set<string>;
  /** The shared modules its compile reached, whose copies are their own nodes. */
  copies: Set<string>;
}

/** A child's API, and the shapes it was analysed with: a parent's key holds both. */
interface Child {
  api: ModuleApi | undefined;
  shapes: Array<[string, TypeShape]>;
}

/** A child's analysis. */
interface Analysed {
  child: Child;
}

/**
 * What an import reads where its child imports, through its own children, the importer back:
 * no API (UF1205). Every edge of a cycle is cut, whatever imports the cycle first or when, so a
 * child's API depends on the graph alone (P8).
 */
const CYCLE = Symbol("cycle");

/** A child's analysis in a project's session, shared by every path that reads it meanwhile. */
interface Analysis {
  pending: Promise<Analysed | undefined>;
}

/** A project's session: the children analysed in it, each file's component imports and its text. */
interface Session {
  analyses: Map<string, Analysis>;
  imports: Map<string, Promise<Array<string>>>;
  texts: Map<string, Promise<string | undefined>>;
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
  const { helperRoot: _helperRoot, ...rest } = options;
  const compileOptions: Omit<CompileOptions, "filename" | "resolve" | "typeOracle"> = { ...rest };
  for (const key of ["root", "readFile", "typeOracle"]) {
    Reflect.deleteProperty(compileOptions, key);
  }
  const helperRootOf = (file: string) =>
    typeof options.helperRoot === "function" ? options.helperRoot(file) : options.helperRoot;
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

  /**
   * The children analysed in the current session, by file (ADR-0118): a parent reads each child
   * with its own children, so without it a child that many paths reach is read once per path.
   * A session lasts while a compile, an update or a resolve is in flight, so it sees each file
   * as it is then, and an update starts a fresh one. It reads each file's text once too: the
   * children, the cycle searches and the compile itself share it, so a compile waits on one read
   * per file, not one per path that reaches it.
   */
  let session: Session | undefined;
  let active = 0;
  const newSession = (): Session => ({ analyses: new Map(), imports: new Map(), texts: new Map() });
  const inSession = async <T>(run: () => Promise<T>, fresh = false): Promise<T> => {
    if (fresh || !session) {
      session = newSession();
    }
    active++;
    try {
      return await run();
    } finally {
      if (--active === 0) {
        session = undefined;
      }
    }
  };
  const memoOf = () => session ?? newSession();

  /**
   * A file's text, read once in the session `memo` (the current one by default), or read again
   * outside a session. A read that fails is forgotten, so the next one tries again.
   */
  const readText = (path: string | undefined, memo = session): Promise<string | undefined> => {
    if (path === undefined || !memo) {
      return readPath(path);
    }
    let text = memo.texts.get(path);
    if (!text) {
      const read = readPath(path);
      memo.texts.set(path, read);
      read.catch(() => {
        if (memo.texts.get(path) === read) {
          memo.texts.delete(path);
        }
      });
      text = read;
    }
    return text;
  };

  /** The files a child imports components from, read once in the session. */
  const importsOf = (path: string, memo: Session): Promise<Array<string>> => {
    let found = memo.imports.get(path);
    if (!found) {
      found = readText(path, memo).then((source) =>
        source === undefined
          ? []
          : componentImportNames(parseModule(path, source)).flatMap(({ specifier }) => {
              const file = joinPath(directoryOf(path), specifier);
              return file === undefined ? [] : [file];
            }),
      );
      memo.imports.set(path, found);
    }
    return found;
  };

  /** Whether `from` imports `to`, through its children's imports (or is it). */
  const reaches = async (from: string, to: string, memo: Session): Promise<boolean> => {
    const queue = [from];
    const seen = new Set(queue);
    for (let index = 0; index < queue.length; index++) {
      const each = queue[index]!;
      if (each === to) {
        return true;
      }
      for (const next of await importsOf(each, memo)) {
        if (seen.has(next)) {
          continue;
        }
        seen.add(next);
        queue.push(next);
      }
    }
    return false;
  };

  /** A child's API, with its own children's (ADR-0118), as the session reads it. */
  const resolveChild = async (request: ResolveRequest): Promise<Child | undefined> => {
    const path = joinPath(directoryOf(request.importer), request.specifier);
    const analysed = path === undefined ? undefined : await analysisOf(path, memoOf());
    if (!analysed) {
      return undefined;
    }
    const { api } = analysed.child;
    return {
      api: api && { ...api, file: relativePath(directoryOf(request.importer), path!) },
      shapes: analysed.child.shapes,
    };
  };

  /**
   * A child's analysis in the session `memo`: the one another path is reading or has read, or a
   * new one. Awaiting another path's never deadlocks: a child waits only on children outside its
   * own cycles, which `analyseChild` cuts.
   */
  const analysisOf = (path: string, memo: Session): Promise<Analysed | undefined> => {
    let entry = memo.analyses.get(path);
    if (!entry) {
      entry = {
        pending: readText(path, memo).then((source) =>
          source === undefined ? undefined : analyseChild(path, source, memo),
        ),
      };
      memo.analyses.set(path, entry);
      const created = entry;
      created.pending.catch(() => {
        if (memo.analyses.get(path) === created) {
          memo.analyses.delete(path);
        }
      });
    }
    return entry.pending;
  };

  const analyseChild = async (path: string, source: string, memo: Session): Promise<Analysed> => {
    const parsed = parseModule(path, source);
    const edges = new Set<string>();
    // The child's own children, whose APIs give a root component's fallthrough and ref tags
    // (ADR-0118): each is an edge, so an edit to it reaches the parent.
    const imports = new Map<string, ModuleApi | undefined>();
    for (const { specifier } of componentImportNames(parsed)) {
      const file = joinPath(directoryOf(path), specifier);
      const cyclic = file !== undefined && (await reaches(file, path, memo));
      const analysed = file === undefined || cyclic ? CYCLE : await analysisOf(file, memo);
      const api = analysed && analysed !== CYCLE ? analysed.child.api : undefined;
      imports.set(specifier, api && { ...api, file: relativePath(directoryOf(path), file!) });
      if (file !== undefined) {
        edges.add(file);
      }
      for (const edge of (file !== undefined && childEdges.get(file)) || []) {
        edges.add(edge);
      }
    }
    const stylesheets = new Map<string, StylesheetSource | undefined>();
    for (const specifier of stylesheetImports(parsed)) {
      const sheet = joinPath(directoryOf(path), specifier);
      if (sheet !== undefined) {
        edges.add(sheet);
      }
      const text = await readText(sheet, memo);
      stylesheets.set(specifier, text === undefined ? undefined : stylesheetSource(sheet!, text));
    }
    // Each type the child's API is declared with, as `compile()` reads its source's (ADR-0067).
    // An oracle that throws makes the resolver throw, which `compile()` reports (UF9001).
    const shapes = new Map<string, TypeShape>();
    for (const query of typeOracle ? shapeQueries(parsed) : []) {
      const shape = await typeOracle!.resolveShape(query);
      shapes.set(`${query.span.start}:${query.span.end}`, shape);
      for (const dependency of shape.dependencies) {
        edges.add(dependency);
      }
    }
    childEdges.set(path, edges);
    const key = JSON.stringify([
      source,
      ...[...stylesheets.values()].map((sheet) => sheet?.source ?? null),
      ...shapes,
      ...imports,
    ]);
    let cached = children.get(path);
    if (cached?.key !== key) {
      const analysis = analyze(parsed, {
        stylesheets,
        imports,
        ...(typeOracle ? { shapes: (span) => shapes.get(`${span.start}:${span.end}`) } : {}),
      });
      cached = { key, child: { api: analysis.api, shapes: [...shapes] } };
      children.set(path, cached);
    }
    return { child: cached.child };
  };

  const readStylesheet = async (
    request: ResolveRequest,
  ): Promise<ResolvedStylesheet | undefined> => {
    const path = joinPath(directoryOf(request.importer), request.specifier);
    const source = await readText(path);
    return source === undefined ? undefined : { file: path!, source };
  };

  const readModule = async (path: string | undefined) => {
    const source = await readText(path);
    return source === undefined ? undefined : { file: path!, source };
  };

  /**
   * A shared module and every `.ts` module it reaches (`module`), and each relative `.ts` file the
   * walk looked for and could not read: an edge too, so creating one recompiles the modules that
   * reach it.
   */
  const followModules = async (request: ResolveRequest) => {
    const first = await readModule(modulePath(request));
    if (!first) {
      return undefined;
    }
    const files = [first];
    const seen = new Set([first.file]);
    const missing: Array<string> = [];
    const resolved: ResolvedModule = { files };
    for (let index = 0; index < files.length; index++) {
      const { file, source } = files[index]!;
      const parsed = parseModule(file, source);
      const [unfollowed] = unfollowedImports(parsed);
      if (unfollowed !== undefined) {
        resolved.unresolved ??= { specifier: unfollowed, file };
      }
      for (const specifier of moduleSpecifiers(parsed)) {
        if (frameworkOf(specifier) || isAuthoringModule(specifier)) {
          resolved.framework ??= { specifier, file };
          continue;
        }
        // A package is the module's own dependency, which no output tree copies.
        if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
          continue;
        }
        const path = modulePath({ specifier, importer: file });
        if (path !== undefined && seen.has(path)) {
          continue;
        }
        const next = await readModule(path);
        if (!next) {
          resolved.unresolved ??= { specifier, file };
          if (path !== undefined) {
            missing.push(path);
          }
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
  const componentEdgesOf = async (file: string, read: Set<string>): Promise<Array<string>> => {
    const source = await readText(file);
    if (source === undefined) {
      return [];
    }
    let cached = imported.get(file);
    if (cached?.source !== source) {
      cached = { source, imports: componentImportNames(parseModule(file, source)) };
      imported.set(file, cached);
    }
    const files: Array<string> = [];
    for (const { specifier, names } of cached.imports) {
      const request = { specifier, importer: file };
      const path = joinPath(directoryOf(file), specifier);
      if (path === undefined) {
        continue;
      }
      // Every module whose API was read: a change to one may make its import a component edge.
      read.add(path);
      if (takesComponent((await resolveChild(request))?.api, names)) {
        files.push(path);
      }
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
    if (start === undefined || start === request.importer) {
      return { read: [] };
    }
    const read = new Set([start]);
    const previous = new Map([[start, request.importer]]);
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const file = queue[index]!;
      for (const next of await componentEdgesOf(file, read)) {
        if (next === request.importer) {
          const chain = [file];
          while (chain[0] !== start) {
            chain.unshift(previous.get(chain[0]!)!);
          }
          return { cycle: [request.importer, ...chain, request.importer], read: [...read] };
        }
        if (next === file || previous.has(next)) {
          continue;
        }
        previous.set(next, file);
        queue.push(next);
      }
    }
    return { read: [...read] };
  };

  const resolve: Resolver = Object.assign(
    (request: ResolveRequest) => inSession(async () => (await resolveChild(request))?.api),
    {
      stylesheet: readStylesheet,
      module: readModules,
      cycle: (request: ResolveRequest) => inSession(async () => (await findCycle(request)).cycle),
    },
  );

  /**
   * Asks one question again: its answer, what of it a dependent's key holds, and the files it
   * read, which become the asking module's edges.
   */
  const ask = async (
    call: Call,
  ): Promise<{ value: unknown; held: unknown; edges: Array<string> }> => {
    if (call.kind === "shape") {
      const shape = await typeOracle!.resolveShape(call.query);
      return { value: shape, held: shape, edges: shape.dependencies };
    }
    if (call.kind === "directive-values") {
      const answer = await typeOracle!.checkDirectiveValues!(call.file, call.source, call.queries);
      return { value: answer, held: answer, edges: answer.dependencies };
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
  /**
   * The key a module compiles under: a hash of its source and of every answer it was given. It
   * also gives the files the answers read now, which become the module's edges when the key is
   * unchanged: an import chain the answers no longer follow stops being watched.
   */
  const keyOf = async (source: string, calls: ReadonlyArray<Call>) => {
    const held: Array<unknown> = [];
    const edges = new Set<string>();
    for (const call of calls) {
      try {
        const answer = await ask(call);
        held.push(answer.held);
        for (const edge of answer.edges) {
          edges.add(edge);
        }
      } catch (error) {
        held.push({ threw: error instanceof Error ? error.message : String(error) });
        const named = namedFile(call);
        if (named !== undefined) {
          edges.add(named);
        }
      }
    }
    return { key: await hash(JSON.stringify([source, held])), edges };
  };

  const build = async (file: string, source: string): Promise<CompileResult> => {
    const calls: Array<Call> = [];
    const held: Array<unknown> = [];
    const edges = new Set<string>();
    const copied = new Set<string>();
    const reached = new Set<string>();
    const record = async (call: Call): Promise<unknown> => {
      calls.push(call);
      try {
        const answer = await ask(call);
        held.push(answer.held);
        for (const edge of answer.edges) {
          edges.add(edge);
        }
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
        const named = namedFile(call);
        if (named !== undefined) {
          edges.add(named);
        }
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
          record({ kind: "cycle", request }) as Promise<Array<string> | undefined>,
      },
    );
    const oracle: TypeOracle | undefined = typeOracle && {
      resolveShape: (query) => record({ kind: "shape", query }) as Promise<TypeShape>,
      // Only an oracle that checks values is asked to: a project on the syntactic one asks nothing.
      ...(typeOracle.checkDirectiveValues
        ? {
            checkDirectiveValues: (
              file: string,
              source: string,
              queries: Array<DirectiveValueQuery>,
            ) =>
              record({
                kind: "directive-values",
                file,
                source,
                queries,
              }) as Promise<DirectiveValueChecks>,
          }
        : {}),
      printType: (query) => typeOracle.printType(query),
      update: (changes) => typeOracle.update(changes),
      dispose: () => typeOracle.dispose(),
    };
    const helperRoot = helperRootOf(file);
    const result = await compile(source, {
      ...compileOptions,
      ...(helperRoot === undefined ? {} : { helperRoot }),
      filename: file,
      resolve: recording,
      ...(oracle ? { typeOracle: oracle } : {}),
    });
    for (const dependency of result.dependencies) {
      edges.add(dependency);
    }
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
      if (cached) {
        return cached.result;
      }
      return inSession(async () => {
        const source = await readText(file);
        if (source === undefined) {
          throw new Error(`The project has no file "${file}".`);
        }
        return build(file, source);
      });
    },
    copy: (file) => copies.get(file),
    copies: (file) =>
      [...(compiled.get(file)?.copies ?? [])].flatMap((module) => {
        const contents = copies.get(module);
        if (contents === undefined) {
          return [];
        }
        return [{ path: relativePath(directoryOf(file), module), contents }];
      }),
    dependencies: (file) => [...edgesOf(file)].toSorted(),
    update: (files) => inSession(() => updateFiles(files), true),
  };

  /**
   * Routes changed files through the project (`Project.update`), in a fresh session: what it
   * reads of a child is the child as it is now.
   */
  async function updateFiles(files: ReadonlyArray<string>): Promise<ProjectUpdate> {
    await typeOracle?.update({ files: [...files] });
    const before = new Map(copies);
    for (const file of files) {
      if (!copies.has(file)) {
        continue;
      }
      const source = await readText(file);
      if (source === undefined) {
        copies.delete(file);
      } else {
        copies.set(file, source);
      }
    }
    // The reverse edges, from every module compiled or analysed as a child.
    const dependents = new Map<string, Set<string>>();
    for (const file of new Set([...compiled.keys(), ...childEdges.keys()])) {
      for (const edge of edgesOf(file)) {
        if (!dependents.has(edge)) {
          dependents.set(edge, new Set());
        }
        dependents.get(edge)!.add(file);
      }
    }
    const affected = new Set(files);
    for (const file of affected) {
      for (const dependent of dependents.get(file) ?? []) {
        affected.add(dependent);
      }
    }
    const recompiled: Array<string> = [];
    for (const file of [...affected].toSorted()) {
      const node = compiled.get(file);
      if (!node) {
        continue;
      }
      const source = await readText(file);
      if (source === undefined) {
        compiled.delete(file);
        continue;
      }
      const { key, edges } = await keyOf(source, node.calls);
      if (key === node.key) {
        // What it read is unchanged, but where it read it may not be (ADR-0071).
        node.edges = new Set([...edges, ...node.result.dependencies]);
        node.edges.delete(file);
        continue;
      }
      await build(file, source);
      recompiled.push(file);
    }
    // A copy no compiled module reaches any more goes with its last importer.
    const live = new Set([...compiled.values()].flatMap((node) => [...node.copies]));
    for (const file of copies.keys()) {
      if (!live.has(file)) {
        copies.delete(file);
      }
    }
    const copied = [...new Set([...before.keys(), ...copies.keys()])].filter(
      (file) => before.get(file) !== copies.get(file),
    );
    return { compiled: recompiled, copied: copied.toSorted() };
  }
}

/**
 * A resolver over files (ADR-0053): a project's (ADR-0071), which reads the imported file,
 * analyses it up to its declarations, its types read through the type oracle (ADR-0067), and
 * gives its API with its `file` relative to the importer. The analysis is cached by the contents
 * of the file, its stylesheets, its shapes and its own children's APIs, so an edit that leaves
 * the API alone resolves to the same API, and the parent compiles to the same bytes. A child's
 * API is read from its declarations and its own children's APIs, which give a root component's
 * tags (ADR-0118), each child read once while a resolve is in flight: an import back to a child
 * being read on the same path reads no API, and only `cycle` reports it.
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

/**
 * The file a question named, so a question that threw is still an edge: a fix to that file
 * recompiles the module, whose UF9001 would otherwise stay until its own source changed. A shape
 * query, or a check of the directives' values, names the module's own file, which is no edge.
 */
function namedFile(call: Call): string | undefined {
  if (call.kind === "shape" || call.kind === "directive-values") {
    return undefined;
  }
  return call.kind === "module"
    ? modulePath(call.request)
    : joinPath(directoryOf(call.request.importer), call.request.specifier);
}

/** A SHA-256 of a text, in hex. */
async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
