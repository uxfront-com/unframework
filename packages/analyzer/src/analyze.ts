import type { Diagnostic } from "@unframework/diagnostics";
import {
  createComponent,
  createExport,
  createFragment,
  createModule,
  createTypeDeclaration,
  isExportName,
} from "@unframework/ir";
import type { TypeDeclaration, UfComponent, UfExport, UfModule } from "@unframework/ir";
import {
  findComponents,
  findTypeDeclarations,
  isComponentName,
  typeDeclarationOf,
} from "@unframework/parser";
import type { AST, ComponentDeclaration, ParsedModule } from "@unframework/parser";

import { Reporter } from "./context.ts";
import { checkTypeDeclaration, collectTypes } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { frameworkOf, isAuthoringModule } from "./frameworks.ts";
import { containsJsx, lowerElement, lowerRootChildren, ROOT } from "./lower.ts";
import { analyzeProps } from "./props.ts";
import type { RenderContext } from "./render.ts";
import { Scopes } from "./scope.ts";
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
  const declarations = findTypeDeclarations(parsed.program);
  const types = collectTypes(declarations, candidates);
  const context: ModuleContext = {
    source: parsed.source,
    candidates,
    exported: exportedNames(parsed.program),
    reporter,
    types,
    comments: parsed.comments,
  };
  const moduleMark = reporter.diagnostics.length;
  for (const statement of parsed.program.body) {
    if (componentStatements.has(statement.start)) continue;
    checkTopLevelStatement(statement, context);
  }
  // A module-level error drops every component, but they are still checked: fixing it must
  // reveal nothing new (the harness's L1).
  const moduleErrors = reporter.hasErrorsSince(moduleMark);

  const scopes = new Scopes(parsed.program);
  const components: UfComponent[] = [];
  const exports: UfExport[] = [];
  const names = new Map<string, ComponentDeclaration>();
  for (const candidate of candidates) {
    if (!checkComponentExports(candidate, names, reporter)) continue;
    const component = analyzeComponent(candidate, parsed, types, scopes, reporter);
    if (!component) continue;
    components.push(component);
    for (const entry of candidate.exports) {
      exports.push({ ...createExport(entry.kind, candidate.name, entry.span), name: entry.name });
    }
  }
  if (moduleErrors) return { module: undefined, diagnostics: reporter.diagnostics };
  if (!candidates.some((candidate) => candidate.exports.length)) {
    reporter.report("UF1101", { start: 0, end: 0 }, "This file exports no component.", {
      help: "A component is an exported PascalCase function whose last statement returns JSX.",
    });
    return { module: undefined, diagnostics: reporter.diagnostics };
  }
  exports.sort((a, b) => a.span.start - b.span.start);
  return {
    module: createModule(
      parsed.file,
      components,
      exports,
      moduleTypes(components, types, parsed.source),
    ),
    diagnostics: reporter.diagnostics,
  };
}

/**
 * The type declarations the components' outputs declare (ADR-0034): each one some lowered
 * component's props reach, in source order, as written from `interface` or `type` on.
 */
