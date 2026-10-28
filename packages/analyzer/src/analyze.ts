import type { Diagnostic, Fix } from "@unframework/diagnostics";
import {
  createComponent,
  createDeclaredTypeExport,
  createExport,
  createFragment,
  createImportedName,
  createInjectionKeyDeclaration,
  createModule,
  createModuleImport,
  createNamedImport,
  createSharedModuleImport,
  createTypeDeclaration,
  createTypeExportName,
  createTypeImport,
  createTypeReExport,
  createTypeParameter,
  createTypeText,
  isExportName,
  walk,
} from "@unframework/ir";
import type {
  Binding,
  ComponentApi,
  ImportedName,
  InjectionKeyDeclaration,
  ModuleApi,
  ModuleConstant,
  ModuleImport,
  NamedImport,
  PassThroughImport,
  SharedModuleImport,
  TypeDeclaration,
  TypeExport,
  TypeImport,
  TypeParameter,
  UfComponent,
  UfExport,
  UfModule,
} from "@unframework/ir";
import {
  exportName,
  findComponents,
  findTypeDeclarations,
  isComponentName,
  typeDeclarationOf,
  visitorKeys,
} from "@unframework/parser";
import type { AST, ComponentExport, ParsedModule } from "@unframework/parser";

import { componentApi, withReferences } from "./api.ts";
import type { ApiContext } from "./api.ts";
import { authoringBindings, checkAuthoringImport } from "./authoring.ts";
import type { AuthoringApi } from "./authoring.ts";
import { analyzeComposable, COMPOSABLE_FILE, findComposables } from "./composables.ts";
import type { AnalyzedComposable, ComposableCandidate } from "./composables.ts";
import { Reporter } from "./context.ts";
import { checkTypeDeclaration, closure, collectTypes, setupTypes } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import { frameworkOf, isAuthoringModule } from "./frameworks.ts";
import { containsJsx, lowerElement, lowerRootChildren, ROOT } from "./lower.ts";
import {
  DEFAULT_PASS_THROUGH,
  isPassThroughSpecifier,
  passThroughImport,
  reportUnread,
} from "./pass-through.ts";
import type { PassThrough } from "./pass-through.ts";
import { analyzeProps, checkTypeParameters, shapeReading } from "./props.ts";
import type { ComponentFunction, ComponentInfo, RenderContext, SetupBinding } from "./render.ts";
import { checkRules } from "./rules.ts";
import { Scopes } from "./scope.ts";
import { checkDirective, declareSetup, isDirective, refTypeOf } from "./setup.ts";
import type { InjectionKeyInfo } from "./setup.ts";
import { ownShapes } from "./shapes.ts";
import type { Shapes } from "./shapes.ts";
import { isSharedModuleSpecifier, lowerConstants, sharedValue } from "./shared.ts";
import type { ConstantCandidate, SharedModule, SharedValues } from "./shared.ts";
import { scopeIdOf, STYLESHEET_SPECIFIER, stylesheetImport } from "./styles.ts";
import type { LoweredSheet, StylesheetSource } from "./styles.ts";
import { syntaxError } from "./syntax.ts";
import { kindsFromShape } from "./types/from-shape.ts";
import type { Kinds } from "./types/kinds.ts";

/** The result of analysing one module. */
export interface AnalyzeResult {
  /**
   * The module's IR, or `undefined` when a module-level error (syntax, imports) means no
   * component can be compiled. A component with errors is left out; its siblings stay.
   */
  module: UfModule | undefined;
  diagnostics: Diagnostic[];
  /**
   * The module's public API, read from its declarations (ADR-0053): what a parent that imports
   * it reads, known whatever its templates hold. `undefined` when it does not parse. Its `file`
   * is the module's, which a resolver rewrites relative to each importer.
   */
  api: ModuleApi | undefined;
}

/** What analysing a module needs besides its source (ADR-0053). */
export interface AnalyzeOptions {
  /**
   * The API of each `.uf.tsx` module the source imports, by the import's specifier, as the
   * compiler's resolver gave it: `undefined` for one it could not resolve (UF1202).
   */
  imports?: ReadonlyMap<string, ModuleApi | undefined>;
  /**
   * Each stylesheet the source imports (`stylesheetImports`), by the import's specifier, as the
   * compiler's resolver read it: `undefined` for one it could not read (UF5005, ADR-0063).
   */
  stylesheets?: ReadonlyMap<string, StylesheetSource | undefined>;
  /**
   * Each shared `.ts` module the source imports (`sharedModuleImports`), by the import's
   * specifier, as the compiler's resolver read it (ADR-0070): `undefined` for one it could not
   * read, whose value import is UF1202.
   */
  modules?: ReadonlyMap<string, SharedModule | undefined>;
  /**
   * The specifier prefixes whose imports pass through to every output as written (ADR-0064):
   * `["virtual:"]` when absent. An import the analyser classifies otherwise (the authoring API, a
   * framework, a `.uf.tsx` or relative module) never passes through.
   */
  passThrough?: readonly string[];
  /**
   * The shape of each type `shapeQueries` names, as the compiler's type oracle resolved it
   * (ADR-0067): `undefined` for one it was not asked for. Without it, the analyser reads the
   * module's own declarations only (`localShapes`), and an imported type is unresolved.
   */
  shapes?: Shapes;
}

/** A relative or absolute specifier: a file of the project, never a module a plugin registers. */
const RELATIVE_OR_ABSOLUTE = /^(?:[./\\]|[A-Za-z]:)/;

/** The specifier of an import of a component module ends in `.uf.tsx` (ADR-0053). */
export const COMPONENT_SPECIFIER: RegExp = /\.uf\.tsx$/;

/**
 * The specifiers of the `.uf.tsx` modules a parsed module imports as values, in source order,
 * each once: what `compile()` asks its resolver for before the module is analysed.
 */
