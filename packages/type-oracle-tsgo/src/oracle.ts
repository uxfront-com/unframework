import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { createSyntacticOracle, printShape } from "@unframework/type-oracle";
import type { ShapeQuery, Span, TypeOracle, TypeShape } from "@unframework/type-oracle";
import type { Node, SourceFile, TypeNode } from "typescript/unstable/ast";
import { isTypeNode } from "typescript/unstable/ast/is";
import { API } from "typescript/unstable/sync";
import type { Project, Snapshot } from "typescript/unstable/sync";

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
   * A file as a shape names it: relative to the root, or `pkg:<name>/<path>` in a package the
   * root installs. A file outside the root, such as tsgo's own lib, has no name (P8).
   */
  const fileOf = (fileName: string): string | undefined => {
    const base = roots.find((each) => fileName.startsWith(`${each}/`));
    if (base === undefined) return undefined;
    const path = relative(base, fileName);
    const modules = path.lastIndexOf("node_modules/");
    if (modules === -1) return path;
    const installed = path.slice(modules + "node_modules/".length);
    if (!installed.startsWith("@types/")) return `pkg:${installed}`;
    // DefinitelyTyped's `@types/x` types `x`, and `@types/scope__x` types `@scope/x`.
    const [name, ...rest] = installed.slice("@types/".length).split("/");
    const typed = name!.includes("__") ? `@${name!.replace("__", "/")}` : name!;
    return `pkg:${[typed, ...rest].join("/")}`;
  };

  const resolveShape = async (query: ShapeQuery): Promise<TypeShape> => {
    const shape = await syntactic.resolveShape(query);
    // Only a construct the syntactic adapter could not evaluate needs the checker.
    if (!shape.unresolved.some((entry) => entry.reason === "unsupported")) return shape;
    const { checker, program } = project();
    const source = program.getSourceFile(`${root}/${query.file}`);
    const node = source && typeNodeAt(source, query.span);
    const type = node && checker.getTypeFromTypeNode(node);
    return type ? evaluate(shape, type, { checker, fileOf, file: query.file }) : shape;
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
