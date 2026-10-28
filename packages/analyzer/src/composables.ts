// Composables (ADR-0069): the named `use*` exports of a `.uf.ts` module, each a setup under a
// component's rules (ADR-0045), with parameters in place of props and a returned shorthand object
// in place of JSX. The setup is declared and lowered by `declareSetup`, as a component's is, with
// the APIs that need a component rejected (UF2035); the parameters are read as a component's
// destructured props are, through `argument` bindings.

import {
  createBinding,
  createComponent,
  createComposable,
  createComposableParameter,
  createFragment,
  createReturnedMember,
  createTypeText,
  impurity,
  summarize,
} from "@unframework/ir";
import type {
  Binding,
  ComposableApi,
  ComposableMemberApi,
  ComposableParameter,
  ComposableParameterKind,
  ReturnedMember,
  TypeParameter,
  UfComposable,
} from "@unframework/ir";
import { exportName, visitorKeys } from "@unframework/parser";
import type { AST, ParsedModule } from "@unframework/parser";

import type { AuthoringApi } from "./authoring.ts";
import type { Reporter } from "./context.ts";
import { closure } from "./declarations.ts";
import type { ModuleTypes } from "./declarations.ts";
import type { PassThrough } from "./pass-through.ts";
import { checkTypeParameters } from "./props.ts";
import type { PropsAnalysis } from "./props.ts";
import type { ComponentInfo, PropBinding, RenderContext, SetupBinding } from "./render.ts";
import { checkRules } from "./rules.ts";
import type { Scopes } from "./scope.ts";
import { declareSetup } from "./setup.ts";
import type { InjectionKeyInfo } from "./setup.ts";
import type { Shapes } from "./shapes.ts";
import type { SharedValues } from "./shared.ts";
import { FUNCTION, union, UNDEFINED } from "./types/kinds.ts";
import type { Kinds } from "./types/kinds.ts";

/** A module of composables is a `.uf.ts` file (D1, ADR-0005, ADR-0069). */
export const COMPOSABLE_FILE: RegExp = /\.uf\.ts$/;

/** A composable's name: `use` and an upper-case letter, in ASCII letters and digits. */
const COMPOSABLE_NAME = /^use[A-Z][A-Za-z0-9]*$/;

/** The help of UF2035 for a composable that is not a named `use*` function declaration. */
const DECLARATION_HELP =
  "Declare it as a named export: `export function useToggle(initial: boolean) { …; return { on, toggle }; }`.";

/** A composable candidate: an exported `use*` function declaration of the module. */
export interface ComposableCandidate {
  name: string;
  node: AST.Function;
  /** The statement that declares it, including any `export` keyword. */
  span: { start: number; end: number };
}

/** The top-level statements of a `.uf.ts` module that declare or export composables. */
export interface FoundComposables {
  candidates: ComposableCandidate[];
  /** The starts of the statements read here, reported or not, which no other check reads. */
  statements: Set<number>;
}

/**
 * Finds a `.uf.ts` module's composables: its function declarations named `use*` and exported by
 * name. A default export, a `use*` function the module keeps to itself, an exported function
 * named otherwise, and a composable written as a value are UF2035.
 */
