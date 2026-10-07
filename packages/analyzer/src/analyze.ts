import type { Diagnostic, Fix } from "@unframework/diagnostics";
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
  exportName,
  findComponents,
  findTypeDeclarations,
  isComponentName,
  typeDeclarationOf,
} from "@unframework/parser";
import type { AST, ComponentExport, ParsedModule } from "@unframework/parser";

import { authoringBindings, checkAuthoringImport } from "./authoring.ts";
import type { AuthoringApi } from "./authoring.ts";
import { Reporter } from "./context.ts";
import { checkTypeDeclaration, collectTypes, setupTypes } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { frameworkOf, isAuthoringModule } from "./frameworks.ts";
import { containsJsx, lowerElement, lowerRootChildren, ROOT } from "./lower.ts";
import { analyzeProps } from "./props.ts";
import type { ComponentFunction, RenderContext, SetupBinding } from "./render.ts";
import { checkRules } from "./rules.ts";
import { Scopes } from "./scope.ts";
import { checkDirective, declareSetup, isDirective } from "./setup.ts";
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

/**
 * A component candidate: a PascalCase function declaration (`findComponents`), or an exported
 * PascalCase `const` that holds an arrow function or a function expression returning JSX, which
 * is reported (UF1102) and analysed as the declaration its fix writes.
 */
interface Candidate {
  name: string;
  node: ComponentFunction;
  /** The statement that declares it, including any `export` keywords. */
  span: { start: number; end: number };
  /** Empty for a local (non-exported) component. */
  exports: ComponentExport[];
  /** The `const` that holds a component written as a value. */
  value?: AST.VariableDeclaration;
}

/** Analyses a parsed `.uf.tsx` module and lowers its components into IR (passes P2 and P3). */
export function analyze(parsed: ParsedModule): AnalyzeResult {
  return analyzeModule(parsed);
}

/**
 * What a component's setup declares, as the analyser reads it: each binding's kinds, which never
 * reach the IR. The tests pin them against TypeScript's inference (ADR-0046).
 */
export type SetupObserver = (component: string, bindings: readonly SetupBinding[]) => void;