export function componentImports(parsed: ParsedModule): string[] {
  const found = new Set<string>();
  for (const statement of parsed.program.body) {
    if (
      statement.type === "ImportDeclaration" &&
      statement.importKind !== "type" &&
      COMPONENT_SPECIFIER.test(statement.source.value)
    ) {
      found.add(statement.source.value);
    }
  }
  return [...found];
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

/**
 * Analyses a parsed `.uf.tsx` module and lowers its components into IR (passes P2 and P3), or a
 * `.uf.ts` module and its composables (ADR-0069).
 */
export function analyze(parsed: ParsedModule, options: AnalyzeOptions = {}): AnalyzeResult {
  return analyzeModule(parsed, undefined, options);
}

/**
 * What a component's setup declares, as the analyser reads it: each binding's kinds, which never
 * reach the IR. The tests pin them against TypeScript's inference (ADR-0046).
 */
export type SetupObserver = (component: string, bindings: readonly SetupBinding[]) => void;

/** `analyze`, with an observer of each component's setup, for the tests. */
export function analyzeModule(
  parsed: ParsedModule,
  observe?: SetupObserver,
  options: AnalyzeOptions = {},
): AnalyzeResult {
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
  if (parsed.errors.length) {
    return { module: undefined, diagnostics: reporter.diagnostics, api: undefined };
  }

  // A `.uf.ts` module holds composables and no component (ADR-0069).
  const composableModule = COMPOSABLE_FILE.test(parsed.file);
  const candidates: Candidate[] = composableModule
    ? []
    : [...findComponents(parsed.program), ...findValueComponents(parsed.program)].toSorted(
        (a, b) => a.span.start - b.span.start,
      );
  // Its top-level forms are the module's: an error in one drops every composable (UF2035).
  const foundMark = reporter.diagnostics.length;
  const found = composableModule
    ? findComposables(parsed.program, exportedNames(parsed.program), reporter)
    : undefined;
  const foundErrors = reporter.hasErrorsSince(foundMark);
  const composableCandidates = found?.candidates ?? [];
  const componentStatements = new Set([
    ...candidates.map((candidate) => candidate.span.start),
    ...(found?.statements ?? []),
  ]);
  const listed = listedTypeExports(parsed.program);
  const declarations = findTypeDeclarations(parsed.program).map((declaration) =>
    listed.has(declaration.name) ? { ...declaration, exported: true } : declaration,
  );
  // The module's injection keys (ADR-0054): read before any import or component, since the
  // resolver gives a parent's keys to the children that inject them.
  const keyCandidates = findKeys(parsed.program);
  // What each top-level `const` writes of types, in its annotation and its value: copied as the
  // setup's types are, into the outputs that declare the constant (ADR-0070).
  const constantTypes = new Map<string, AST.VariableDeclarator>(
    parsed.program.body.flatMap((statement) =>
      statement.type === "VariableDeclaration" && !keyCandidates.has(statement.start)
        ? statement.declarations.flatMap((declarator) =>
            declarator.id.type === "Identifier"
              ? [[`${declarator.id.name}@${declarator.id.start}`, declarator] as const]
              : [],
          )
        : [],
    ),
  );
  const types = collectTypes(declarations, candidates, [
    ...[...keyCandidates.values()].flatMap((candidate) => (candidate.type ? [candidate.type] : [])),
    ...constantTypes.values(),
    // A composable's types are its setup's, its parameters' included (ADR-0069).
    ...composableCandidates.map(({ node }) => [node.typeParameters, node.params, node.body]),
  ]);
  const scopes = new Scopes(parsed.program);
  const authoring = authoringBindings(parsed.program);
  const shapes = options.shapes ?? ownShapes(parsed);
  // The module's own path, for the types the compiler did not ask its oracle for, indexed once
  // and only when a component reads one.
  let own: Shapes | undefined = options.shapes ? undefined : shapes;
  const localShapes: Shapes = (at) => (own ??= ownShapes(parsed))(at);
  // Every component's API, read from its declarations before any is lowered: they render each
  // other, and themselves (ADR-0053).
  const apiContext: ApiContext = {
    source: parsed.source,
    file: parsed.file,
    scopes,
    shapes,
    authoring,
  };
  const apis = new Map<Candidate, ComponentApi>();
  for (const candidate of candidates) {
    if (!candidate.value) apis.set(candidate, componentApi(candidate, apiContext));
  }
  const keyMark = reporter.diagnostics.length;
  const keyDeclarations: InjectionKeyDeclaration[] = [];
  const keys = new Map<object, InjectionKeyInfo>();
  for (const candidate of keyCandidates.values()) {
    if (composableModule) {
      // `provide` and `inject` are a component's, so a key stays in the module of the component
      // that provides it (ADR-0054, ADR-0069).
      reporter.unsupported(
        candidate.id,
        "An injection key is declared in the `.uf.tsx` module of the component that provides it, and a composable neither provides nor injects.",
      );
      continue;
    }
    // A key reported here is still one `provide` and `inject` may name: their uses are checked
    // as its fix would leave them, and report nothing more (one code per misuse).
    const ref = refTypeOf(candidate.type);
    keys.set(candidate.id, {
      name: candidate.id.name,
      type: candidate.type ?? "",
      ...(ref ? { ref } : {}),
    });
    const declaration = checkKey(candidate, parsed.source, reporter);
    if (declaration) keyDeclarations.push(declaration);
  }
  // A key is the module's, as an import is: an error in one drops every component.
  const keyErrors = reporter.hasErrorsSince(keyMark);
  const imports: ModuleImport[] = [];
  const components = new Map<object, ComponentInfo | undefined>();
  for (const [candidate, api] of apis) {
    if (candidate.node.id) components.set(candidate.node.id, { name: candidate.name, api });
  }
  const context: ModuleContext = {
    program: parsed.program,
    scopes,
    source: parsed.source,
    candidates,
    exported: exportedNames(parsed.program),
    reporter,
    types,
    comments: parsed.comments,
    resolved: options.imports ?? new Map(),
    imports,
    components,
    keys,
    outputs: new Map(candidates.map((candidate) => [candidate.name.toLowerCase(), candidate.name])),
    stylesheets: options.stylesheets ?? new Map(),
    sheets: [],
    passThrough: { names: new Map(), read: new Set(), clashes: new Set() },
    passThroughPrefixes: options.passThrough ?? DEFAULT_PASS_THROUGH,
    passThroughImports: [],
    typeImports: [],
    typeExports: [],
    modules: options.modules ?? new Map(),
    moduleImports: [],
    shared: { values: new Map(), failed: new Set() },
    constants: [],
    composableModule,
    composableImports: new Map(),
  };
  const moduleMark = reporter.diagnostics.length;
  for (const statement of parsed.program.body) {
    if (componentStatements.has(statement.start) || keyCandidates.has(statement.start)) continue;
    checkTopLevelStatement(statement, context);
  }
  // Lowered once every import is known: imports are hoisted, so a constant may read one
  // written after it.
  const constants = lowerConstants(context.constants, {
    source: parsed.source,
    scopes,
    reporter,
    shared: context.shared,
  });
  // A module-level error drops every component, but they are still checked: fixing it must
  // reveal nothing new (the harness's L1).
  const moduleErrors = keyErrors || reporter.hasErrorsSince(moduleMark);
  if (composableModule) {
    const errors = moduleErrors || foundErrors;
    return composableResult(
      composableCandidates,
      errors,
      constants,
      constantTypes,
      {
        parsed,
        types,
        shapes,
        scopes,
        authoring,
        reporter,
        components: new Map(),
        keys,
        passThrough: context.passThrough,
        shared: context.shared,
        composableImports: context.composableImports,
        called: new Set(),
        writtenType: writtenTypeIn({ parsed, types, shapes, localShapes }),
      },
      context,
    );
  }
  // The module's one component owns its sheets (ADR-0063): its API carries their scope id, as
  // the one a parent reads through the resolver, and so does its own render of itself.
  const [sheetOwner] = candidates;
  const styles =
    sheetOwner && context.sheets.length
      ? {
          sheets: context.sheets.map(({ sheet }) => sheet),
          scopeId: scopeIdOf(
            sheetOwner.name,
            context.sheets.map(({ sheet }) => sheet.source),
          ),
          slotted: context.sheets.some(({ slotted }) => slotted),
        }
      : undefined;
  const ownerApi = sheetOwner && apis.get(sheetOwner);
  if (styles && ownerApi) ownerApi.styles = { scopeId: styles.scopeId, slotted: styles.slotted };
  const api: ModuleApi = {
    file: parsed.file,
    components: [...apis.values()],
    keys: keyDeclarations.map((key) => ({
      name: key.name,
      description: key.description,
      type: key.type.code,
      ...(key.ref ? { ref: key.ref } : {}),
      ...withReferences(key.type.code),
    })),
  };

  const module: ComponentModule = {
    parsed,
    types,
    shapes,
    localShapes,
    scopes,
    authoring,
    reporter,
    components,
    keys,
    passThrough: context.passThrough,
    shared: context.shared,
    ...(observe ? { observe } : {}),
  };
  const lowered: UfComponent[] = [];
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
    lowered.push(component);
    for (const entry of candidate.exports) {
      exports.push({ ...createExport(entry.kind, candidate.name, entry.span), name: entry.name });
    }
  }
  dropFailedRenders(lowered, candidates);
  if (styles && lowered[0]) {
    lowered[0] = { ...lowered[0], styles: styles.sheets, scopeId: styles.scopeId };
  }
  // The output of the module's main component declares its keys, and the types they reach.
  // Codegen's `keyOwner` rule: the default export, else the first exported, else the first.
  const ownerName = (exports.find((entry) => entry.kind === "default") ?? exports[0])?.local;
  const ownerIndex = lowered.findIndex((component) => component.name === ownerName);
  const owner = lowered[ownerIndex];
  if (owner && keyDeclarations.length) {
    const names = new Set([
      ...owner.types,
      ...closure(
        [...keyCandidates.values()].map((candidate) => candidate.type),
        types.table,
      ),
    ]);
    lowered[ownerIndex] = {
      ...owner,
      types: types.declarations
        .filter((declaration) => names.has(declaration.name))
        .map((declaration) => declaration.name),
    };
  }
  const kept = new Set(lowered.map((component) => component.name));
  // A pass-through name nothing reads would reach every output unused (UF5006): an error of
  // the module's. After another error, the walk that would read it may have stopped, so it is
  // left unreported.
  const uncalled =
    !reporter.diagnostics.some(({ severity }) => severity === "error") &&
    reportUnread(parsed.program.body, context.passThrough, reporter);
  if (moduleErrors || uncalled)
    return { module: undefined, diagnostics: reporter.diagnostics, api };
  if (!candidates.some((candidate) => candidate.exports.length)) {
    reporter.report("UF1101", { start: 0, end: 0 }, "This file exports no component.", {
      help: "A component is an exported PascalCase function whose last statement returns JSX.",
    });
    return { module: undefined, diagnostics: reporter.diagnostics, api };
  }
  exports.sort((a, b) => a.span.start - b.span.start);
  const read = readConstants(constants, lowered);
  const readTypes = new Set(
    closure(
      read.map(({ binding }) => constantTypes.get(binding)),
      types.table,
    ),
  );
  return {
    module: createModule(
      parsed.file,
      lowered,
      exports.filter((entry) => kept.has(entry.local)),
      moduleTypes(lowered, types, parsed.source, readTypes),
      imports,
      keyDeclarations,
      context.passThroughImports,
      {
        typeImports: context.typeImports,
        typeExports: [
          ...context.typeExports,
          ...declaredTypeExports(types, parsed.source),
        ].toSorted((a, b) => a.span.start - b.span.start),
        moduleImports: context.moduleImports,
        constants: read,
      },
    ),
    diagnostics: reporter.diagnostics,
    api,
  };
}

