// What a module id loads: the target's output file whose extension matches the id. A `.uf.tsx`
// file with several components compiles to one such file per component, and one module id can
// only load one module, so script files are joined and other kinds are refused. A script module
// keeps the `.uf.tsx` file's exports; a markup file's module has only a default export, so a
// component exported by name is refused there too.
import type { OutputFile } from "@unframework/codegen";
import { parseModule } from "@unframework/parser";
import type { AST } from "@unframework/parser";

/** The code a module loads, or why it has none. */
export type Assembly = { code: string } | { error: string };

/** What {@link assembleModule} needs to know. */
export interface AssemblyInput {
  /** The target's name, for messages. */
  target: string;
  /** The `.uf.tsx` file as diagnostics name it. */
  filename: string;
  /** The extension of the module id, such as `.tsx` or `.vue`. */
  extension: string;
  /** Every file the target emitted for the module, in component order. */
  files: readonly OutputFile[];
  /** What the `.uf.tsx` file exports (the IR's exports): `name` is `"default"` or a name. */
  exports: readonly { name: string; local: string }[];
}

// Script modules can be joined into one module; markup files (.vue, .svelte, .astro) hold one
// component each.
const SCRIPT = /^\.tsx?$/;

/**
 * The code for a module id: the one emitted file with the id's extension, or several script
 * files joined into one module. Several markup files, and a markup component exported by name,
 * are refused until composition (M3), which settles how a markup target's module exports the
 * components of a file.
 */
export function assembleModule(input: AssemblyInput): Assembly {
  const { target, filename, extension, files, exports } = input;
  const matching = files.filter((file) => file.path.endsWith(extension));
  if (matching.length === 0) {
    const emitted = files.map((file) => file.path).join(", ") || "nothing";
    return {
      error: `The ${target} target emitted no ${extension} file for ${filename} (it emitted ${emitted}), so the module has no code. A target's module ids must end in the extension of the file it emits for each component.`,
    };
  }
  if (SCRIPT.test(extension)) {
    if (matching.length === 1) return { code: matching[0]!.contents };
    const paths = matching.map((file) => file.path).join(", ");
    return joinModules(
      matching,
      `${filename} compiles to ${matching.length} ${target} files (${paths})`,
    );
  }
  if (matching.length > 1) {
    const paths = matching.map((file) => file.path).join(", ");
    return {
      error: `${filename} compiles to ${matching.length} ${target} components (${paths}), and a ${extension} file holds one, so they cannot load as one module. Several components in one .uf.tsx file are supported for markup targets from M3 (composition); until then, give each component its own .uf.tsx file.`,
    };
  }
  // M3 (composition) decides whether a markup target's module also exports its component by
  // name, for instance through a module that re-exports the framework's default under each name.
  const named = exports.filter((entry) => entry.name !== "default");
  if (named.length > 0) {
    const names = named.map((entry) => `\`${entry.name}\``).join(", ");
    return {
      error: `${filename} exports ${names} by name, and the module of a ${extension} file has only a default export, so \`import { ${named[0]!.name} }\` would find nothing on the ${target} target. Named exports of components on markup targets come with composition (M3); until then, export the component as the default only: \`export default function ${named[0]!.local}() { … }\`.`,
    };
  }
  return { code: matching[0]!.contents };
}

/**
 * Joins script modules into one by concatenation. An import statement that an earlier file
 * already wrote, character for character, is left out; any other name that two files declare
 * or export would make the joined module invalid, so it is an error that names the clash.
 */