export function findComposables(
  program: AST.Program,
  exported: ReadonlySet<string>,
  reporter: Reporter,
): FoundComposables {
  const candidates: ComposableCandidate[] = [];
  const statements = new Set<number>();
  const functions = new Map<string, AST.Function>();
  for (const statement of program.body) {
    const fn =
      statement.type === "FunctionDeclaration"
        ? statement
        : statement.type === "ExportNamedDeclaration" &&
            statement.declaration?.type === "FunctionDeclaration"
          ? statement.declaration
          : undefined;
    if (fn?.id) functions.set(fn.id.name, fn);
  }
  for (const statement of program.body) {
    switch (statement.type) {
      case "ExportDefaultDeclaration":
        statements.add(statement.start);
        reporter.report(
          "UF2035",
          statement,
          "A module of composables has no default export: each composable is a named export, which a component imports by its name.",
          { help: DECLARATION_HELP },
        );
        continue;
      case "FunctionDeclaration":
      case "ExportNamedDeclaration": {
        let fn: AST.Function | undefined;
        if (statement.type === "FunctionDeclaration") fn = statement;
        else {
          const named = statement as AST.ExportNamedDeclaration;
          if (named.declaration?.type !== "FunctionDeclaration") {
            exportedValue(named);
            continue;
          }
          fn = named.declaration;
        }
        if (!fn?.id) continue;
        const { name } = fn.id;
        const isExported = statement.type === "ExportNamedDeclaration" || exported.has(name);
        if (COMPOSABLE_NAME.test(name) && isExported) {
          statements.add(statement.start);
          candidates.push({ name, node: fn, span: { start: statement.start, end: statement.end } });
        } else if (COMPOSABLE_NAME.test(name)) {
          statements.add(statement.start);
          reporter.report(
            "UF2035",
            fn.id,
            `\`${name}\` is named as a composable, and the module does not export it: a composable is a named export, compiled to a module of its own on every target.`,
            { help: `Export it: \`export function ${name}(…) { … }\`.` },
          );
        } else if (isExported) {
          statements.add(statement.start);
          reporter.report(
            "UF2035",
            fn.id,
            `\`${name}\` is exported from a module of composables, and a composable's name is \`use\` and an upper-case letter.`,
            {
              help: "Name it as a composable, as in `useToggle`, or move it to a shared `.ts` module.",
            },
          );
        }
        continue;
      }
      default:
        continue;
    }
  }
  return { candidates, statements };

  /** `export const useX = …` and `export { useX }`: what an export statement without a function exports. */
  function exportedValue(statement: AST.ExportNamedDeclaration): void {
    const { declaration } = statement;
    if (declaration?.type === "VariableDeclaration") {
      const values = declaration.declarations.filter(
        (declarator) =>
          declarator.id.type === "Identifier" &&
          (declarator.init?.type === "ArrowFunctionExpression" ||
            declarator.init?.type === "FunctionExpression"),
      );
      if (!values.length) return;
      statements.add(statement.start);
      for (const declarator of values) {
        reporter.report(
          "UF2035",
          declarator.id,
          `\`${(declarator.id as AST.BindingIdentifier).name}\` is a function written as a value, and a composable is a function declaration.`,
          { help: DECLARATION_HELP },
        );
      }
      return;
    }
    if (declaration || statement.source || statement.exportKind === "type") return;
    const own = statement.specifiers.filter(
      (specifier) =>
        specifier.exportKind !== "type" &&
        specifier.local.type === "Identifier" &&
        functions.has(specifier.local.name),
    );
    if (!own.length || own.length !== statement.specifiers.length) return;
    statements.add(statement.start);
    for (const specifier of own) {
      const local = (specifier.local as AST.IdentifierReference).name;
      const name = exportName(specifier.exported);
      if (name === "default") {
        reporter.report(
          "UF2035",
          specifier,
          `\`${local}\` is exported as the default: each composable is a named export, which a component imports by its name.`,
          { help: `Export it by its name: \`export { ${local} };\`.` },
        );
      } else if (name !== local && COMPOSABLE_NAME.test(local)) {
        reporter.report(
          "UF2035",
          specifier,
          `\`${local}\` is exported as \`${name}\`: a composable is exported under its own name, which names its module on every target.`,
          { help: `Name the function \`${name}\`, and export it as declared.` },
        );
      }
    }
  }
}

/** What analysing a composable needs to know about its module. */
export interface ComposableModule {
  parsed: ParsedModule;
  types: ModuleTypes;
  shapes: Shapes;
  scopes: Scopes;
  authoring: ReadonlyMap<object, AuthoringApi | undefined>;
  reporter: Reporter;
  /** The components a template may render: none, since a composable renders nothing. */
  components: ReadonlyMap<object, ComponentInfo | undefined>;
  keys: ReadonlyMap<object, InjectionKeyInfo>;
  passThrough: PassThrough;
  shared: SharedValues;
  /** The names the module imports from other `.uf.ts` modules, by the identifier of each. */
  composableImports: ReadonlySet<object>;
  /** What a written type gives a value (`SetupContext.writtenType`). */
  readonly writtenType: (type: AST.TSType) => { kinds: Kinds; complete: boolean };
}