/**
 * Lowers a `.uf.ts` module's composables, once its top-level statements are checked (ADR-0069):
 * its IR holds them and no component, and its API what a caller reads of each.
 */
function composableResult(
  candidates: readonly ComposableCandidate[],
  moduleErrors: boolean,
  constants: readonly ModuleConstant[],
  constantTypes: ReadonlyMap<string, AST.VariableDeclarator>,
  module: Parameters<typeof analyzeComposable>[2],
  context: ModuleContext,
): AnalyzeResult {
  const { parsed, reporter, types } = module;
  const mark = reporter.diagnostics.length;
  const lowered: AnalyzedComposable[] = [];
  for (const candidate of candidates) {
    const result = analyzeComposable(
      candidate,
      typeParametersOf(candidate.node, parsed.source),
      module,
    );
    if (result) lowered.push(result);
  }
  // A value import no composable calls names a type, or nothing a composable may read: either
  // way its outputs would import a value the module never had (UF2035).
  for (const [local, specifier] of module.composableImports) {
    if (module.called.has(local)) continue;
    reporter.report(
      "UF2035",
      specifier,
      `\`${specifier.local.name}\` is imported as a value from a module of composables, which a composable never calls: a type is imported with \`type\`.`,
      {
        help: `Import it as a type: \`import { type ${specifier.local.name} } from "…";\`.`,
        ...(specifier.type === "ImportSpecifier"
          ? {
              fixes: [
                {
                  title: "Import it as a type",
                  confidence: "likely" as const,
                  edits: [
                    { span: { start: specifier.start, end: specifier.start }, text: "type " },
                  ],
                },
              ],
            }
          : {}),
      },
    );
  }
  const api: ModuleApi = {
    file: parsed.file,
    components: [],
    keys: [],
    ...(lowered.length ? { composables: lowered.map(({ api }) => api) } : {}),
  };
  const uncalled =
    !reporter.diagnostics.some(({ severity }) => severity === "error") &&
    reportUnread(parsed.program.body, context.passThrough, reporter);
  if (moduleErrors || uncalled || reporter.hasErrorsSince(mark)) {
    return { module: undefined, diagnostics: reporter.diagnostics, api };
  }
  if (!candidates.length) {
    reporter.report("UF2035", { start: 0, end: 0 }, "This file exports no composable.", {
      help: "A module of composables exports functions named `use` and an upper-case letter, each returning a shorthand object.",
    });
    return { module: undefined, diagnostics: reporter.diagnostics, api };
  }
  if (lowered.length < candidates.length) {
    return { module: undefined, diagnostics: reporter.diagnostics, api };
  }
  const composables = lowered.map(({ composable }) => composable);
  const read = readConstants(constants, composables);
  const used = new Set([
    ...composables.flatMap((composable) => composable.types),
    ...closure(
      read.map(({ binding }) => constantTypes.get(binding)),
      types.table,
    ),
  ]);
  return {
    module: createModule(
      parsed.file,
      [],
      [],
      types.declarations
        .filter((declaration) => used.has(declaration.name))
        .map((declaration) =>
          createTypeDeclaration(
            declaration.name,
            declaration.exported,
            parsed.source.slice(declaration.node.start, declaration.node.end),
            spanOf(declaration.node),
          ),
        ),
      [],
      [],
      context.passThroughImports,
      {
        typeImports: context.typeImports,
        typeExports: [
          ...context.typeExports,
          ...declaredTypeExports(types, parsed.source),
        ].toSorted((a, b) => a.span.start - b.span.start),
        moduleImports: context.moduleImports,
        constants: read,
        composables,
      },
    ),
    diagnostics: reporter.diagnostics,
    api,
  };
}

