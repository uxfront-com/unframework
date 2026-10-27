import { parseSync } from "oxc-parser";
import type {
  Directive,
  ModuleExportName,
  Program,
  Statement,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
} from "oxc-parser";

/** A top-level `interface` or `type` declaration. */
export type Declaration = TSInterfaceDeclaration | TSTypeAliasDeclaration;

/** What a module exports under a name: one of its own bindings, or another module's. */
export type ExportEntry =
  | { kind: "local"; local: string }
  | { kind: "reexport"; specifier: string; imported: string };

/** A module's source, AST, and the type names it declares, imports and exports. */
export interface SourceModule {
  /** The file, relative to the oracle's root. */
  file: string;
  source: string;
  program: Program;
  /**
   * Its top-level type declarations, by name, in source order. Interfaces of one name merge, as
   * in TypeScript; any other repeated name is an error the resolver reports.
   */
  declarations: Map<string, Declaration[]>;
  /** Its imported bindings, by local name. `imported` is `default` or `*` for those forms. */
  imports: Map<string, { specifier: string; imported: string }>;
  exports: Map<string, ExportEntry>;
  /** The specifiers of its `export * from "…"` statements, in source order. */
  starExports: string[];
  /** The local names it exports. */
  exported: Set<string>;
  /** Its top-level classes and enums, which the syntactic adapter does not read as types. */
  values: Set<string>;
}

/** Parses a module with oxc. `.tsx` files (`.uf.tsx` included) are TSX, others TypeScript. */
export function parseSource(file: string, source: string): SourceModule {
  const { program } = parseSync(file, source, {
    lang: file.endsWith(".tsx") ? "tsx" : "ts",
    sourceType: "module",
    astType: "ts",
    preserveParens: false,
  });
  return indexModule(file, source, program);
}

/** Indexes a parsed module's top-level type declarations, imports and exports. */
export function indexModule(file: string, source: string, program: Program): SourceModule {
  const module: SourceModule = {
    file,
    source,
    program,
    declarations: new Map(),
    imports: new Map(),
    exports: new Map(),
    starExports: [],
    exported: new Set(),
    values: new Set(),
  };
  for (const statement of program.body) {
    const declaration = declarationOf(statement);
    if (declaration) {
      const name = declaration.id.name;
      const declarations = module.declarations.get(name);
      if (declarations) declarations.push(declaration);
      else module.declarations.set(name, [declaration]);
      if (statement.type === "ExportNamedDeclaration") {
        module.exports.set(name, { kind: "local", local: name });
      }
      continue;
    }
    const value =
      (statement.type === "ExportNamedDeclaration" && !statement.source) ||
      statement.type === "ExportDefaultDeclaration"
        ? statement.declaration
        : statement;
    if ((value?.type === "ClassDeclaration" || value?.type === "TSEnumDeclaration") && value.id) {
      const name = value.id.name;
      module.values.add(name);
      if (statement.type === "ExportNamedDeclaration") {
        module.exports.set(name, { kind: "local", local: name });
      } else if (statement.type === "ExportDefaultDeclaration") {
        module.exports.set("default", { kind: "local", local: name });
      }
      continue;
    }
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        const imported =
          specifier.type === "ImportSpecifier"
            ? exportName(specifier.imported)
            : specifier.type === "ImportDefaultSpecifier"
              ? "default"
              : "*";
        module.imports.set(specifier.local.name, { specifier: statement.source.value, imported });
      }
    } else if (statement.type === "ExportNamedDeclaration" && !statement.declaration) {
      for (const specifier of statement.specifiers) {
        const local = exportName(specifier.local);
        module.exports.set(
          exportName(specifier.exported),
          statement.source
            ? { kind: "reexport", specifier: statement.source.value, imported: local }
            : { kind: "local", local },
        );
      }
    } else if (statement.type === "ExportAllDeclaration" && !statement.exported) {
      module.starExports.push(statement.source.value);
    }
  }
  for (const entry of module.exports.values()) {
    if (entry.kind === "local") module.exported.add(entry.local);
  }
  return module;
}

function declarationOf(statement: Directive | Statement): Declaration | undefined {
  const declaration =
    statement.type === "ExportNamedDeclaration" && !statement.source
      ? statement.declaration
      : statement;
  return declaration?.type === "TSInterfaceDeclaration" ||
    declaration?.type === "TSTypeAliasDeclaration"
    ? declaration
    : undefined;
}

function exportName(name: ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

/**
 * The prefix of a package's file, `pkg:<name>/<path in the package>`, and of a package itself in
 * `dependencies`, `pkg:<name>`: never an absolute path (P8).
 */
export const PACKAGE = "pkg:";

/**
 * The package a package's file belongs to, `pkg:<name>`, without the version that names a copy
 * the root does not resolve (`pkg:@scope/name@1.0.0/index.d.ts`).
 */
export function packageOf(file: string): string {
  const token = packageName(file.slice(PACKAGE.length));
  const at = token.lastIndexOf("@");
  return `${PACKAGE}${at > 0 ? token.slice(0, at) : token}`;
}

/** Whether a specifier names a file relative to its importer. */
export function isRelative(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

/** The package a bare specifier names: `@scope/name` or `name`. */
export function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/**
 * The files a relative specifier may name, in the order they are tried: the path as written
 * when it has a TypeScript extension (`./Field.uf.tsx`, `./types.ts`), and otherwise the
 * extensions TypeScript's bundler resolution tries (`./types`).
 */
export function candidates(importer: string, specifier: string): string[] {
  const slash = importer.lastIndexOf("/");
  const parts = slash === -1 ? [] : importer.slice(0, slash).split("/");
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === ".." && parts.length && parts.at(-1) !== "..") parts.pop();
    else parts.push(part);
  }
  const path = parts.join("/");
  return /\.[cm]?tsx?$/.test(path)
    ? [path]
    : [`${path}.ts`, `${path}.tsx`, `${path}.d.ts`, `${path}/index.ts`];
}
