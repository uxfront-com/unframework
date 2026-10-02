import type { Diagnostic } from "@unframework/diagnostics";
import { createComponent, createExport, createModule, isExportName } from "@unframework/ir";
import type { UfComponent, UfExport, UfModule } from "@unframework/ir";
import { findComponents, isComponentName } from "@unframework/parser";
import type { AST, ComponentDeclaration, ParsedModule } from "@unframework/parser";

import { Reporter } from "./context.ts";
import { frameworkOf, isAuthoringModule } from "./frameworks.ts";
import { lowerElement } from "./lower.ts";
import { syntaxError } from "./syntax.ts";

/** The result of analysing one module. */
export interface AnalyzeResult {
  /**
   * The module's IR, or `undefined` when a module-level error (syntax, imports) means no
   * component can be compiled. A component with errors is left out; its siblings stay.
   */
  module: UfModule | undefined;
  diagnostics: Diagnostic[];
}

/** Analyses a parsed `.uf.tsx` module and lowers its components into IR (passes P2 and P3). */
export function analyze(parsed: ParsedModule): AnalyzeResult {
  const reporter = new Reporter(parsed.file);
  for (const error of parsed.errors) {
    const { span, message, help, fixes } = syntaxError(error, parsed);
    reporter.report("UF1001", span, message, {
      ...(help ? { help } : {}),
      ...(fixes ? { fixes } : {}),
      related: error.labels
        .slice(1)
        .filter((label) => label.message)
        .map((label) => ({ span: label.span, message: label.message! })),
    });
  }
  if (parsed.errors.length) return { module: undefined, diagnostics: reporter.diagnostics };

  const candidates = findComponents(parsed.program);
  const componentStatements = new Set(candidates.map((candidate) => candidate.span.start));
  const context: ModuleContext = {
    source: parsed.source,
    candidates,
    exported: exportedNames(parsed.program),
    reporter,
  };
  const moduleMark = reporter.diagnostics.length;
  for (const statement of parsed.program.body) {
    if (componentStatements.has(statement.start)) continue;
    checkTopLevelStatement(statement, context);
  }
  if (reporter.hasErrorsSince(moduleMark)) {
    return { module: undefined, diagnostics: reporter.diagnostics };
  }

  const components: UfComponent[] = [];
  const exports: UfExport[] = [];
  const names = new Map<string, ComponentDeclaration>();
  for (const candidate of candidates) {
    if (!checkComponentExports(candidate, names, reporter)) continue;
    const component = analyzeComponent(candidate, reporter);
    if (!component) continue;
    components.push(component);
    for (const entry of candidate.exports) {
      exports.push({ ...createExport(entry.kind, candidate.name, entry.span), name: entry.name });
    }
  }
  if (!candidates.some((candidate) => candidate.exports.length)) {
    reporter.report("UF1101", { start: 0, end: 0 }, "This file exports no component.", {
      help: "A component is an exported PascalCase function whose last statement returns JSX.",
    });
    return { module: undefined, diagnostics: reporter.diagnostics };
  }
  exports.sort((a, b) => a.span.start - b.span.start);
  return {
    module: createModule(parsed.file, components, exports),
    diagnostics: reporter.diagnostics,
  };
}

/**
 * Checks that an exported component's files and exports can be written on every target: its
 * exported names are identifiers (consumers import a component to use it as a tag), and its
 * name differs from every other component's by more than case, since each names a file
 * (`Card.vue`, `card.ts`) and case-insensitive file systems would merge two such files.
 */
function checkComponentExports(
  candidate: ComponentDeclaration,
  names: Map<string, ComponentDeclaration>,
  reporter: Reporter,
): boolean {
  if (!candidate.exports.length) return true;
  const mark = reporter.diagnostics.length;
  for (const entry of candidate.exports) {
    if (isExportName(entry.name)) continue;
    reporter.report(
      "UF1103",
      entry.span,
      `${candidate.name} is exported as "${entry.name}", which is not an identifier.`,
      { help: `Export it under an identifier, such as \`export { ${candidate.name} }\`.` },
    );
  }
  const key = candidate.name.toLowerCase();
  const other = names.get(key);
  if (other) {
    reporter.report(
      "UF1104",
      candidate.node.id ?? candidate.span,
      `${candidate.name} and ${other.name} differ only in case, so their output files collide.`,
      {
        help: "Rename one of them.",
        related: [
          { span: spanOf(other.node.id ?? other.span), message: `${other.name} is declared here` },
        ],
      },
    );
  } else {
    names.set(key, candidate);
  }
  return !reporter.hasErrorsSince(mark);
}

function spanOf(node: { start: number; end: number }): { start: number; end: number } {
  return { start: node.start, end: node.end };
}

/** What the checks of a module's statements need to know about the module. */
interface ModuleContext {
  source: string;
  candidates: ComponentDeclaration[];
  /** The local names the module exports as values (`export { name }`, `export default name`). */
  exported: ReadonlySet<string>;
  reporter: Reporter;
}