/** A composable, lowered, with the API a caller reads of it. */
export interface AnalyzedComposable {
  composable: UfComposable;
  api: ComposableApi;
}

/**
 * Checks a composable's parameters, its setup and its return, and lowers it into IR (ADR-0069):
 * `undefined` when it has an error.
 */
export function analyzeComposable(
  candidate: ComposableCandidate,
  typeParameters: TypeParameter[],
  module: ComposableModule,
): AnalyzedComposable | undefined {
  const { parsed, types, reporter, scopes } = module;
  const { source } = parsed;
  const mark = reporter.diagnostics.length;
  const fn = candidate.node;
  const id = fn.id!;
  if (fn.async || fn.generator) {
    reporter.report(
      "UF2035",
      id,
      `\`${candidate.name}\` is ${fn.async ? "asynchronous" : "a generator"}, and a composable is a plain function whose setup runs once, when the component that calls it is set up.`,
      { help: "Remove the keyword, and await in a returned function or a lifecycle hook." },
    );
  }
  checkTypeParameters(fn, types, parsed, reporter);
  const parameters = composableParameters(fn, module);
  const block = fn.body;
  const body = (block?.body ?? []).filter((statement) => statement.type !== "EmptyStatement");
  const last = body.at(-1);
  const returned = last?.type === "ReturnStatement" ? last : undefined;
  if (!returned?.argument || returned.argument.type !== "ObjectExpression") {
    reporter.report(
      "UF2035",
      returned ?? last ?? id,
      `\`${candidate.name}\`'s last statement must return a shorthand object of what a caller uses: its state, derived values, functions and constants.`,
      { help: "End the composable with `return { on, toggle };`." },
    );
  }
  if (calledComposables(fn, candidate, module)) return undefined;
  const props: PropsAnalysis = {
    props: [],
    propsParameter: undefined,
    bindings: parameters.bindings,
    types: [],
    byName: new Map(parameters.reads.map((read) => [read.name, read])),
    byDeclaration: parameters.byDeclaration,
    object: undefined,
    failed: false,
  };
  const setup = declareSetup({
    source,
    reporter,
    scopes,
    types: types.table,
    shapes: module.shapes,
    writtenType: module.writtenType,
    comments: parsed.comments,
    authoring: module.authoring,
    component: fn,
    props,
    statements: body.slice(0, -1),
    returned: undefined,
    keys: module.keys,
    composable: true,
  });
  const render: RenderContext = {
    source,
    reporter,
    scopes,
    types: types.table,
    shapes: module.shapes,
    component: fn,
    props: props.byName,
    propsByDeclaration: props.byDeclaration,
    propsObject: undefined,
    loopVariables: new Map(),
    enclosing: [],
    setup: setup.scope,
    attached: new Map(),
    bindings: [...props.bindings, ...setup.bindings],
    comments: parsed.comments,
    facts: { nestedCalls: [], getterKinds: new Map(), tickCallbacks: [], passed: new Map() },
    components: module.components,
    slots: undefined,
    passThrough: module.passThrough,
    shared: module.shared,
  };
  setup.lower(render);
  const returns =
    returned?.argument?.type === "ObjectExpression"
      ? returnedMembers(returned.argument, candidate, render)
      : [];
  setup.finish(render);
  checkRules({
    name: candidate.name,
    span: candidate.span,
    render,
    setup,
    props,
    root: undefined,
    program: parsed.program,
    failed: reporter.hasErrorsSince(mark),
  });
  if (reporter.hasErrorsSince(mark)) return undefined;
  const bindings = render.bindings.toSorted((a, b) => a.span.start - b.span.start);
  const names = new Set(closure([fn.typeParameters, fn.params, fn.body], types.table));
  const composable = createComposable(candidate.name, candidate.span, parameters.parameters, {
    typeParameters,
    types: types.declarations
      .filter((declaration) => names.has(declaration.name))
      .map((declaration) => declaration.name),
    bindings,
    setup: setup.items,
    returns: returns.map(({ member }) => member),
  });
  return {
    composable,
    api: composableApi(composable, returns, bindings),
  };
}