/**
 * The module's constants its components read, and those they read in turn, in source order
 * (ADR-0070): what every output declares.
 */
function readConstants(
  constants: readonly ModuleConstant[],
  components: readonly { bindings: readonly Binding[] }[],
): ModuleConstant[] {
  const byId = new Map(constants.map((constant) => [constant.binding, constant]));
  const read = new Set<string>();
  const add = (id: string) => {
    const constant = byId.get(id);
    if (!constant || read.has(id)) return;
    read.add(id);
    for (const ref of constant.value.refs) if (ref.kind === "Binding") add(ref.binding);
  };
  for (const component of components) {
    for (const binding of component.bindings) if (binding.kind === "moduleConst") add(binding.id);
  }
  return constants.filter((constant) => read.has(constant.binding));
}

/**
 * The types the module exports that no component reaches (ADR-0068): every output exports them
 * as written, for its consumers' types.
 */
function declaredTypeExports(types: ModuleTypes, source: string): TypeExport[] {
  return types.declarations
    .filter(
      (declaration) =>
        declaration.exported &&
        types.table.declaration(declaration.name) === declaration &&
        !types.reached.has(declaration.name) &&
        !types.setupReached.has(declaration.name),
    )
    .map(({ name, node }) =>
      createDeclaredTypeExport(name, source.slice(node.start, node.end), spanOf(node)),
    );
}

/**
 * Drops each lowered component that renders one of the module's components that failed to
 * lower, until none does: its error is reported, and the IR names only components it holds
 * (ADR-0053).
 */
function dropFailedRenders(lowered: UfComponent[], candidates: readonly Candidate[]): void {
  const local = new Set(candidates.map((candidate) => candidate.name));
  for (;;) {
    const kept = new Set(lowered.map((component) => component.name));
    const index = lowered.findIndex((component) => {
      let failed = false;
      walk(component.render, {
        enter(node) {
          if (node.kind === "Component" && local.has(node.component) && !kept.has(node.component))
            failed = true;
        },
      });
      return failed;
    });
    if (index === -1) return;
    lowered.splice(index, 1);
  }
}

/**
 * The type declarations the components' outputs declare (ADR-0034): each one some lowered
 * component's props reach, in source order, as written from `interface` or `type` on.
 */
function moduleTypes(
  components: readonly UfComponent[],
  types: ModuleTypes,
  source: string,
  constants: ReadonlySet<string>,
): TypeDeclaration[] {
  const used = new Set([...components.flatMap((component) => component.types), ...constants]);
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
  program: AST.Program;
  scopes: Scopes;
  source: string;
  candidates: Candidate[];
  /** The local names the module exports as values (`export { name }`, `export default name`). */
  exported: ReadonlySet<string>;
  reporter: Reporter;
  types: ModuleTypes;
  /** The module's comments: lint directives must not reach an output. */
  comments: readonly AST.Comment[];
  /** The API of each imported `.uf.tsx` module, by specifier, as the resolver gave it. */
  resolved: ReadonlyMap<string, ModuleApi | undefined>;
  /** The module's imports of `.uf.tsx` modules, collected in source order. */
  imports: ModuleImport[];
  /**
   * The output files in the module's own directory and the ones its imports name, by the path
   * an output imports each by, in lower case: the component that writes each.
   */
  outputs: Map<string, string>;
  /**
   * The components templates may render, by the identifier that declares each: `undefined` for
   * a name an unresolved import binds, reported once, where it is imported.
   */
  components: Map<object, ComponentInfo | undefined>;
  /** The injection keys `provide` and `inject` may name, by the identifier that declares each. */
  keys: Map<object, InjectionKeyInfo>;
  /** Each stylesheet the module imports, by specifier, as the resolver read it (ADR-0063). */
  stylesheets: ReadonlyMap<string, StylesheetSource | undefined>;
  /** The module's sheets, collected in source order. */
  sheets: LoweredSheet[];
  /** The names the module's pass-through imports bind, and those its code reads (ADR-0064). */
  passThrough: PassThrough & { names: Map<object, string | undefined> };
  /** The specifier prefixes whose imports pass through (`AnalyzeOptions.passThrough`). */
  passThroughPrefixes: readonly string[];
  /** The module's imports that every output keeps as written, in source order (ADR-0064). */
  passThroughImports: PassThroughImport[];
  /** The module's imports of types, which every output re-imports by name (ADR-0067). */
  typeImports: TypeImport[];
  /** The module's type re-exports, in source order (ADR-0068). */
  typeExports: TypeExport[];
  /** Each shared `.ts` module the module imports, by specifier, as the resolver read it. */
  modules: ReadonlyMap<string, SharedModule | undefined>;
  /** The module's value imports of shared modules, in source order (ADR-0070). */
  moduleImports: SharedModuleImport[];
  /** The values the module's components may read: its value imports and constants. */
  shared: SharedValues;
  /** The module's top-level `const`s, in source order, lowered once every import is known. */
  constants: ConstantCandidate[];
  /** Whether the module is a `.uf.ts` module of composables (ADR-0069). */
  composableModule: boolean;
  /** In a `.uf.ts` module, the names it imports from other `.uf.ts` modules (UF2035). */
  composableImports: Map<object, AST.ImportDeclarationSpecifier>;
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
  context: ModuleContext,
): void {
  const { source, candidates, exported, reporter, types, comments } = context;
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
    case "VariableDeclaration":
      moduleConstant(statement, context);
      return;
    case "ImportDeclaration":
      if (COMPONENT_SPECIFIER.test(statement.source.value) && statement.importKind !== "type") {
        componentImport(statement, context);
        return;
      }
      // Before the stylesheets, which a `virtual:x.css` would otherwise reach, and after what the
      // analyser classifies itself, which never passes through, whatever the prefixes.
      if (
        !COMPONENT_SPECIFIER.test(statement.source.value) &&
        !RELATIVE_OR_ABSOLUTE.test(statement.source.value) &&
        !frameworkOf(statement.source.value) &&
        !isAuthoringModule(statement.source.value) &&
        isPassThroughSpecifier(statement.source.value, context.passThroughPrefixes)
      ) {
        passThroughImport(
          statement,
          reporter,
          context.passThrough.names,
          context.passThroughImports,
        );
        return;
      }
      if (
        context.composableModule &&
        COMPOSABLE_FILE.test(statement.source.value) &&
        statement.importKind !== "type"
      ) {
        // Its types are re-imported by name (ADR-0067); a composable that calls another is
        // reported at the call (UF2035).
        const types = statement.specifiers.filter(
          (item): item is AST.ImportSpecifier =>
            item.type === "ImportSpecifier" && item.importKind === "type",
        );
        if (types.length) typeImport(statement, types, context);
        for (const specifier of statement.specifiers) {
          if (!types.includes(specifier as AST.ImportSpecifier)) {
            context.composableImports.set(specifier.local, specifier);
          }
        }
        return;
      }
      if (STYLESHEET_SPECIFIER.test(statement.source.value)) {
        stylesheetImport(
          statement,
          context.stylesheets,
          candidates.length,
          reporter,
          context.sheets,
        );
        return;
      }
      checkImport(statement, context);
      return;
    case "ExportNamedDeclaration": {
      // A type re-export, which every output writes for its consumers' types (ADR-0068).
      if (
        statement.source &&
        statement.specifiers.length &&
        (statement.exportKind === "type" ||
          statement.specifiers.every((specifier) => specifier.exportKind === "type"))
      ) {
        typeReExport(statement, statement.source.value, context);
        return;
      }
      if (statement.declaration?.type === "VariableDeclaration") {
        reporter.unsupported(
          statement,
          "A module exports its components and injection keys, and no other value.",
          {
            help: "Move the value to a shared `.ts` module, which each component that reads it imports (ADR-0070).",
          },
        );
        return;
      }
      if (statement.declaration || statement.source) break;
      // A local type in an export list is exported as if its declaration were
      // (`listedTypeExports`). A type-only export of anything else exports no value (TS1361).
      const typeOnly = statement.specifiers.filter(
        (specifier) =>
          (statement.exportKind === "type" || specifier.exportKind === "type") &&
          !isListedType(specifier, context),
      );
      if (statement.exportKind === "type") {
        if (typeOnly.length) {
          reporter.unsupported(statement, "Type-only exports are not supported yet.");
        }
        return;
      }
      for (const specifier of typeOnly) {
        reporter.unsupported(specifier, "Type-only exports are not supported yet.");
      }
      // `export { Name }` of a component is recorded by findComponents.
      const others = statement.specifiers.filter(
        (specifier) => specifier.exportKind !== "type" && !typeOnly.includes(specifier),
      );
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
    "Top-level declarations other than imports, components and `const`s are not supported yet.",
  );
}

