import type { Program } from "oxc-parser";

import { indexModule, parseSource } from "./modules.ts";
import type { SourceModule } from "./modules.ts";
import { printShape } from "./print.ts";
import { resolveQuery } from "./resolve.ts";
import type { ShapeQuery, Span, TypeOracle, TypeShape } from "./types.ts";

/** Options for {@link createSyntacticOracle}. */
export interface SyntacticOracleOptions {
  /** The directory query files are relative to, as `createFileResolver`'s `root` is. */
  root: string;
  /**
   * Reads a file by its path under `root` (`root`, a `/` and the path relative to it), or gives
   * `undefined` for one that does not exist.
   */
  readFile(path: string): Promise<string | undefined>;
}

/**
 * The syntactic adapter (plan §5.5): types read from the source with oxc, without a checker.
 * It follows type literals, interfaces and aliases, local or imported from relative `.ts` and
 * `.uf.tsx` files, `extends` chains, intersections, unions and literal unions. Anything else is
 * `unresolved`, with the construct it met in `construction`. It reads only the files a query
 * needs, and keeps each parsed until {@link TypeOracle.update} names it.
 */
export function createSyntacticOracle(options: SyntacticOracleOptions): TypeOracle {
  const root = options.root.replace(/\/+$/, "");
  const loaded = new Map<string, SourceModule | null>();
  const reading = new Map<string, Promise<void>>();
  const load = (file: string) => {
    let read = reading.get(file);
    if (!read) {
      read = options.readFile(`${root}/${file}`).then((source) => {
        // An update during the read leaves the file to the next query.
        if (reading.get(file) === read) {
          loaded.set(file, source === undefined ? null : parseSource(file, source));
        }
      });
      reading.set(file, read);
    }
    return read;
  };
  const resolveShape = async (query: ShapeQuery): Promise<TypeShape> => {
    // Each round reads the files the last one needed, until resolution needs none it lacks.
    let pending = [query.file];
    for (;;) {
      await Promise.all(pending.map(load));
      const own = loaded.get(query.file);
      if (own === null) throw new Error(`Cannot read ${query.file}.`);
      const result = resolveQuery(loaded, query, true);
      if (own && !result.shape) {
        throw new Error(`No type at ${query.file}:${query.span.start}-${query.span.end}.`);
      }
      if (result.shape && !result.missing.length) return result.shape;
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
      for (const file of changes.files) {
        loaded.delete(file);
        reading.delete(file);
      }
    },
    dispose: async () => {
      loaded.clear();
      reading.clear();
    },
  };
}

/** The shapes of the types one module writes, by their spans; see {@link localShapes}. */
export type LocalShapes = (span: Span) => TypeShape | undefined;

/**
 * The syntactic adapter's in-module path: synchronous, and it reads no file. A type is followed
 * through the module's own declarations only; an imported name is `unresolved` as `external`.
 * It is meant for `analyze()` when it is given no shapes; the analyser does not call it yet.
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