/** The local names a module exports as values in `export { name }` and `export default name`. */
function exportedNames(program: AST.Program): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (
      statement.type === "ExportNamedDeclaration" &&
      !statement.source &&
      statement.exportKind !== "type"
    ) {
      for (const specifier of statement.specifiers) {
        if (specifier.exportKind !== "type" && specifier.local.type === "Identifier") {
          names.add(specifier.local.name);
        }
      }
    } else if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier"
    ) {
      names.add(statement.declaration.name);
    }
  }
  return names;
}

/** Checks a top-level statement that does not declare a component. */
function checkTopLevelStatement(
  statement: AST.Directive | AST.Statement,
  { source, candidates, exported, reporter }: ModuleContext,
): void {
  if (isDirective(statement)) {
    checkDirective(statement, reporter);
    return;
  }
  const fn = functionReturningJsx(statement);
  if (fn) {
    // Exported, it is meant as a component; local, it is a helper (plan §4.6).
    if (statement.type !== "FunctionDeclaration" || exported.has(fn.id!.name)) {
      reportMisnamed(fn, source, reporter);
    } else {
      reportJsxHelper(fn, reporter);
    }
    return;
  }
  switch (statement.type) {
    // A stray `;`, such as one after a function, does nothing.
    case "EmptyStatement":
      return;
    case "ImportDeclaration":
      checkImport(statement, reporter);
      return;
    case "ExportNamedDeclaration": {
      // A type-only export exports no value, only a type for consumers' type checks (M5), and
      // the targets' outputs export none yet.
      if (statement.exportKind === "type") {
        reporter.unsupported(statement, "Type-only exports are not supported yet.");
        return;
      }
      if (statement.declaration || statement.source) break;
      const typeOnly = statement.specifiers.filter((specifier) => specifier.exportKind === "type");
      for (const specifier of typeOnly) {
        reporter.unsupported(specifier, "Type-only exports are not supported yet.");
      }
      // `export { Name }` of a component is recorded by findComponents.
      const others = statement.specifiers.filter((specifier) => !typeOnly.includes(specifier));
      if (
        others.every(
          (specifier) =>
            specifier.local.type === "Identifier" &&
            candidates.some(
              (candidate) => candidate.name === (specifier.local as AST.IdentifierReference).name,
            ),
        )
      ) {
        return;
      }
      break;
    }
    case "ExportDefaultDeclaration":
      if (
        statement.declaration.type === "Identifier" &&
        candidates.some(
          (candidate) => candidate.name === (statement.declaration as AST.IdentifierReference).name,
        )
      ) {
        return;
      }
      if (statement.declaration.type === "FunctionDeclaration" && !statement.declaration.id) {
        reporter.report("UF1102", statement, "A component must be a named function.", {
          help: "Name the function in PascalCase: `export default function Greeting() { … }`.",
        });
        return;
      }
      break;
  }
  reporter.unsupported(
    statement,
    "Top-level declarations other than imports and components are not supported yet.",
  );
}

function isDirective(statement: AST.Directive | AST.Statement): statement is AST.Directive {
  return statement.type === "ExpressionStatement" && "directive" in statement;
}

/**
 * A directive. `"use strict"` changes nothing in a module, which is strict; any other belongs
 * to a framework or a bundler (`"use client"`), which the compiler does not write for a target.
 */
function checkDirective(statement: AST.Directive, reporter: Reporter): void {
  if (statement.directive === "use strict") return;
  reporter.unsupported(
    statement,
    `Directives such as ${statement.expression.raw ?? JSON.stringify(statement.directive)} are not supported yet: each target's output carries the directives its framework needs.`,
  );
}

/**
 * A top-level function that returns JSX, as a component does, but whose name does not make it
 * a component candidate (`isComponentName`).
 */
function functionReturningJsx(statement: AST.Directive | AST.Statement): AST.Function | undefined {
  const fn =
    statement.type === "FunctionDeclaration"
      ? statement
      : (statement.type === "ExportNamedDeclaration" ||
            statement.type === "ExportDefaultDeclaration") &&
          statement.declaration?.type === "FunctionDeclaration"
        ? statement.declaration
        : undefined;
  if (!fn?.id || isComponentName(fn.id.name)) return undefined;
  const body = (fn.body?.body ?? []).filter((item) => item.type !== "EmptyStatement");
  const last = body.at(-1);
  const returned = last?.type === "ReturnStatement" ? last.argument : undefined;
  return returned?.type === "JSXElement" || returned?.type === "JSXFragment" ? fn : undefined;
}

/**
 * An exported function that returns JSX under a name that is not a component's (UF1102). JSX
 * reads a tag that starts with a lower-case letter as an HTML element, and reads any other as
 * a component, whose name keeps to ASCII letters and digits because every target names files
 * after it.
 */