/**
 * A top-level `const` (ADR-0070): a plain value the module's components read, never write. A `let`
 * or a `var` would be state shared between instances, which has no form.
 */
function moduleConstant(statement: AST.VariableDeclaration, context: ModuleContext): void {
  const { reporter } = context;
  if (statement.kind !== "const" || statement.declare) {
    reporter.unsupported(
      statement,
      statement.declare
        ? "An ambient declaration declares no value a component can read."
        : `A module's top-level \`${statement.kind}\` is not supported: its values are read-only, so state shared between a component's instances has no form.`,
      {
        help: "Declare a constant with `const`, or keep state in a component's `ref`.",
      },
    );
    return;
  }
  if (statement.declarations.length > 1) {
    reporter.unsupported(statement, "A top-level `const` declares one constant.", {
      help: "Declare each constant with a `const` of its own.",
    });
    return;
  }
  const [declarator] = statement.declarations;
  if (!declarator || declarator.id.type !== "Identifier" || !declarator.init) {
    reporter.unsupported(
      declarator?.id ?? statement,
      "Destructuring is not supported in a module's constants.",
      { help: "Declare each constant by its name." },
    );
    return;
  }
  const annotation = declarator.id.typeAnnotation?.typeAnnotation;
  context.shared.values.set(
    declarator.id,
    sharedValue(
      "moduleConst",
      declarator.id,
      annotation ? context.types.table.kindsOf(annotation) : undefined,
    ),
  );
  context.constants.push({
    statement,
    declarator: declarator as ConstantCandidate["declarator"],
  });
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

/**
 * An import of a component module (ADR-0053): each name it binds is a component the module
 * exports, by the API the resolver gave (UF1202 otherwise), or a type, which every output
 * re-imports by name (ADR-0067).
 */
function componentImport(statement: AST.ImportDeclaration, context: ModuleContext): void {
  const { reporter, resolved } = context;
  const specifier = statement.source.value;
  const api = resolved.get(specifier);
  if (!api) {
    for (const item of statement.specifiers) context.components.set(item.local, undefined);
    reporter.report(
      "UF1202",
      statement.source,
      `"${specifier}" cannot be resolved: the compiler finds no component module there.`,
      {
        help: "Import a `.uf.tsx` file of the project by its relative path, as in `./Field.uf.tsx`.",
      },
    );
    return;
  }
  // The resolver gives the file relative to the importer: its own file is its own name.
  if (api.file === reporter.file.slice(reporter.file.lastIndexOf("/") + 1)) {
    selfImport(statement, api, context);
    return;
  }
  const names: ImportedName[] = [];
  const types = statement.specifiers.filter(
    (item): item is AST.ImportSpecifier =>
      item.type === "ImportSpecifier" && item.importKind === "type",
  );
  if (types.length) typeImport(statement, types, context);
  for (const item of statement.specifiers) {
    if (item.type === "ImportSpecifier" && item.importKind === "type") continue;
    if (item.type === "ImportNamespaceSpecifier") {
      reporter.unsupported(
        item,
        "A namespace import of a component module is not supported: a component is imported by name, or as the default.",
        { help: `Import the component itself, as in \`import Field from "${specifier}";\`.` },
      );
      continue;
    }
    const imported = item.type === "ImportDefaultSpecifier" ? "default" : exportName(item.imported);
    const key =
      imported === "default" ? undefined : api.keys.find((each) => each.name === imported);
    if (key) {
      names.push(
        createImportedName("Key", imported, item.local.name, { start: item.start, end: item.end }),
      );
      context.keys.set(item.local, {
        name: item.local.name,
        type: key.type,
        ...(key.ref ? { ref: key.ref } : {}),
      });
      continue;
    }
    const component = api.components.find((entry) =>
      imported === "default"
        ? entry.export === "default"
        : entry.export === "named" && entry.name === imported,
    );
    if (!component) {
      const exported = api.components
        .filter((entry) => entry.export !== "local")
        .map((entry) => (entry.export === "default" ? "a default export" : `\`${entry.name}\``));
      context.components.set(item.local, undefined);
      reporter.report(
        "UF1202",
        item,
        imported === "default"
          ? `"${specifier}" has no default export: it exports ${exported.join(", ") || "no component"}.`
          : `"${specifier}" exports no component or injection key named \`${imported}\`: it exports ${[...exported, ...api.keys.map((each) => `\`${each.name}\``)].join(", ") || "no component"}.`,
        { help: "Import a component the module exports." },
      );
      continue;
    }
    // Each output imports a child by its output file, beside the module's own (ADR-0053): two
    // components of one directory named alike without case would be one file (UF1104).
    const directory = api.file.includes("/")
      ? api.file.slice(0, api.file.lastIndexOf("/") + 1)
      : "";
    const output = `${directory}${component.name}`.toLowerCase();
    const owner = context.outputs.get(output);
    if (owner !== undefined && owner !== `${api.file}#${component.name}`) {
      // Reported here, once: the tags that render the name are not unknown (UF3047).
      context.components.set(item.local, undefined);
      // A component name holds no `#`, and a directory may.
      const hash = owner.lastIndexOf("#");
      const file = owner.slice(0, hash);
      const other =
        hash === -1
          ? `this module's ${owner}`
          : `${owner.slice(hash + 1)} from "${file.startsWith("../") ? file : `./${file}`}"`;
      reporter.report(
        "UF1104",
        item,
        `${component.name} from "${specifier}" and ${other} write one output file, which each output imports by its name.`,
        { help: "Rename one of the components." },
      );
      continue;
    }
    context.outputs.set(output, `${api.file}#${component.name}`);
    names.push(
      createImportedName("Component", imported, item.local.name, {
        start: item.start,
        end: item.end,
      }),
    );
    context.components.set(item.local, { name: item.local.name, api: component });
  }
  if (!names.length) return;
  context.imports.push(
    createModuleImport(specifier, api.file, api, names, {
      start: statement.start,
      end: statement.end,
    }),
  );
}