export function joinModules(files: readonly OutputFile[], context: string): Assembly {
  const seenImports = new Set<string>();
  const declaredBy = new Map<string, string[]>();
  const exportedBy = new Map<string, string[]>();
  const parts: string[] = [];

  for (const file of files) {
    const parsed = parseModule(file.path, file.contents);
    if (parsed.errors.length > 0) {
      return {
        error: `${context}, and ${file.path} does not parse, so they cannot be joined into one module: ${parsed.errors[0]!.message}`,
      };
    }
    const repeated: AST.ImportDeclaration[] = [];
    for (const statement of parsed.program.body) {
      if (statement.type === "ImportDeclaration") {
        const text = file.contents.slice(statement.start, statement.end);
        if (seenImports.has(text)) {
          repeated.push(statement);
          continue;
        }
        seenImports.add(text);
        for (const specifier of statement.specifiers) {
          record(declaredBy, specifier.local.name, file.path);
        }
        continue;
      }
      for (const name of declaredNames(statement)) record(declaredBy, name, file.path);
      for (const name of exportedNames(statement)) record(exportedBy, name, file.path);
    }
    parts.push(withoutStatements(file.contents, repeated));
  }

  const clashes = [
    ...clashesOf(declaredBy).map(([name, paths]) => `\`${name}\` is declared by ${paths}`),
    ...clashesOf(exportedBy).map(([name, paths]) => `\`${name}\` is exported by ${paths}`),
  ];
  if (clashes.length > 0) {
    return {
      error: `${context}, and they cannot be joined into one module: ${clashes.join("; ")}. Give each component its own .uf.tsx file.`,
    };
  }
  return { code: parts.join("\n") };
}

/** Notes that the file at `path` declares or exports `name`. */
function record(names: Map<string, string[]>, name: string, path: string): void {
  const paths = names.get(name) ?? [];
  if (!paths.includes(path)) paths.push(path);
  names.set(name, paths);
}

function clashesOf(names: Map<string, string[]>): [name: string, paths: string][] {
  return [...names]
    .filter(([, paths]) => paths.length > 1)
    .map(([name, paths]) => [name, paths.join(" and ")]);
}

/** The names a top-level statement binds in module scope (imports are handled separately). */
function declaredNames(statement: AST.Directive | AST.Statement): string[] {
  switch (statement.type) {
    case "ExportNamedDeclaration":
      return statement.declaration ? declaredNames(statement.declaration) : [];
    case "ExportDefaultDeclaration": {
      const declaration = statement.declaration;
      return (declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration" ||
        declaration.type === "TSInterfaceDeclaration") &&
        declaration.id
        ? [declaration.id.name]
        : [];
    }
    case "VariableDeclaration":
      return statement.declarations.flatMap((declarator) => patternNames(declarator.id));
    case "FunctionDeclaration":
    case "TSDeclareFunction":
    case "ClassDeclaration":
      return statement.id ? [statement.id.name] : [];
    case "TSTypeAliasDeclaration":
    case "TSInterfaceDeclaration":
    case "TSEnumDeclaration":
    case "TSImportEqualsDeclaration":
      return [statement.id.name];
    case "TSModuleDeclaration":
      return statement.id.type === "Identifier" ? [statement.id.name] : [];
    default:
      return [];
  }
}

function patternNames(pattern: AST.BindingPattern | AST.BindingRestElement): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "RestElement":
      return patternNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element ? patternNames(element) : []));
  }
  return pattern.properties.flatMap((property) =>
    patternNames(property.type === "RestElement" ? property : property.value),
  );
}

/** The names a top-level statement exports. */
function exportedNames(statement: AST.Directive | AST.Statement): string[] {
  switch (statement.type) {
    case "ExportDefaultDeclaration":
      return ["default"];
    case "ExportNamedDeclaration":
      return statement.declaration
        ? declaredNames(statement.declaration)
        : statement.specifiers.map((specifier) => moduleExportName(specifier.exported));
    case "ExportAllDeclaration":
      return statement.exported ? [moduleExportName(statement.exported)] : [];
    default:
      return [];
  }
}

function moduleExportName(name: AST.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

/** `text` without the given statements (in source order) and the line breaks that end them. */
function withoutStatements(text: string, statements: readonly AST.Span[]): string {
  let result = "";
  let from = 0;
  for (const statement of statements) {
    result += text.slice(from, statement.start);
    from = text[statement.end] === "\n" ? statement.end + 1 : statement.end;
  }
  return result + text.slice(from);
}