/** A composable's parameters, each an `argument` binding read as a destructured prop is. */
function composableParameters(
  fn: AST.Function,
  module: ComposableModule,
): {
  parameters: ComposableParameter[];
  bindings: Binding[];
  reads: PropBinding[];
  byDeclaration: Map<object, PropBinding>;
} {
  const { reporter, parsed } = module;
  const parameters: ComposableParameter[] = [];
  const bindings: Binding[] = [];
  const reads: PropBinding[] = [];
  const byDeclaration = new Map<object, PropBinding>();
  for (const parameter of fn.params) {
    if (parameter.type !== "Identifier") {
      reporter.report(
        "UF2035",
        parameter,
        parameter.type === "AssignmentPattern"
          ? "A composable's parameter has no default value: each target reads its arguments as the caller passes them."
          : "A composable's parameter is a name of its own, never a pattern or a rest parameter: its kind follows from its annotation.",
        {
          help:
            parameter.type === "AssignmentPattern"
              ? "Make it optional, `initial?: boolean`, and read `initial ?? false` where the body needs the default."
              : "Declare each parameter by its name, with its type: `initial: boolean`.",
        },
      );
      continue;
    }
    const annotation = parameter.typeAnnotation?.typeAnnotation;
    if (!annotation) {
      reporter.report(
        "UF2035",
        parameter,
        `\`${parameter.name}\` has no type: a composable's parameter is annotated, and its type says how the body reads it, a value once, a getter (\`() => T\`) as it changes, a callback from client code.`,
        { help: `Annotate it: \`${parameter.name}: boolean\`.` },
      );
      continue;
    }
    const kind = parameterKind(annotation);
    // oxc's types leave `optional` out of a binding identifier, which a parameter sets.
    const optional = (parameter as { optional?: boolean }).optional === true;
    const at = { start: parameter.start, end: parameter.end };
    const binding = createBinding(parameter.name, "argument", {
      start: parameter.start,
      end: parameter.start + parameter.name.length,
    });
    const kinds: Kinds = kind === "value" ? module.writtenType(annotation).kinds : FUNCTION;
    const read: PropBinding = {
      name: parameter.name,
      id: binding.id,
      kinds: optional ? union(kinds, UNDEFINED) : kinds,
      ...(kind === "callback" ? { callback: true as const } : {}),
    };
    bindings.push(binding);
    reads.push(read);
    byDeclaration.set(parameter, read);
    parameters.push(
      createComposableParameter(
        parameter.name,
        kind,
        createTypeText(parsed.source.slice(annotation.start, annotation.end), {
          start: annotation.start,
          end: annotation.end,
        }),
        binding.id,
        at,
        optional,
      ),
    );
  }
  return { parameters, bindings, reads, byDeclaration };
}

/**
 * How a parameter is read, by its annotation (ADR-0069): a function type without parameters is a
 * getter, any other function type a callback, and anything else a value.
 */
function parameterKind(annotation: AST.TSType): ComposableParameterKind {
  if (annotation.type !== "TSFunctionType") return "value";
  return annotation.params.length ? "callback" : "getter";
}

/**
 * Reports each call of another composable in a composable's body (UF2035): of one the module
 * imports from a `.uf.ts` module, or declares itself. Returns whether it reported, since the
 * walk of the body would report the call again.
 */
function calledComposables(
  fn: AST.Function,
  candidate: ComposableCandidate,
  module: ComposableModule,
): boolean {
  let found = false;
  visit(fn.body, (node) => {
    if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
    const { callee } = node;
    const resolution = module.scopes.resolve(callee);
    const imported =
      resolution.kind === "import" && module.composableImports.has(resolution.declaration);
    const own =
      resolution.kind === "variable" &&
      resolution.declares === "function" &&
      (resolution.scope as AST.Node).type === "Program" &&
      COMPOSABLE_NAME.test(callee.name);
    if (!imported && !own) return;
    found = true;
    module.reporter.report(
      "UF2035",
      callee,
      `\`${candidate.name}\` calls the composable \`${callee.name}\`: a composable compiles to one module per target, and one that calls another is not supported.`,
      {
        help: `Call \`${callee.name}\` in the component, and pass what \`${candidate.name}\` needs from it as an argument.`,
      },
    );
  });
  return found;
}