/**
 * An import of the module's own file (UF1203). A component renders itself, and the other
 * components of its module, by the names they are declared with (ADR-0053): recursion has one
 * form (P3). The likely fix removes the import and writes each tag that renders a name it binds
 * with the component's own name, when every name it binds is a component's.
 */
function selfImport(
  statement: AST.ImportDeclaration,
  api: ModuleApi,
  context: ModuleContext,
): void {
  const { reporter, source, scopes } = context;
  const names = new Map<object, string>();
  for (const item of statement.specifiers) {
    // Reported here, once: the tags that render the name are not unknown (UF3047).
    context.components.set(item.local, undefined);
    const imported =
      item.type === "ImportDefaultSpecifier"
        ? "default"
        : item.type === "ImportSpecifier" && item.importKind !== "type"
          ? exportName(item.imported)
          : undefined;
    const component = api.components.find((entry) =>
      imported === "default" ? entry.export === "default" : entry.name === imported,
    );
    if (imported !== undefined && component) names.set(item.local, component.name);
  }
  const edits: { span: { start: number; end: number }; text: string }[] = [];
  if (names.size === statement.specifiers.length) {
    // Every read of a name the import binds, a tag or a value (`is={Again}`), is renamed. The
    // fix is withheld where a name it writes would mean something else: a binding that shadows
    // the component, or a shorthand property whose key the rename would change.
    const written = new Set(names.values());
    const declarations = new Map(
      context.candidates.map((candidate) => [candidate.name, candidate.node.id]),
    );
    let safe = true;
    visit(context.program, (node) => {
      if (node.type === "Property" && node.shorthand && node.value.type === "Identifier") {
        const resolution = scopes.resolve(node.value as unknown as AST.IdentifierReference);
        if (resolution.kind === "import" && names.has(resolution.declaration)) safe = false;
      }
      if (node.type !== "Identifier" && node.type !== "JSXIdentifier") return;
      if (node.start >= statement.start && node.end <= statement.end) return;
      const resolution = scopes.resolve(node as unknown as AST.IdentifierReference);
      const name = resolution.kind === "import" ? names.get(resolution.declaration) : undefined;
      if (name) {
        edits.push({ span: spanOf(node), text: name });
        return;
      }
      if (!written.has(node.name)) return;
      const declaration = declarations.get(node.name);
      const component =
        node === declaration ||
        (resolution.kind === "variable" && resolution.declaration === declaration);
      if (!component) safe = false;
    });
    const end = source[statement.end] === "\n" ? statement.end + 1 : statement.end;
    if (safe) edits.unshift({ span: { start: statement.start, end }, text: "" });
    else edits.length = 0;
  }
  const [first] = names.values();
  reporter.report(
    "UF1203",
    statement.source,
    `"${statement.source.value}" is this module's own file: a component renders itself, and the components beside it, by their own names.`,
    {
      help: `Remove the import, and render the component by its own name${first ? `, as in \`<${first} />\`` : ""}.`,
      ...(edits.length
        ? {
            fixes: [
              {
                title: "Remove the import, and render each component by its own name",
                confidence: "likely" as const,
                edits,
              },
            ],
          }
        : {}),
    },
  );
}

/** Visits every node in a tree, depth first. */
function visit(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visit(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visit((typed as unknown as Record<string, unknown>)[key], enter);
  }
}

/**
 * A top-level `const` that reads as an injection key (ADR-0054): typed `InjectionKey<…>`, or
 * holding `Symbol(…)`, exported or not, which `checkKey` judges.
 */
interface KeyCandidate {
  statement: AST.Statement;
  declaration: AST.VariableDeclaration;
  id: AST.BindingIdentifier;
  exported: boolean;
  /** The value's type, `T` in `InjectionKey<T>`, when the annotation is one. */
  type: AST.TSType | undefined;
}

/** The module's key candidates, by the start of the statement that declares each. */
function findKeys(program: AST.Program): Map<number, KeyCandidate> {
  const keys = new Map<number, KeyCandidate>();
  for (const statement of program.body) {
    const exported =
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "VariableDeclaration";
    const declaration = exported
      ? (statement.declaration as AST.VariableDeclaration)
      : statement.type === "VariableDeclaration"
        ? statement
        : undefined;
    const [declarator] = declaration?.declarations ?? [];
    if (!declaration || declarator?.id.type !== "Identifier") continue;
    const annotation = declarator.id.typeAnnotation?.typeAnnotation;
    const typed =
      annotation?.type === "TSTypeReference" &&
      annotation.typeName.type === "Identifier" &&
      annotation.typeName.name === "InjectionKey";
    const symbol =
      declarator.init?.type === "CallExpression" &&
      declarator.init.callee.type === "Identifier" &&
      declarator.init.callee.name === "Symbol";
    if (!typed && !symbol) continue;
    const params = typed ? (annotation as AST.TSTypeReference).typeArguments?.params : undefined;
    keys.set(statement.start, {
      statement: statement as AST.Statement,
      declaration,
      id: declarator.id,
      exported,
      type: params?.length === 1 ? params[0] : undefined,
    });
  }
  return keys;
}

/**
 * Checks a key (UF2033): `export const ThemeKey: InjectionKey<Theme> = Symbol("theme")`, one
 * exported `const` typed with one type argument, holding a `Symbol` described by a string. Each
 * target writes it as its own context's key (ADR-0054).
 */
function checkKey(
  candidate: KeyCandidate,
  source: string,
  reporter: Reporter,
): InjectionKeyDeclaration | undefined {
  const { declaration, id } = candidate;
  const invalid = (at: { start: number; end: number }, message: string) => {
    reporter.report("UF2033", at, message, {
      help: 'Declare it as `export const ThemeKey: InjectionKey<Theme> = Symbol("theme");`, in the module of the component that provides it.',
    });
    return undefined;
  };
  if (declaration.kind !== "const" || declaration.declarations.length > 1) {
    return invalid(declaration, "An injection key is declared alone, by a `const`.");
  }
  const name = { start: id.start, end: id.start + id.name.length };
  if (!candidate.exported) {
    return invalid(
      name,
      `\`${id.name}\` is not exported: an injection key is exported, so the components that inject it import it.`,
    );
  }
  if (!candidate.type) {
    return invalid(
      id.typeAnnotation ?? name,
      `\`${id.name}\` is typed \`InjectionKey<T>\` with the type of what it provides: the targets that type their contexts declare it so.`,
    );
  }
  const init = declaration.declarations[0]!.init;
  const [description, ...more] = init?.type === "CallExpression" ? init.arguments : [];
  if (
    init?.type !== "CallExpression" ||
    init.callee.type !== "Identifier" ||
    init.callee.name !== "Symbol" ||
    more.length ||
    description?.type !== "Literal" ||
    typeof description.value !== "string"
  ) {
    return invalid(
      init ?? name,
      `\`${id.name}\` holds \`Symbol("…")\` with a string that describes it: Angular's and Qwik's keys take the description as their name.`,
    );
  }
  return createInjectionKeyDeclaration(
    id.name,
    description.value,
    createTypeText(source.slice(candidate.type.start, candidate.type.end), spanOf(candidate.type)),
    spanOf(candidate.statement),
    refTypeOf(candidate.type),
  );
}

