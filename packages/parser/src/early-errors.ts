import type {
  BindingPattern,
  BindingRestElement,
  Directive,
  ModuleExportName,
  Program,
  Statement,
  VariableDeclaration,
} from "oxc-parser";

import type { ParseError, Span } from "./parse.ts";

interface Binding {
  name: string;
  span: Span;
  /** `var` bindings may repeat each other; every other value binding is lexical in a module. */
  kind: "var" | "lexical";
}

/**
 * The early errors of an ES module that oxc's semantic check does not report (as of 0.152):
 * a top-level name declared twice where a function, a class or an import is involved, an
 * export name used twice (two `export default`s included), and an export of a name the module
 * does not declare. Each one is a SyntaxError when the module loads, and TypeScript reports
 * it too. An error oxc already reports (same message spans) is not repeated.
 */
export function moduleEarlyErrors(
  program: Program,
  source: string,
  reported: readonly ParseError[],
): ParseError[] {
  const errors: ParseError[] = [];
  // An error already reported over the same two spans, by oxc or by an earlier rule here (an
  // exported function declared twice is also exported twice).
  const seen = (first: Span, second: Span) =>
    [...reported, ...errors].some((error) =>
      [first, second].every((at) => error.labels.some((label) => label.span.start === at.start)),
    );

  const bindings = new Map<string, Binding>();
  for (const binding of program.body.flatMap(valueBindings)) {
    const first = bindings.get(binding.name);
    if (!first) {
      bindings.set(binding.name, binding);
      continue;
    }
    if ((first.kind === "var" && binding.kind === "var") || seen(first.span, binding.span)) {
      continue;
    }
    errors.push(
      labelled(`Identifier \`${binding.name}\` has already been declared`, [
        [first.span, `\`${binding.name}\` has already been declared here`],
        [binding.span, "It can not be redeclared here"],
      ]),
    );
  }

  const declared = new Set(program.body.flatMap(declaredNames));
  const exported = new Map<string, Span>();
  for (const statement of program.body) {
    for (const entry of exportedNames(statement, source)) {
      const first = exported.get(entry.name);
      if (first && !seen(first, entry.span)) {
        errors.push(
          labelled(`Duplicated export \`${entry.name}\``, [
            [first, `\`${entry.name}\` has already been exported here`],
            [entry.span, "It can not be exported again here"],
          ]),
        );
      } else if (!first) {
        exported.set(entry.name, entry.span);
      }
    }
    if (statement.type === "ExportNamedDeclaration" && !statement.source) {
      for (const specifier of statement.specifiers) {
        const local = exportName(specifier.local);
        if (!declared.has(local)) {
          errors.push(
            labelled(`Export \`${local}\` is not defined`, [[span(specifier.local), ""]]),
          );
        }
      }
    }
  }
  return errors;
}

/** The value bindings a top-level statement declares: functions, classes, variables, imports. */
function valueBindings(statement: Directive | Statement): Binding[] {
  const declaration =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!declaration) return [];
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
      // Ambient declarations (`declare function`) and overload signatures declare no value.
      return declaration.id && !declaration.declare
        ? [{ name: declaration.id.name, span: span(declaration.id), kind: "lexical" }]
        : [];
    case "VariableDeclaration":
      return declaration.declare ? [] : variableBindings(declaration);
    case "ImportDeclaration":
      if (declaration.importKind === "type") return [];
      return declaration.specifiers
        .filter(
          (specifier) => specifier.type !== "ImportSpecifier" || specifier.importKind !== "type",
        )
        .map((specifier) => ({
          name: specifier.local.name,
          span: span(specifier.local),
          kind: "lexical" as const,
        }));
    default:
      return [];
  }
}

function variableBindings(declaration: VariableDeclaration): Binding[] {
  const kind = declaration.kind === "var" ? "var" : "lexical";
  return declaration.declarations
    .flatMap((declarator) => patternNames(declarator.id))
    .map((id) => ({ name: id.name, span: span(id), kind }));
}

function patternNames(
  pattern: BindingPattern | BindingRestElement | null,
): { name: string; start: number; end: number }[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case "Identifier":
      return [pattern];
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "RestElement":
      return patternNames(pattern.argument);
    case "ArrayPattern":
      return pattern.elements.flatMap(patternNames);
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        patternNames(property.type === "RestElement" ? property : property.value),
      );
    default:
      return [];
  }
}

/** Every name a top-level statement declares, in the value or the type space. */
function declaredNames(statement: Directive | Statement): string[] {
  const declaration =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!declaration) return [];
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "TSDeclareFunction":
    case "ClassDeclaration":
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
    case "TSEnumDeclaration":
    case "TSImportEqualsDeclaration":
      return declaration.id ? [declaration.id.name] : [];
    case "TSModuleDeclaration":
      return declaration.id.type === "Identifier" ? [declaration.id.name] : [];
    case "VariableDeclaration":
      return declaration.declarations.flatMap((item) => patternNames(item.id)).map((id) => id.name);
    case "ImportDeclaration":
      return declaration.specifiers.map((specifier) => specifier.local.name);
    default:
      return [];
  }
}

/** The value names a top-level statement exports, with the span that names each. */
function exportedNames(
  statement: Directive | Statement,
  source: string,
): { name: string; span: Span }[] {
  switch (statement.type) {
    case "ExportDefaultDeclaration": {
      if (statement.declaration.type === "TSInterfaceDeclaration") return [];
      // The span of `export default`: the declaration has no node for the keyword.
      const keyword = source.slice(statement.start, statement.declaration.start).trimEnd();
      return [
        {
          name: "default",
          span: { start: statement.start, end: statement.start + keyword.length },
        },
      ];
    }
    case "ExportAllDeclaration":
      return statement.exported && statement.exportKind !== "type"
        ? [{ name: exportName(statement.exported), span: span(statement.exported) }]
        : [];
    case "ExportNamedDeclaration": {
      if (statement.exportKind === "type") return [];
      const declaration = statement.declaration;
      if (declaration) {
        if (declaration.type === "VariableDeclaration") {
          return variableBindings(declaration).map((binding) => ({
            name: binding.name,
            span: binding.span,
          }));
        }
        // Types merge with values of the same name, so only value declarations can clash.
        if (
          (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") &&
          declaration.id
        ) {
          return [{ name: declaration.id.name, span: span(declaration.id) }];
        }
        return [];
      }
      return statement.specifiers
        .filter((specifier) => specifier.exportKind !== "type")
        .map((specifier) => ({
          name: exportName(specifier.exported),
          span: span(specifier.exported),
        }));
    }
    default:
      return [];
  }
}

/** The name of an export specifier's side: an identifier, or a string (`export { a as "b" }`). */
export function exportName(name: ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

function span(node: { start: number; end: number }): Span {
  return { start: node.start, end: node.end };
}

function labelled(message: string, labels: [Span, string][]): ParseError {
  return {
    message,
    span: labels[0]![0],
    labels: labels.map(([at, label]) => ({ span: at, message: label || undefined })),
    help: undefined,
  };
}