function moduleTypes(
  components: readonly UfComponent[],
  types: ModuleTypes,
  source: string,
): TypeDeclaration[] {
  const used = new Set(components.flatMap((component) => component.types));
  return types.declarations
    .filter((declaration) => used.has(declaration.name))
    .map((declaration) =>
      createTypeDeclaration(
        declaration.name,
        declaration.exported,
        source.slice(declaration.node.start, declaration.node.end),
        spanOf(declaration.node),
      ),
    );
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
  types: ModuleTypes;
  /** The module's comments: lint directives must not reach an output. */
  comments: readonly AST.Comment[];
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
  { source, candidates, exported, reporter, types, comments }: ModuleContext,
): void {
  if (isDirective(statement)) {
    checkDirective(statement, reporter);
    return;
  }
  // A props type, plain or exported (ADR-0034).
  if (typeDeclarationOf(statement)) {
    const declaration = types.declarations.find((item) => item.span.start === statement.start);
    if (declaration) checkTypeDeclaration(declaration, types, source, comments, reporter);
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
      // A type-only export list exports no value, only types for consumers' type checks (M5),
      // and the targets' outputs export none on their own yet. (`export interface` and
      // `export type X = …` declare a props type, above.)
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
  if (statement.importKind === "type") {
    reporter.unsupported(
      statement,
      "Importing types from other modules is not supported yet: props types from other modules land in M5.",
      { help: "Declare the props type in this module." },
    );
    return;
  }
  if (/\.(css|scss|sass|less|styl|pcss)$/.test(specifier)) {
    reporter.unsupported(statement, "Stylesheets are not supported yet.");
    return;
  }
  reporter.unsupported(statement, "Importing modules is not supported yet.");
}

/** Checks a component's shape, its props and its setup, and lowers its returned JSX. */
function analyzeComponent(
  candidate: ComponentDeclaration,
  parsed: ParsedModule,
  types: ModuleTypes,
  scopes: Scopes,
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
  const props = analyzeProps(fn, types, parsed.source, parsed.comments, reporter);

  // A stray `;` does nothing, so `return <p />;;` still ends with its return.
  const body = (fn.body?.body ?? []).filter((statement) => statement.type !== "EmptyStatement");
  const last = body.at(-1);
  for (const statement of body.slice(0, -1)) checkSetup(statement, reporter);
  const returned = last?.type === "ReturnStatement" ? last.argument : undefined;
  const render: RenderContext = {
    source: parsed.source,
    reporter,
    scopes,
    types: types.table,
    component: fn,
    props: props.byName,
    propsByDeclaration: props.byDeclaration,
    propsObject: props.object,
    loopVariables: new Map(),
    enclosing: [],
    bindings: [...props.bindings],
    comments: parsed.comments,
  };
  if (!returned || (returned.type !== "JSXElement" && returned.type !== "JSXFragment")) {
    if (returned && containsJsx(returned) && returned.type !== "ArrowFunctionExpression") {
      rootExpression(candidate, returned, render);
    } else {
      reporter.report(
        "UF1102",
        last ?? name,
        `${candidate.name}'s last statement must return JSX.`,
        {
          help: "End the component with `return <element>…</element>;`.",
        },
      );
    }
    return undefined;
  }
  let root: UfComponent["render"] | undefined;
  if (returned.type === "JSXFragment") {
    const children = lowerRootChildren(returned, render);
    if (!children.length && !reporter.hasErrorsSince(mark)) {
      reporter.report(
        "UF1102",
        returned,
        `${candidate.name} renders nothing: its fragment is empty.`,
        {
          help: "Return the elements the component renders.",
        },
      );
    }
    root = children.length ? createFragment(children, spanOf(returned)) : undefined;
  } else {
    root = lowerElement(returned, ROOT, render).element;
  }
  if (!root || props.failed || reporter.hasErrorsSince(mark)) return undefined;
  return createComponent(
    candidate.name,
    root,
    candidate.span,
    props.props,
    props.propsParameter,
    props.types,
    render.bindings.toSorted((a, b) => a.span.start - b.span.start),
  );
}

/**
 * A component that returns a conditional or a list (UF1102): a component's root is an element or
 * a fragment. The likely fix wraps it in `<>…</>`, which renders the same; its content is still
 * checked, so the fix reveals nothing new.
 */
function rootExpression(
  candidate: ComponentDeclaration,
  returned: AST.Expression,
  render: RenderContext,
): void {
  render.reporter.report(
    "UF1102",
    returned,
    `${candidate.name} returns a conditional or a list, and a component returns an element or a fragment.`,
    {
      help: "Wrap it in a fragment: `<>{…}</>`.",
      fixes: [
        {
          title: "Wrap it in a fragment",
          confidence: "likely",
          // Two insertions, so the fixes inside it still apply.
          edits: [
            { span: { start: returned.start, end: returned.start }, text: "<>{" },
            { span: { start: returned.end, end: returned.end }, text: "}</>" },
          ],
        },
      ],
    },
  );
  lowerRootChildren(returned, render);
}

/**
 * A statement before the component's return: setup code, which lands in M2. A variable that
 * holds JSX is JSX outside the template (UF3012), which stays so once setup code lands.
 */
function checkSetup(statement: AST.Directive | AST.Statement, reporter: Reporter): void {
  if (isDirective(statement)) {
    checkDirective(statement, reporter);
    return;
  }
  if (statement.type === "VariableDeclaration") {
    const jsx = statement.declarations.filter((declarator) => containsJsx(declarator.init));
    for (const declarator of jsx) {
      reporter.report(
        "UF3012",
        declarator.init!,
        "JSX cannot be kept in a variable: Vue's, Svelte's and Angular's templates have no counterpart for it.",
        { help: "Write the JSX where it renders, in the returned tree, or extract a component." },
      );
    }
    if (jsx.length) return;
  }
  reporter.unsupported(
    statement,
    "Setup code in a component's body is not supported yet: it lands in M2.",
  );
}