function reportMisnamed(fn: AST.Function, source: string, reporter: Reporter): void {
  const { name } = fn.id!;
  const pascal = name
    .split(/[_$]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
  const example = isComponentName(pascal) ? `, such as \`${pascal}\`` : "";
  // The rename is offered when the name is used nowhere else, and the new one nowhere at all;
  // it changes a named export, so it is only likely.
  const fixable =
    isComponentName(pascal) && occurrences(source, name) === 1 && occurrences(source, pascal) === 0;
  const lowerCase = /^[a-z]/.test(name);
  reporter.report(
    "UF1102",
    fn.id!,
    lowerCase
      ? `${name} returns JSX, as a component does, but a component's name is PascalCase.`
      : `${name} returns JSX, as a component does, but a component's name is PascalCase in ASCII letters and digits.`,
    {
      help: lowerCase
        ? `Name it in PascalCase${example}: JSX reads a lower-case tag as an HTML element.`
        : `Name it with ASCII letters and digits, starting with an upper-case letter${example}: every target names files after the component.`,
      ...(fixable
        ? {
            fixes: [
              {
                title: `Rename \`${name}\` to \`${pascal}\``,
                confidence: "likely" as const,
                edits: [{ span: { start: fn.id!.start, end: fn.id!.end }, text: pascal }],
              },
            ],
          }
        : {}),
    },
  );
}

/**
 * A local function that returns JSX: a helper, which is not a component, so its JSX is outside
 * every template (UF3012, plan §4.6). Making it a component is the author's call, not a rename.
 */
function reportJsxHelper(fn: AST.Function, reporter: Reporter): void {
  reporter.report(
    "UF3012",
    fn.id!,
    `${fn.id!.name} is a helper that returns JSX, and JSX can only be in a component's template: the tree the component returns, and its slot functions.`,
    {
      help: "Inline the JSX where it is used, or extract a component: an exported function with a PascalCase name.",
    },
  );
}

/** How many times an identifier is written in a source, as a whole word. */
function occurrences(source: string, identifier: string): number {
  const word = identifier.replaceAll("$", "\\$");
  const pattern = new RegExp(`(?<![\\p{ID_Continue}$])${word}(?![\\p{ID_Continue}$])`, "gu");
  return source.match(pattern)?.length ?? 0;
}

function checkImport(statement: AST.ImportDeclaration, reporter: Reporter): void {
  const specifier = statement.source.value;
  const framework = frameworkOf(specifier);
  if (framework) {
    reporter.report(
      "UF1201",
      statement.source,
      `"${specifier}" is a ${framework} module, and components are framework-free.`,
      {
        help: 'Write the component with the authoring API from "unframework" (ref, computed, watch and the define* macros); the compiler writes the framework code.',
      },
    );
    return;
  }
  if (isAuthoringModule(specifier)) return;
  if (statement.importKind === "type") return;
  if (/\.(css|scss|sass|less|styl|pcss)$/.test(specifier)) {
    reporter.unsupported(statement, "Stylesheets are not supported yet.");
    return;
  }
  reporter.unsupported(statement, "Importing modules is not supported yet.");
}

/** Checks a component's shape and lowers its returned JSX. */
function analyzeComponent(
  candidate: ComponentDeclaration,
  reporter: Reporter,
): UfComponent | undefined {
  const mark = reporter.diagnostics.length;
  const fn = candidate.node;
  const name = fn.id ?? candidate.span;
  if (!candidate.exports.length) {
    reporter.unsupported(name, `Local components such as ${candidate.name} are not supported yet.`);
    return undefined;
  }
  if (fn.generator) {
    reporter.report(
      "UF1102",
      name,
      `${candidate.name} is a generator, and a component must be a plain function.`,
    );
  }
  if (fn.async) reporter.unsupported(name, "Async components are not supported yet.");
  if (fn.typeParameters)
    reporter.unsupported(fn.typeParameters, "Generic components are not supported yet.");
  if (fn.params.length) {
    const first = fn.params[0]!;
    const last = fn.params.at(-1)!;
    reporter.unsupported({ start: first.start, end: last.end }, "Props are not supported yet.");
  }

  // A stray `;` does nothing, so `return <p />;;` still ends with its return.
  const body = (fn.body?.body ?? []).filter((statement) => statement.type !== "EmptyStatement");
  const last = body.at(-1);
  for (const statement of body.slice(0, -1)) {
    if (isDirective(statement)) checkDirective(statement, reporter);
    else reporter.unsupported(statement, "Setup code in a component's body is not supported yet.");
  }
  const returned = last?.type === "ReturnStatement" ? last.argument : undefined;
  if (!returned || (returned.type !== "JSXElement" && returned.type !== "JSXFragment")) {
    reporter.report("UF1102", last ?? name, `${candidate.name}'s last statement must return JSX.`, {
      help: "End the component with `return <element>…</element>;`.",
    });
    return undefined;
  }
  if (returned.type === "JSXFragment") {
    reporter.unsupported(returned, "Fragments (`<>…</>`) are not supported yet.");
    return undefined;
  }
  const render = lowerElement(returned, reporter);
  if (!render || reporter.hasErrorsSince(mark)) return undefined;
  return createComponent(candidate.name, render, candidate.span);
}
