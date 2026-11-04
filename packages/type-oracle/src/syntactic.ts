import { readFileSync, realpathSync } from "node:fs";
import { dirname, relative } from "node:path";

import type { Program } from "oxc-parser";
import { ResolverFactory } from "oxc-resolver";

import { PACKAGE, indexModule, isRelative, packageName, parseSource } from "./modules.ts";
import type { SourceModule } from "./modules.ts";
import { printShape } from "./print.ts";
import { resolveQuery } from "./resolve.ts";
import type { ShapeQuery, Span, TypeOracle, TypeShape } from "./types.ts";

/** Options for {@link createSyntacticOracle}. */
export interface SyntacticOracleOptions {
  /** The directory query files are relative to, as `createFileResolver`'s `root` is. */
  root: string;
  /**
   * Reads a file by its path under `root` (`root`, a `/` and the path relative to it), or a
   * package's file by the absolute path oxc-resolver found on disk, or gives `undefined` for one
   * that does not exist.
   */
  readFile(path: string): Promise<string | undefined>;
}

/** The `version` in a package directory's `package.json`, or `""` when it has none. */
function versionOf(directory: string): string {
  try {
    const { version } = JSON.parse(readFileSync(`${directory}/package.json`, "utf8")) as {
      version?: unknown;
    };
    return typeof version === "string" ? version : "";
  } catch {
    return "";
  }
}

/** A TypeScript file, which a package's types resolve to; anything else has no types. */
const TYPESCRIPT = /\.(d\.)?[cm]?tsx?$/;

/**
 * The syntactic adapter (plan §5.5): types read from the source with oxc, without a checker.
 * It follows type literals, interfaces and aliases, local, imported from relative `.ts` and
 * `.uf.tsx` files, or from packages through their `types` and `exports`, `extends` chains,
 * intersections, unions, literal unions, the instantiation of generic declarations and the five
 * utility types. Anything else is `unresolved`, with the construct it met in `construction`. It
 * reads only the files a query needs, and keeps each parsed, and each shape, until
 * {@link TypeOracle.update} names a file the shape was read from.
 */
