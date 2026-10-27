import { existsSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { createSyntacticOracle, printShape } from "@unframework/type-oracle";
import type { ShapeQuery, Span, TypeOracle, TypeShape } from "@unframework/type-oracle";
import type { Node, SourceFile, TypeNode } from "typescript/unstable/ast";
import { isTypeNode } from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/sync";
import type { Program, Project, Snapshot } from "typescript/unstable/sync";

import { evaluate } from "./evaluate.ts";

/** Options for {@link createTsgoOracle}. */
export interface TsgoOracleOptions {
  /** The directory query files are relative to, read from the disk. */
  root: string;
}

/**
 * The project the checker builds over the root: every TypeScript file under it, under the
 * settings the `.uf.tsx` authoring tsconfig shares (ADR-0023). It is served to tsgo from memory,
 * so the root needs no tsconfig of its own.
 */
const COMPILER_OPTIONS = {
  strict: true,
  target: "esnext",
  module: "esnext",
  moduleResolution: "bundler",
  jsx: "preserve",
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

/**
 * The tsgo adapter (plan §5.5, ADR-0067): the syntactic adapter's shapes, with what only a
 * type-checker evaluates (conditional and mapped types, `infer`, `keyof`, `typeof`, template
 * literals with holes) evaluated by tsgo 7.0 through `typescript/unstable/sync`. Where a
 * construct comes from, what a shape depends on and which packages it may read stay the
 * syntactic adapter's, so both adapters answer every other query alike.
 *
 * The checker is a tsgo process, started by the first query that needs it and stopped by
 * {@link TypeOracle.dispose}.
 */
export function createTsgoOracle(options: TsgoOracleOptions): TypeOracle {
  const root = options.root.replace(/\/+$/, "");
  const roots = [...new Set([root, realpathSync(root)])];
  const config = `${root}/tsconfig.unframework-oracle.json`;
  const syntactic = createSyntacticOracle({
    root,
    readFile: (path) => readFile(path, "utf8").catch(() => undefined),
  });
  let api: API | undefined;
  let snapshot: Snapshot | undefined;

  /** Stops the checker's process. */
  const stop = () => {
    try {
      snapshot?.dispose();
    } finally {
      api?.close();
      snapshot = undefined;
      api = undefined;
    }
  };

  const project = (): Project => {
    api ??= new API({
      cwd: root,
      fs: {
        // `undefined` reads the real disk.
        readFile: (path) =>
          path === config
            ? JSON.stringify({ compilerOptions: COMPILER_OPTIONS, include: ["**/*"] })
            : undefined,
        fileExists: (path) => (path === config ? true : undefined),
      },
    });
    snapshot ??= api.updateSnapshot({ openProjects: [config] });
    return snapshot.getProject(config)!;
  };

  /**
   * A file as a shape names it: relative to the root, or in a package as the syntactic adapter
   * names it. A file outside the root, such as tsgo's own lib, has no name (P8).
   */
  const fileOf = (fileName: string): string | undefined => {
    const base = roots.find((each) => fileName.startsWith(`${each}/`));
    if (base === undefined) return undefined;
    const path = relative(base, fileName);
    const modules = path.lastIndexOf("node_modules/");
    return modules === -1 ? path : packageFile(base, path, modules + "node_modules/".length);
  };

  /**
   * The directory of the copy of a package the root resolves its types from, as the syntactic
   * adapter's resolver does: the package itself when it declares types, or else its `@types/`
   * package.
   */
  const rootCopy = (name: string): string | undefined => {
    const own = `${root}/node_modules/${name}`;
    if (declaresTypes(own)) return realpathOrUndefined(own);
    const typed = name.startsWith("@") ? name.slice(1).replace("/", "__") : name;
    return realpathOrUndefined(`${root}/node_modules/@types/${typed}`);
  };

  /**
   * `pkg:<name>/<path>` for the copy of a package the root resolves, and `undefined` for any
   * other copy of it, which is not surely the one the name means. A package the root resolves no
   * copy of, a dependency's own dependency, is `pkg:<name>@<version>/<path>`.
   */
  const packageFile = (base: string, path: string, at: number): string | undefined => {
    const segments = path.slice(at).split("/");
    const length = segments[0]!.startsWith("@") ? 2 : 1;
    const installed = segments.slice(0, length).join("/");
    const inner = segments.slice(length).join("/");
    // DefinitelyTyped's `@types/x` types `x`, and `@types/scope__x` types `@scope/x`.
    const typed = installed.startsWith("@types/") ? installed.slice("@types/".length) : installed;
    const name = typed.includes("__") ? `@${typed.replace("__", "/")}` : typed;
    const directory = `${base}/${path.slice(0, at)}${installed}`;
    const own = rootCopy(name);
    if (own === undefined) return `pkg:${name}@${versionOf(directory)}/${inner}`;
    return own === realpathOrUndefined(directory) ? `pkg:${name}/${inner}` : undefined;
  };

  /** Each program's files, by the names a shape gives them. */
  const names = new WeakMap<Program, Map<string, string>>();
  const namesOf = (program: Program) => {
    let known = names.get(program);
    if (!known) {
      known = new Map();
      for (const fileName of program.getSourceFileNames()) {
        const file = fileOf(fileName);
        if (file !== undefined) known.set(file, fileName);
      }
      names.set(program, known);
    }
    return known;
  };

  const resolveShape = async (query: ShapeQuery): Promise<TypeShape> => {
    const shape = await syntactic.resolveShape(query);
    // Only a construct the syntactic adapter could not evaluate needs the checker.
    if (!shape.unresolved.some((entry) => entry.reason === "unsupported")) return shape;
    const { checker, program } = project();
    const source = program.getSourceFile(`${root}/${query.file}`);
    const node = source && typeNodeAt(source, query.span);
    const type = node && checker.getTypeFromTypeNode(node);
    const nodeAt = (file: string, span: Span) => {
      const fileName = file.startsWith("pkg:") ? namesOf(program).get(file) : `${root}/${file}`;
      const written = fileName === undefined ? undefined : program.getSourceFile(fileName);
      return written && typeNodeAt(written, span);
    };
    return type ? evaluate(shape, type, { checker, fileOf, file: query.file, nodeAt }) : shape;
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
      await syntactic.update(changes);
      if (!api || !snapshot) return;
      // A package installed, removed or changed can change how any import resolves: the next
      // query that needs the checker starts a new one.
      if (changes.files.some((file) => file.startsWith("pkg:"))) return stop();
      const { program } = snapshot.getProject(config)!;
      const changed: string[] = [];
      const created: string[] = [];
      const deleted: string[] = [];
      for (const file of changes.files) {
        const path = `${root}/${file}`;
        if (!existsSync(path)) deleted.push(path);
        else if (program.getSourceFile(path)) changed.push(path);
        else created.push(path);
      }
      const next = api.updateSnapshot({ fileChanges: { changed, created, deleted } });
      snapshot.dispose();
      snapshot = next;
    },
    dispose: async () => {
      stop();
      await syntactic.dispose();
    },
  };
}

function realpathOrUndefined(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

/** Whether a package directory names its types, or holds an `index.d.ts`. */
function declaresTypes(directory: string): boolean {
  try {
    const manifest: unknown = JSON.parse(readFileSync(`${directory}/package.json`, "utf8"));
    if (
      typeof manifest === "object" &&
      manifest &&
      ("types" in manifest || "typings" in manifest || "exports" in manifest)
    ) {
      return true;
    }
  } catch {
    // No `package.json`: only an `index.d.ts` types it.
  }
  return existsSync(`${directory}/index.d.ts`);
}

/** The `version` in a package directory's `package.json`, or `""` when it has none. */
function versionOf(directory: string): string {
  try {
    const manifest: unknown = JSON.parse(readFileSync(`${directory}/package.json`, "utf8"));
    const version =
      typeof manifest === "object" && manifest && "version" in manifest && manifest.version;
    return typeof version === "string" ? version : "";
  } catch {
    return "";
  }
}

/** The outermost type node at exactly `span`. */
function typeNodeAt(source: SourceFile, span: Span): TypeNode | undefined {
  let found: TypeNode | undefined;
  const visit = (node: Node): void => {
    if (found || node.pos > span.start || node.end < span.end) return;
    if (isTypeNode(node) && node.getStart(source) === span.start && node.end === span.end) {
      found = node;
      return;
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return found;
}