function checkImport(statement: AST.ImportDeclaration, context: ModuleContext): void {
  const { reporter } = context;
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
  if (isSharedModuleSpecifier(specifier)) {
    sharedImport(statement, context);
    return;
  }
  if (statement.importKind === "type") {
    typeImport(statement, statement.specifiers, context);
    return;
  }
  reporter.unsupported(statement, "Importing modules is not supported yet.");
}

/**
 * An import of a shared `.ts` module (ADR-0070): its values are read through `import` bindings,
 * and its types re-imported by name (ADR-0067). The module is copied into every output tree, so
 * it may reach no framework (UF1204), and every relative module it reaches must be read (UF1202).
 * A type import the resolver could not read is the type oracle's to report (UF6001).
 */
function sharedImport(statement: AST.ImportDeclaration, context: ModuleContext): void {
  const { reporter } = context;
  const specifier = statement.source.value;
  const typeOnly = (item: AST.ImportDeclarationSpecifier) =>
    statement.importKind === "type" ||
    (item.type === "ImportSpecifier" && item.importKind === "type");
  const values = statement.specifiers.filter((item) => !typeOnly(item));
  const types = statement.specifiers.filter(typeOnly);
  if (!statement.specifiers.length) {
    reporter.unsupported(
      statement,
      "A side-effect import of a shared module is not supported: a component imports the values it reads.",
      { help: `Import each value by its name, as in \`import { sizes } from "${specifier}";\`.` },
    );
    return;
  }
  const module = context.modules.get(specifier);
  const fail = (code: "UF1202" | "UF1204", message: string, help: string) => {
    for (const item of values) context.shared.failed.add(item.local);
    reporter.report(code, statement.source, message, { help });
  };
  if (!module) {
    if (values.length) {
      fail(
        "UF1202",
        `"${specifier}" cannot be resolved: the compiler finds no \`.ts\` module there.`,
        "Import a `.ts` file of the project by its relative path, as in `./tokens.ts`.",
      );
      return;
    }
  } else if (module.framework) {
    const { file, specifier: framework } = module.framework;
    fail(
      "UF1204",
      `"${specifier}" ${file === module.file ? "" : `reaches "${file}", which `}imports "${framework}": a shared module is copied unchanged into every framework's output, so it imports no framework, and no \`unframework\`.`,
      "Keep the shared module to plain values, types and functions, and move what needs reactivity into a composable in a `.uf.ts` module.",
    );
    return;
  } else if (module.unresolved) {
    const { file, specifier: missing } = module.unresolved;
    fail(
      "UF1202",
      `"${specifier}" ${file === module.file ? "" : `reaches "${file}", which `}loads \`${missing}\`, which the compiler cannot read or follow: every output tree holds a copy of each module it reaches.`,
      "Import a `.ts` file of the project by its relative path, as in `./tokens.ts`.",
    );
    return;
  }
  if (types.length) typeImport(statement, types, context);
  if (!module) return;
  const names: NamedImport[] = [];
  for (const item of values) {
    if (item.type === "ImportNamespaceSpecifier") {
      context.shared.failed.add(item.local);
      reporter.unsupported(item, "A namespace import of a shared module is not supported.", {
        help: `Import each value by its name, as in \`import { sizes } from "${specifier}";\`.`,
      });
      continue;
    }
    const imported = item.type === "ImportDefaultSpecifier" ? "default" : exportName(item.imported);
    names.push(createNamedImport(imported, item.local.name, spanOf(item)));
    context.shared.values.set(item.local, sharedValue("import", item.local));
  }
  if (!names.length) return;
  context.moduleImports.push(
    createSharedModuleImport(specifier, module.file, names, spanOf(statement)),
  );
}

/**
 * An import of types from a relative `.ts`, a `.uf.tsx`, a `.uf.ts` or a package (ADR-0067):
 * the analyser reads them through the type oracle's shapes, and every output re-imports them
 * by name. A namespace import has no name to re-import.
 */