/** The binding kinds a composable returns, with the member kind each gives its API. */
const RETURNED: Readonly<Partial<Record<SetupBinding["kind"], ComposableMemberApi["kind"]>>> = {
  state: "state",
  derived: "derived",
  localFn: "function",
  localConst: "constant",
};

/** A returned member, with the binding it names. */
interface Returned {
  member: ReturnedMember;
  binding: SetupBinding;
}

/**
 * The members of a composable's returned object (ADR-0069): shorthand properties, each naming
 * state, a derived value, a local function or a constant of its setup (UF2035 otherwise).
 */
function returnedMembers(
  object: AST.ObjectExpression,
  candidate: ComposableCandidate,
  render: RenderContext,
): Returned[] {
  const { reporter, scopes, setup } = render;
  const members: Returned[] = [];
  for (const property of object.properties) {
    if (
      property.type !== "Property" ||
      !property.shorthand ||
      property.value.type !== "Identifier"
    ) {
      reporter.report(
        "UF2035",
        property,
        `\`${candidate.name}\` returns an object with a member that is not a shorthand property: each member names a binding of its setup, which every target returns by its name.`,
        { help: "Return each binding by its name: `return { on, toggle };`." },
      );
      continue;
    }
    const value = property.value;
    const resolution = scopes.resolve(value);
    const own = resolution.kind === "variable" && resolution.scope === render.component;
    const binding = own ? setup.bindings.get(resolution.declaration) : undefined;
    // A declaration the setup rejected is reported where it is written.
    if (own && !binding) continue;
    if (!binding || RETURNED[binding.kind] === undefined) {
      reporter.report(
        "UF2035",
        value,
        `\`${value.name}\` is returned, and is not state, a derived value, a function or a constant of \`${candidate.name}\`'s setup: what a composable returns is its own.`,
        { help: "Return the setup's own bindings, and let the caller keep its arguments." },
      );
      continue;
    }
    members.push({
      member: createReturnedMember(binding.name, binding.id, {
        start: property.start,
        end: property.end,
      }),
      binding,
    });
  }
  return members;
}

/**
 * What a caller reads of a composable (ADR-0069): its parameters, its members by their kinds and
 * types, each function's flags from its summary, and whether its setup runs code in the browser.
 */
function composableApi(
  composable: UfComposable,
  returns: readonly Returned[],
  bindings: Binding[],
): ComposableApi {
  // Its setup, as a component's without props or a template, for the summaries of its functions.
  const owner = createComponent(
    composable.name,
    createFragment([], { start: composable.span.end, end: composable.span.end }),
    composable.span,
    [],
    undefined,
    [],
    bindings,
    composable.setup,
  );
  const summaries = summarize(owner);
  const items = new Map(
    composable.setup.flatMap((item) => ("binding" in item ? [[item.binding, item] as const] : [])),
  );
  const members = returns.map(({ binding }): ComposableMemberApi => {
    const kind = RETURNED[binding.kind]!;
    const item = items.get(binding.id);
    if (item?.kind === "Function") {
      const summary = summaries.get(binding.id);
      const pure = summary !== undefined && impurity(summary) === undefined;
      return {
        name: binding.name,
        kind,
        ...(item.function.async ? { async: true as const } : {}),
        ...(pure ? { pure: true as const } : { client: true as const }),
      };
    }
    const type = item && "type" in item ? item.type?.code : undefined;
    return { name: binding.name, kind, ...(type !== undefined ? { type } : {}) };
  });
  const hasEffects = composable.setup.some(
    (item) => item.kind === "Watch" || item.kind === "WatchEffect" || item.kind === "Lifecycle",
  );
  return {
    name: composable.name,
    ...(composable.typeParameters
      ? { typeParameters: composable.typeParameters.map(({ name }) => name) }
      : {}),
    parameters: composable.parameters.map((parameter) => ({
      name: parameter.name,
      kind: parameter.kind,
      ...(parameter.optional ? { optional: true as const } : {}),
      type: parameter.type.code,
    })),
    members,
    ...(hasEffects ? { hasEffects: true as const } : {}),
  };
}

/** Visits every node under a node, in source order. */
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