/** `analyze`, with an observer of each component's setup, for the tests. */
export function analyzeModule(parsed: ParsedModule, observe?: SetupObserver): AnalyzeResult {
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

  const candidates: Candidate[] = [
    ...findComponents(parsed.program),
    ...findValueComponents(parsed.program),
  ].toSorted((a, b) => a.span.start - b.span.start);
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
  const authoring = authoringBindings(parsed.program);
  const module: ComponentModule = {
    parsed,
    types,
    scopes,
    authoring,
    reporter,
    ...(observe ? { observe } : {}),
  };
  const components: UfComponent[] = [];
  const exports: UfExport[] = [];
  const names = new Map<string, Candidate>();
  for (const candidate of candidates) {
    if (!checkComponentExports(candidate, names, reporter)) continue;
    if (candidate.value) {
      // Checked as the declaration its fix writes, which then reveals nothing new.
      reportValueComponent(candidate, candidate.value, parsed, reporter);
      analyzeComponent(candidate, module);
      continue;
    }
    const component = analyzeComponent(candidate, module);
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
  candidate: Candidate,
  names: Map<string, Candidate>,
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
  candidates: Candidate[];
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
  const value = valueFunctionOf(statement);
  if (value && (statement.type === "ExportNamedDeclaration" || exported.has(value.id.name))) {
    // A PascalCase one is a candidate, reported with its fix (`reportValueComponent`).
    reporter.report(
      "UF1102",
      value.id,
      `${value.id.name} returns JSX, as a component does, but a component is a function declaration with a PascalCase name.`,
      { help: "Declare it as `export function Greeting(props: Props) { return …; }`." },
    );
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
      if (
        (statement.declaration.type === "ArrowFunctionExpression" ||
          statement.declaration.type === "FunctionExpression") &&
        returnsJsx(statement.declaration)
      ) {
        reporter.report(
          "UF1102",
          statement,
          "A component must be a named function declaration, and this is a function written as a value.",
          {
            help: "Declare it as a function named in PascalCase: `export default function Greeting(props: Props) { return …; }`.",
          },
        );
        return;
      }
      break;
  }
  reporter.unsupported(
    statement,
    "Top-level declarations other than imports and components are not supported yet.",
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
  if (isAuthoringModule(specifier)) {
    checkAuthoringImport(statement, reporter);
    return;
  }
  if (statement.importKind === "type") {
    reporter.unsupported(
      statement,
      "Importing types from other modules is not supported yet: types from other modules land in M5.",
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

/** What analysing a component needs to know about its module. */
interface ComponentModule {
  parsed: ParsedModule;
  types: ModuleTypes;
  scopes: Scopes;
  /** The module's authoring imports, by the identifier that declares each (ADR-0006). */
  authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  reporter: Reporter;
  observe?: SetupObserver;
}

/** Checks a component's shape, its props and its setup, and lowers its returned JSX. */
function analyzeComponent(candidate: Candidate, module: ComponentModule): UfComponent | undefined {
  const { parsed, types, scopes, authoring, reporter } = module;
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
  const block = fn.body?.type === "BlockStatement" ? fn.body : undefined;
  const body = (block?.body ?? []).filter((statement) => statement.type !== "EmptyStatement");
  const last = body.at(-1);
  // An arrow function's expression body is what it returns.
  const returned =
    fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement"
      ? fn.body
      : last?.type === "ReturnStatement"
        ? last.argument
        : undefined;
  // The setup (ADR-0045): every statement before the return, declared before any code is walked.
  const setup = declareSetup({
    source: parsed.source,
    reporter,
    scopes,
    types: types.table,
    comments: parsed.comments,
    authoring,
    component: fn,
    props,
    statements: body.slice(0, -1),
    returned: returned ?? undefined,
  });
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
    setup: setup.scope,
    attached: new Map(),
    bindings: [...props.bindings, ...setup.bindings],
    comments: parsed.comments,
    facts: { nestedCalls: [], getterKinds: new Map(), tickCallbacks: [], passed: new Map() },
  };
  setup.lower(render);
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
  setup.finish(render);
  // The rules that need every function's summary (ADR-0045), once everything is lowered.
  checkRules({
    name: candidate.name,
    span: candidate.span,
    render,
    setup,
    props,
    root,
    program: parsed.program,
    failed: props.failed || reporter.hasErrorsSince(mark),
  });
  module.observe?.(candidate.name, [...setup.scope.bindings.values()]);
  if (!root || props.failed || reporter.hasErrorsSince(mark)) return undefined;
  // The types its output declares: its props', its events' and its setup code's (ADR-0045).
  const names = new Set([...props.types, ...setupTypes(fn, types.table)]);
  const componentTypes = types.declarations
    .filter((declaration) => names.has(declaration.name))
    .map((declaration) => declaration.name);
  return createComponent(
    candidate.name,
    root,
    candidate.span,
    props.props,
    props.propsParameter,
    [...new Set(componentTypes)],
    render.bindings.toSorted((a, b) => a.span.start - b.span.start),
    setup.items,
    setup.emits,
  );
}

/**
 * A component that returns a conditional or a list (UF1102): a component's root is an element or
 * a fragment. The likely fix wraps it in `<>…</>`, which renders the same; its content is still
 * checked, so the fix reveals nothing new.
 */
function rootExpression(
  candidate: Candidate,
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

/** The arrow function or function expression a `const` holds, when it returns JSX. */
function valueFunctionOf(statement: AST.Directive | AST.Statement):
  | {
      declaration: AST.VariableDeclaration;
      id: AST.BindingIdentifier;
      fn: AST.ArrowFunctionExpression | AST.Function;
    }
  | undefined {
  const declaration =
    statement.type === "VariableDeclaration"
      ? statement
      : statement.type === "ExportNamedDeclaration" &&
          statement.declaration?.type === "VariableDeclaration"
        ? statement.declaration
        : undefined;
  if (declaration?.declarations.length !== 1) return undefined;
  const [declarator] = declaration.declarations;
  const fn = declarator!.init;
  if (
    declarator!.id.type !== "Identifier" ||
    (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") ||
    !returnsJsx(fn)
  ) {
    return undefined;
  }
  return { declaration, id: declarator!.id, fn };
}

/** Whether a function returns JSX: its expression body, or its last statement's `return`. */
function returnsJsx(fn: AST.ArrowFunctionExpression | AST.Function): boolean {
  if (fn.body && fn.body.type !== "BlockStatement") return containsJsx(fn.body);
  const last = (fn.body?.body ?? []).filter((item) => item.type !== "EmptyStatement").at(-1);
  return last?.type === "ReturnStatement" && containsJsx(last.argument);
}

/**
 * The components written as values (`export const Card = (props: CardProps) => …`): an exported
 * PascalCase `const` holding a function that returns JSX, with how it is exported.
 */
function findValueComponents(program: AST.Program): Candidate[] {
  const exportsByLocal = new Map<string, ComponentExport[]>();
  for (const statement of program.body) {
    if (
      statement.type === "ExportNamedDeclaration" &&
      !statement.source &&
      statement.exportKind !== "type"
    ) {
      for (const specifier of statement.specifiers) {
        if (specifier.local.type !== "Identifier" || specifier.exportKind === "type") continue;
        const name = exportName(specifier.exported);
        const entry: ComponentExport = {
          kind: name === "default" ? "default" : "named",
          name,
          span: { start: specifier.start, end: specifier.end },
        };
        exportsByLocal.set(specifier.local.name, [
          ...(exportsByLocal.get(specifier.local.name) ?? []),
          entry,
        ]);
      }
    } else if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier"
    ) {
      const local = statement.declaration.name;
      const entry: ComponentExport = {
        kind: "default",
        name: "default",
        span: { start: statement.start, end: statement.end },
      };
      exportsByLocal.set(local, [...(exportsByLocal.get(local) ?? []), entry]);
    }
  }
  const found: Candidate[] = [];
  for (const statement of program.body) {
    const value = valueFunctionOf(statement);
    if (!value || !isComponentName(value.id.name)) continue;
    const span = { start: statement.start, end: statement.end };
    const { name } = value.id;
    const exports: ComponentExport[] = [
      ...(statement.type === "ExportNamedDeclaration"
        ? [{ kind: "named" as const, name, span }]
        : []),
      ...(exportsByLocal.get(name) ?? []),
    ];
    if (exports.length) {
      found.push({ name, node: value.fn, span, exports, value: value.declaration });
    }
  }
  return found;
}

/**
 * A component written as a value (UF1102): a component is a function declaration (plan §4.1),
 * which the likely fix writes, keeping the parameters, the return type and the body.
 */
function reportValueComponent(
  candidate: Candidate,
  declaration: AST.VariableDeclaration,
  parsed: ParsedModule,
  reporter: Reporter,
): void {
  const fn = candidate.node;
  const what =
    fn.type === "ArrowFunctionExpression" ? "an arrow function" : "a function expression";
  const fix = valueComponentFix(candidate.name, fn, declaration, parsed);
  reporter.report(
    "UF1102",
    declaration.declarations[0]!.id,
    `${candidate.name} is ${what} in a \`const\`, and a component is a function declaration.`,
    {
      help: `Declare it as a function: \`export function ${candidate.name}(props: Props) { return …; }\`.`,
      ...(fix ? { fixes: [fix] } : {}),
    },
  );
}

/** The rewrite of a component written as a value as a function declaration, where one is plain. */
function valueComponentFix(
  name: string,
  fn: ComponentFunction,
  declaration: AST.VariableDeclaration,
  { source, comments }: ParsedModule,
): Fix | undefined {
  const declarator = declaration.declarations[0]!;
  if (declarator.id.typeAnnotation || fn.async || fn.generator) return undefined;
  if (fn.id && fn.id.name !== name) return undefined;
  const edits: Fix["edits"] = [];
  if (fn.type === "ArrowFunctionExpression") {
    const parameters = fn.typeParameters?.end ?? fn.start;
    const parenthesised = source.slice(parameters).trimStart().startsWith("(");
    edits.push({
      span: { start: declaration.start, end: fn.start },
      text: `function ${name}${parenthesised ? "" : "("}`,
    });
    if (!parenthesised) {
      const parameter = fn.params[0]!;
      edits.push({ span: { start: parameter.end, end: parameter.end }, text: ")" });
    }
    const { body } = fn;
    const arrow = source.lastIndexOf("=>", body.start);
    const block = body.type === "BlockStatement";
    edits.push(
      { span: { start: arrow, end: body.start }, text: block ? "" : "{ return " },
      {
        span: { start: block ? fn.end : body.end, end: declaration.end },
        text: block ? "" : "; }",
      },
    );
  } else {
    const parameters = fn.typeParameters?.start ?? source.indexOf("(", fn.id?.end ?? fn.start);
    edits.push(
      { span: { start: declaration.start, end: parameters }, text: `function ${name}` },
      { span: { start: fn.end, end: declaration.end }, text: "" },
    );
  }
  // A comment in a span the fix replaces would be lost.
  const lost = comments.some((comment) =>
    edits.some(({ span }) => comment.start < span.end && comment.end > span.start),
  );
  if (lost) return undefined;
  return { title: `Declare \`${name}\` as a function`, confidence: "likely", edits };
}