function typeImport(
  statement: AST.ImportDeclaration,
  specifiers: readonly AST.ImportDeclarationSpecifier[],
  context: ModuleContext,
): void {
  const names: NamedImport[] = [];
  for (const item of specifiers) {
    if (item.type === "ImportNamespaceSpecifier") {
      context.reporter.unsupported(item, "A namespace import of types is not supported.", {
        help: `Import each type by its name, as in \`import type { ButtonProps } from "${statement.source.value}";\`.`,
      });
      continue;
    }
    const imported = item.type === "ImportDefaultSpecifier" ? "default" : exportName(item.imported);
    names.push(createNamedImport(imported, item.local.name, spanOf(item)));
  }
  if (!names.length) return;
  context.typeImports.push(createTypeImport(statement.source.value, names, spanOf(statement)));
}

/**
 * Whether an export list's specifier exports a local type under its own name: it is exported as
 * if `export` were written on its declaration, which the outputs copy (ADR-0068).
 */
function isListedType(specifier: AST.ExportSpecifier, context: ModuleContext): boolean {
  const name = exportName(specifier.local);
  return (
    name === exportName(specifier.exported) &&
    context.types.table.declaration(name) !== undefined &&
    !context.candidates.some((candidate) => candidate.name === name)
  );
}

/**
 * The local types an export list exports under their own names (`export type { Tone }`): each
 * is exported as if `export` were written on its declaration (ADR-0068).
 */
function listedTypeExports(program: AST.Program): Set<string> {
  const names = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source) continue;
    for (const specifier of statement.specifiers) {
      const name = exportName(specifier.local);
      if (
        (statement.exportKind === "type" || specifier.exportKind === "type") &&
        name === exportName(specifier.exported)
      ) {
        names.add(name);
      }
    }
  }
  return names;
}

/** `export type { Tone } from "./types"` (ADR-0068): every output re-exports the types. */
function typeReExport(
  statement: AST.ExportNamedDeclaration,
  specifier: string,
  context: ModuleContext,
): void {
  const names = statement.specifiers.map((item) =>
    createTypeExportName(exportName(item.local), exportName(item.exported), spanOf(item)),
  );
  context.typeExports.push(createTypeReExport(specifier, names, spanOf(statement)));
}

/** What analysing a component needs to know about its module. */
interface ComponentModule {
  parsed: ParsedModule;
  types: ModuleTypes;
  shapes: Shapes;
  /** The module's own shapes, for a type `shapes` has none of. */
  localShapes: Shapes;
  scopes: Scopes;
  /** The module's authoring imports, by the identifier that declares each (ADR-0006). */
  authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  reporter: Reporter;
  /** The components templates may render, by the identifier that declares each. */
  components: ReadonlyMap<object, ComponentInfo | undefined>;
  /** The injection keys the module declares or imports, by the identifier that declares each. */
  keys: ReadonlyMap<object, InjectionKeyInfo>;
  /** The module's pass-through imports (ADR-0064). */
  passThrough: PassThrough;
  /** The values the module's components may read (ADR-0070). */
  shared: SharedValues;
  observe?: SetupObserver;
}

/**
 * What a written type gives a value (`SetupContext.writtenType`). A written type that reaches an
 * imported type is one `shapeQueries` asks the oracle for; any other resolves in the module,
 * which follows its `extends` and aliases as the oracle does.
 */
function writtenTypeIn(
  module: Pick<ComponentModule, "parsed" | "types" | "shapes" | "localShapes">,
): (type: AST.TSType) => { kinds: Kinds; complete: boolean } {
  const { parsed, types, shapes } = module;
  return (type) => {
    const at = { start: type.start, end: type.end };
    const shape = shapes(at) ?? module.localShapes(at);
    // A shape that does not resolve in full keeps what it could not evaluate as an object (a
    // branded `string & {}`), so its kinds are read as the module's own types give them, which
    // leave such a type `unknown` (ADR-0035).
    return shape && !shape.unresolved.length
      ? { kinds: kindsFromShape(shape, shapeReading(parsed, types.table, at)), complete: true }
      : { kinds: types.table.kindsOf(type), complete: false };
  };
}

/** Checks a component's shape, its props and its setup, and lowers its returned JSX. */
function analyzeComponent(candidate: Candidate, module: ComponentModule): UfComponent | undefined {
  const { parsed, types, shapes, scopes, authoring, reporter } = module;
  const mark = reporter.diagnostics.length;
  const fn = candidate.node;
  const name = fn.id ?? candidate.span;
  if (fn.generator) {
    reporter.report(
      "UF1102",
      name,
      `${candidate.name} is a generator, and a component must be a plain function.`,
    );
  }
  if (fn.async) reporter.unsupported(name, "Async components are not supported yet.");
  checkTypeParameters(fn, types, parsed, reporter);
  const props = analyzeProps(fn, types, shapes, parsed, reporter);

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
  const writtenType = writtenTypeIn(module);
  // The setup (ADR-0045): every statement before the return, declared before any code is walked.
  const setup = declareSetup({
    source: parsed.source,
    reporter,
    scopes,
    types: types.table,
    shapes,
    writtenType,
    comments: parsed.comments,
    authoring,
    component: fn,
    props,
    statements: body.slice(0, -1),
    returned: returned ?? undefined,
    keys: module.keys,
  });
  const render: RenderContext = {
    source: parsed.source,
    reporter,
    scopes,
    types: types.table,
    shapes,
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
    components: module.components,
    slots: setup.slots,
    passThrough: module.passThrough,
    shared: module.shared,
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
    // A component, or `<component is>`, at the root renders as the root's one child (ADR-0053).
    const element = lowerElement(returned, ROOT, render).element;
    root =
      element?.kind === "Component" || element?.kind === "Dynamic"
        ? createFragment([element], spanOf(returned))
        : element;
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
    {
      typeParameters: typeParametersOf(fn, parsed.source),
      ...(setup.slots ? { slots: setup.slots } : {}),
      ...(setup.exposes ? { exposes: setup.exposes } : {}),
      ...(setup.inheritAttrs ? {} : { inheritAttrs: false as const }),
    },
  );
}

/**
 * A generic component's type parameters (ADR-0068), `List<T extends Item = Item>`: each target
 * writes its own generic form from them, and the consumer's props infer them.
 */
function typeParametersOf(fn: ComponentFunction, source: string): TypeParameter[] {
  const text = (type: AST.TSType | null) =>
    type ? createTypeText(source.slice(type.start, type.end), spanOf(type)) : undefined;
  return (fn.typeParameters?.params ?? []).map((parameter) =>
    createTypeParameter(
      parameter.name.name,
      spanOf(parameter),
      text(parameter.constraint),
      text(parameter.default),
    ),
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