export function createSyntacticOracle(options: SyntacticOracleOptions): TypeOracle {
  const root = options.root.replace(/\/+$/, "");
  const loaded = new Map<string, SourceModule | null>();
  const reading = new Map<string, Promise<void>>();
  // TypeScript's bundler resolution: the `types` condition of `exports`, then `types`.
  const resolver = new ResolverFactory({
    conditionNames: ["types", "import"],
    extensions: [".d.ts", ".ts", ".tsx"],
    mainFields: ["types", "typings"],
  });
  /** Each package's file, `pkg:<name>/<path>`, by the absolute path it was read from. */
  const paths = new Map<string, string>();
  /** Each package's directory on disk, by its name. */
  const packages = new Map<string, string>();
  const resolved = new Map<string, string | null>();
  /** Each shape, by its query, with the files it was read from. */
  const shapes = new Map<string, { shape: TypeShape; files: Set<string> }>();
  // An update during a query leaves its shape uncached.
  let generation = 0;

  /** The file oxc-resolver finds for a specifier, and the directory of its package. */
  const locate = (from: string, specifier: string): { path: string; directory: string } | null => {
    const found = resolver.resolveDtsSync(from, specifier);
    if (!found.path || !TYPESCRIPT.test(found.path)) return null;
    // Its `package.json` keeps the path through `node_modules`; the file's path is the real one.
    return {
      path: found.path,
      directory: realpathSync(dirname(found.packageJsonPath ?? found.path)),
    };
  };
  const resolve = (importer: string, specifier: string): string | null => {
    const key = `${importer}\0${specifier}`;
    if (resolved.has(key)) return resolved.get(key)!;
    const inPackage = importer.startsWith(PACKAGE);
    const from = inPackage ? paths.get(importer)! : `${root}/${importer}`;
    const found = locate(from, specifier);
    let file: string | null = null;
    if (found && isRelative(specifier)) {
      // A relative specifier in a package's file stays in that package.
      const name = packageName(importer.slice(PACKAGE.length));
      const directory = packages.get(name);
      const path = directory === undefined ? ".." : relative(directory, found.path);
      if (!path.startsWith("..")) file = `${PACKAGE}${name}/${path}`;
    } else if (found) {
      // The copy of a package the root resolves owns its name, whichever query reaches it first;
      // any other copy of it is not surely the one the name means. A package the root resolves
      // no copy of, such as a dependency's own dependency under pnpm, is named by its version
      // too, as TypeScript identifies a package, so two versions keep two names in any order.
      const name = packageName(specifier);
      const owner = locate(`${root}/package.json`, specifier);
      const token = owner
        ? owner.directory === found.directory && name
        : `${name}@${versionOf(found.directory)}`;
      if (token) {
        packages.set(token, found.directory);
        file = `${PACKAGE}${token}/${relative(found.directory, found.path)}`;
      }
    }
    if (file) paths.set(file, found!.path);
    resolved.set(key, file);
    return file;
  };
  const load = (file: string) => {
    let read = reading.get(file);
    if (!read) {
      const path = file.startsWith(PACKAGE) ? paths.get(file)! : `${root}/${file}`;
      read = options.readFile(path).then((source) => {
        // An update during the read leaves the file to the next query.
        if (reading.get(file) === read) {
          loaded.set(file, source === undefined ? null : parseSource(file, source));
        }
      });
      reading.set(file, read);
    }
    return read;
  };
  const modules = { get: (file: string) => loaded.get(file), resolve };
  const resolveShape = async (query: ShapeQuery): Promise<TypeShape> => {
    const key = `${query.file}:${query.span.start}:${query.span.end}`;
    const cached = shapes.get(key);
    if (cached) return cached.shape;
    const started = generation;
    // Each round reads the files the last one needed, until resolution needs none it lacks.
    let pending = [query.file];
    for (;;) {
      await Promise.all(pending.map(load));
      const own = loaded.get(query.file);
      if (own === null) throw new Error(`Cannot read ${query.file}.`);
      const result = resolveQuery(modules, query, true);
      if (own && !result.shape) {
        throw new Error(`No type at ${query.file}:${query.span.start}-${query.span.end}.`);
      }
      if (result.shape && !result.missing.length) {
        if (generation === started) {
          shapes.set(key, { shape: result.shape, files: result.files.add(query.file) });
        }
        return result.shape;
      }
      pending = result.shape ? result.missing : [query.file];
    }
  };
  return {
    resolveShape,
    printType: async (query) => {
      // A type with unresolved parts has no text every target accepts, so none is printed.
      const shape = await resolveShape(query);
      if (shape.unresolved.length) {
        throw new Error(
          `Cannot print ${query.file}:${query.span.start}-${query.span.end}: it has unresolved parts.`,
        );
      }
      return printShape(shape);
    },
    update: async (changes) => {
      generation++;
      const changed = new Set(changes.files);
      for (const file of changes.files) {
        loaded.delete(file);
        reading.delete(file);
        if (!file.startsWith(PACKAGE)) continue;
        // A package installed, removed or changed: every file of every copy of it is read and
        // resolved again.
        const name = file.slice(PACKAGE.length);
        for (const token of packages.keys()) {
          if (token === name || token.startsWith(`${name}@`)) packages.delete(token);
        }
        for (const each of [...loaded.keys(), ...reading.keys()]) {
          if (each.startsWith(`${file}/`) || each.startsWith(`${file}@`)) {
            loaded.delete(each);
            reading.delete(each);
            changed.add(each);
          }
        }
        resolved.clear();
        resolver.clearCache();
      }
      // A shape read from a changed file is stale, and so is every shape of its dependents.
      for (const [key, entry] of shapes) {
        if ([...entry.files].some((file) => changed.has(file))) shapes.delete(key);
      }
    },
    dispose: async () => {
      generation++;
      loaded.clear();
      reading.clear();
      paths.clear();
      packages.clear();
      resolved.clear();
      shapes.clear();
      resolver.clearCache();
    },
  };
}

/** The shapes of the types one module writes, by their spans; see {@link localShapes}. */
export type LocalShapes = (span: Span) => TypeShape | undefined;

/**
 * The syntactic adapter's in-module path: synchronous, and it reads no file. A type is followed
 * through the module's own declarations only; an imported name is `unresolved` as `external`.
 * `analyze()` reads it when it is given no shapes.
 * Gives `undefined` for a span with no type.
 */
export function localShapes(
  parsed: { program: Program; source: string },
  filename: string,
): LocalShapes {
  const module = indexModule(filename, parsed.source, parsed.program);
  const modules = { get: (file: string) => (file === filename ? module : undefined) };
  const shapes = new Map<string, TypeShape | undefined>();
  return (span) => {
    const key = `${span.start}:${span.end}`;
    if (!shapes.has(key))
      shapes.set(key, resolveQuery(modules, { file: filename, span }, false).shape);
    return shapes.get(key);
  };
}
