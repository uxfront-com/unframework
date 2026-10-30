// How the Vue output spells the component's bindings (ADR-0035, ADR-0045): the script is the
// source's own code, so it reads a ref through `.value` as written; the template reads a setup ref
// without it, because Vue unwraps a `<script setup>` binding's ref in templates. A binding whose
// name Vue reserves is declared, and read everywhere, under a local name of its own.
import {
  codeKind,
  codeNames,
  NameScope,
  parseCodeSource,
  parseExpressionSource,
  sourceNames,
  typeNames as typesOf,
} from "@unframework/codegen";
import type { CodeKind, RewriteRules, RewriteSite } from "@unframework/codegen";
import { codeOf } from "@unframework/ir";
import type {
  Binding,
  BindingId,
  BindingKind,
  Code,
  FunctionCode,
  TypeText,
  UfComponent,
  UfModule,
} from "@unframework/ir";

/**
 * The globals Vue's template compiler never prefixes (compiler-core's `canPrefix`: shared's
 * `GLOBALS_ALLOWED` and `require`): a template expression reads them, and nothing else that is
 * not a binding of the component.
 */
export const VUE_TEMPLATE_GLOBALS: ReadonlySet<string> = new Set([
  ..."Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol".split(
    ",",
  ),
  "require",
]);

/**
 * The names a component's script cannot declare as they are:
 * - Vue's compiler macros: vue-tsc declares each one in the script's scope, so a local of the
 *   same name is TS2451 (and `const { defineProps } = defineProps<P>()` reads itself);
 * - the globals Vue's template compiler never prefixes ({@link VUE_TEMPLATE_GLOBALS}): in any
 *   expression but a lone identifier, `Map + label` reads the global `Map`, whatever the script
 *   declares. The prop and setup names the analyser accepts leave out the globals expressions
 *   may read (ADR-0034), but not these.
 */
export const VUE_RESERVED: ReadonlySet<string> = new Set([
  "defineProps",
  "withDefaults",
  "defineEmits",
  "defineExpose",
  "defineOptions",
  "defineSlots",
  "defineModel",
  ...VUE_TEMPLATE_GLOBALS,
]);

/** A component's names in its Vue output: the scope the script claims from, and the renames. */
export class VueNames {
  /** The output's names: the source's, Vue's reserved ones, and every name the target claims. */
  readonly scope: NameScope;
  /** The local name of each binding declared under another name than the source's. */
  readonly #locals = new Map<BindingId, string>();
  /** The object form's props object, when the script names it otherwise than the source. */
  #propsObject: { written: string; local: string } | undefined;
  /**
   * The module's top-level names (ADR-0070): its constants and the locals of its value imports,
   * each with the name the output declares it by.
   */
  readonly #module = new Map<string, string>();

  /** What the owner reaches of its module (ADR-0070). */
  readonly reach: ModuleReach;
  /** The owner's own binding names, which its own text's `typeof` queries read. */
  readonly #own: ReadonlySet<string>;

  constructor(component: UfComponent, module: UfModule, typeTexts: readonly TypeText[] = []) {
    const reserved = sourceNames(component, module);
    // The source reads `nextTick` as the authoring API, which `vue`'s takes the place of: where
    // every use is written `nextTick`, the import keeps the name. No local of that name can be
    // in scope there, or the source's `nextTick` would read it.
    const apis = codeOf(component).flatMap(({ code }) =>
      code.refs.flatMap((reference) =>
        reference.kind === "Api"
          ? [
              code.code.slice(
                reference.span.start - code.span.start,
                reference.span.end - code.span.start,
              ),
            ]
          : [],
      ),
    );
    if (apis.length > 0 && apis.every((name) => name === "nextTick")) reserved.delete("nextTick");
    this.scope = new NameScope(reserved);
    this.scope.reserve(...VUE_RESERVED);
    // The module's names the output declares sit beside the setup's at the top of
    // `<script setup>`, or of a composable's module (ADR-0070): each is taken before anything
    // else claims a name, a module name Vue reserves is declared under a name of its own, and a
    // setup binding that shadows one is too.
    this.reach = moduleReach(component, module, typeTexts);
    this.#own = new Set(
      component.bindings
        .filter((binding) => scriptScoped(binding.kind))
        .map((binding) => binding.name),
    );
    const moduleNames = [...this.reach.values];
    this.scope.reserve(...moduleNames);
    // A renamed module name must not take a name its constants' own code uses.
    for (const constant of module.constants ?? []) {
      if (this.reach.values.has(constant.name))
        this.scope.reserve(...codeNames(constant.value.code));
    }
    // The setup keeps its names, which its macros, slots and template refs are keyed by; a
    // module name one of them shadows is renamed instead, as one Vue reserves is.
    // A template's own variable shadows a script name in the template alone, where Vue reads it.
    const setup = new Set([
      ...component.bindings
        .filter((binding) => scriptScoped(binding.kind))
        .map((binding) => binding.name),
      ...(component.propsParameter?.name ? [component.propsParameter.name] : []),
    ]);
    for (const name of moduleNames) {
      const renamed = VUE_RESERVED.has(name) || setup.has(name);
      this.#module.set(name, renamed ? this.scope.claim(name) : name);
    }
    // A setup binding Vue reserves is declared under a name of its own, before anything else
    // claims one: every reference reads it there.
    for (const binding of component.bindings) {
      if (binding.kind === "moduleConst" || binding.kind === "import") {
        const local = this.#module.get(binding.name);
        if (local !== undefined && local !== binding.name) this.#locals.set(binding.id, local);
      } else if (declaredBySetup(binding.kind) && VUE_RESERVED.has(binding.name)) {
        this.#locals.set(binding.id, this.scope.claim(binding.name));
      }
    }
  }

  /**
   * The owner's own statement with each module name a `typeof` queries spelled as the output
   * names it (ADR-0070): a query of one of the owner's bindings reads the binding.
   */
  ownQueries(statement: string): string {
    return renamedQueries(statement, "statements", this, { skip: this.#own });
  }

  /** The name the output declares one of the module's constants or value imports by. */
  moduleLocal(name: string): string {
    return this.#module.get(name) ?? name;
  }

  /** Declares a binding under another local name (a destructured prop Vue reserves). */
  rename(binding: BindingId, local: string): void {
    this.#locals.set(binding, local);
  }

  /** The object form's props object goes by `local` where the source writes `written`. */
  renamePropsObject(written: string, local: string): void {
    this.#propsObject = { written, local };
  }

  /** The name the output declares a binding by. */
  local(binding: Binding): string {
    return this.#locals.get(binding.id) ?? binding.name;
  }

  /**
   * A reference as the script writes it: as the source does (`count.value`, `props.label`),
   * with a renamed binding's local name.
   */
  script(binding: Binding, written: string): string {
    const object = this.#propsObject;
    switch (binding.kind) {
      case "prop":
        // The object form's reference spans the whole `props.label`: only the object's name
        // changes. A destructured prop is renamed as any other binding.
        if (object && written.startsWith(`${object.written}.`)) {
          return `${object.local}${written.slice(object.written.length)}`;
        }
        break;
      case "loopVar":
      case "state":
      case "derived":
      case "templateRef":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
      case "model":
      case "slots":
      case "slotScope":
      case "context":
      case "component":
      case "moduleConst":
      case "import":
      case "argument":
      case "usedState":
      case "usedDerived":
      case "usedFn":
      case "usedConst":
        break;
      default:
        return unreachable(binding.kind);
    }
    const local = this.#locals.get(binding.id);
    return local === undefined ? written : `${local}${written.slice(binding.name.length)}`;
  }

  /**
   * A reference as the template writes it: a setup ref's value (`state`, `derived`,
   * `templateRef`, `model`, an injected ref) is the ref itself, which Vue unwraps; everything
   * else as the script does.
   */
  template(binding: Binding, written: string): string {
    switch (binding.kind) {
      case "state":
      case "derived":
      case "templateRef":
      case "model":
        return this.local(binding);
      // An injected ref is read as `x.value`, the reference's whole text (ADR-0054), and so is a
      // composable's returned ref (ADR-0069): the template unwraps them as it unwraps the setup's
      // own refs.
      case "context":
      case "usedState":
      case "usedDerived":
        return written === `${binding.name}.value`
          ? this.local(binding)
          : this.script(binding, written);
      case "prop":
      case "loopVar":
      case "localConst":
      case "localFn":
      case "localVar":
      case "emit":
      case "slots":
      case "slotScope":
      case "component":
      case "moduleConst":
      case "import":
      case "argument":
      case "usedFn":
      case "usedConst":
        return this.script(binding, written);
      default:
        return unreachable(binding.kind);
    }
  }

  /**
   * The rules that spell the script's code: as written, renamed bindings and APIs aside.
   * `nextTick` gives the local name `vue`'s `nextTick` is imported under.
   */
  scriptRules(nextTick: () => string): RewriteRules {
    return {
      binding: (_reference, binding, written) => this.script(binding, written),
      api: (reference) => {
        switch (reference.api) {
          case "nextTick":
            return nextTick();
          default:
            return unreachable(reference.api);
        }
      },
    };
  }

  /** The rules that spell the template's code, its listeners' included. */
  templateRules(): RewriteRules {
    return {
      binding: (_reference, binding, written, _site: RewriteSite) =>
        this.template(binding, written),
    };
  }
}

/** What a component or a composable reaches of its module (ADR-0070). */
export interface ModuleReach {
  /** The constants and value imports its output declares and imports. */
  values: Set<string>;
}

/**
 * The module's names a component or a composable reaches (ADR-0070): the imported values and the
 * constants it reads, those its constants read in turn, and those a `typeof` names
 * (`type Size = keyof typeof SIZES`). A query in the owner's own types and code reads a module
 * value only where no binding of the owner shadows it; one in the module's text (a reached
 * constant's annotation, or a module type the output declares) always does. `typeTexts` adds
 * what the owner's IR does not hold, a composable's parameter types.
 */
export function moduleReach(
  owner: UfComponent,
  module: UfModule,
  typeTexts: readonly TypeText[] = [],
): ModuleReach {
  const shadowed = new Set(
    owner.bindings.filter((binding) => scriptScoped(binding.kind)).map((binding) => binding.name),
  );
  const moduleValues = new Set([
    ...(module.constants ?? []).map(({ name }) => name),
    ...(module.moduleImports ?? []).flatMap(({ names }) => names.map(({ local }) => local)),
  ]);
  const values = new Set(
    owner.bindings
      .filter((binding) => binding.kind === "import" || binding.kind === "moduleConst")
      .map((binding) => binding.name),
  );
  const query = (name: string) => {
    if (moduleValues.has(name)) values.add(name);
  };
  for (const { text, kind, bound } of ownText(owner)) {
    for (const { name } of typeQueries(text, kind, bound)) if (!shadowed.has(name)) query(name);
  }
  // A composable's parameter list sees its parameters, never its body's locals.
  const parameters = owner.bindings
    .filter((binding) => binding.kind === "argument")
    .map((binding) => binding.name);
  for (const { code } of typeTexts) {
    for (const { name } of typeQueries(code, "type", parameters)) query(name);
  }
  // The module's declarations the output prints: the owner's own, and those its constants name.
  const declared = new Set(owner.types);
  const named = new Set<string>();
  for (let size = -1; size !== values.size + declared.size;) {
    size = values.size + declared.size;
    for (const constant of module.constants ?? []) {
      if (!values.has(constant.name)) continue;
      // A constant's references name a binding by `name@offset`; a module's names are unique.
      for (const reference of constant.value.refs) {
        if (reference.kind === "Binding") values.add(nameOf(reference.binding));
      }
      if (constant.type) {
        for (const name of typesOf(constant.type)) named.add(name);
        for (const { name } of typeQueries(constant.type.code, "type")) query(name);
      }
      for (const name of codeNames(constant.value.code)) named.add(name);
      for (const { name } of typeQueries(constant.value.code, "expression")) query(name);
    }
    for (const declaration of module.types) {
      if (!declared.has(declaration.name) && !named.has(declaration.name)) continue;
      declared.add(declaration.name);
      for (const name of codeNames(declaration.code, "statements")) named.add(name);
      for (const { name } of typeQueries(declaration.code, "statements")) query(name);
    }
  }
  return { values };
}

/**
 * Whether a binding of the owner is in scope over its setup's text: not a module's, and not
 * one only the template sees, a list's item or a scoped slot's props.
 */
function scriptScoped(kind: BindingKind): boolean {
  return kind !== "moduleConst" && kind !== "import" && kind !== "loopVar" && kind !== "slotScope";
}

/**
 * The owner's own type text and code, where a `typeof` may sit: every type its IR writes (an
 * annotation, a type argument, a parameter's type) and every piece of its code, which may hold
 * an annotation of its own. A composable's parameter types are its caller's to add.
 */
function ownText(
  owner: UfComponent,
): { text: string; kind: CodeKind | "type"; bound: readonly string[] }[] {
  const found: { text: string; kind: CodeKind | "type"; bound: readonly string[] }[] = [];
  const visit = (node: unknown, bound: readonly string[]): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, bound);
      return;
    }
    if (!node || typeof node !== "object") return;
    // A function's parameters are in scope over its parameters' types and its body.
    if ("parameters" in node && "body" in node && Array.isArray(node.parameters)) {
      const fn = node as FunctionCode;
      const inner = [
        ...bound,
        ...fn.parameters.flatMap((parameter) =>
          parameter.name ? [parameter.name] : (parameter.pattern?.names ?? []),
        ),
      ];
      for (const parameter of fn.parameters) {
        if (parameter.type) found.push({ text: parameter.type.code, kind: "type", bound: inner });
      }
      if (fn.returnType) found.push({ text: fn.returnType.code, kind: "type", bound: inner });
      found.push({ text: fn.body.code, kind: codeKind(fn.body, owner), bound: inner });
      return;
    }
    if ("code" in node && "span" in node && typeof node.code === "string") {
      // Code has references; a `TypeText` has none.
      found.push(
        "refs" in node
          ? { text: node.code, kind: codeKind(node as Code, owner), bound }
          : { text: node.code, kind: "type", bound },
      );
      return;
    }
    for (const value of Object.values(node)) visit(value, bound);
  };
  visit(
    [
      owner.propsParameter,
      owner.props,
      owner.emits,
      owner.slots,
      owner.setup,
      owner.typeParameters,
    ],
    [],
  );
  // The template's own variables, a list's item and a scoped slot's props, are in scope there.
  const template = owner.bindings
    .filter((binding) => binding.kind === "loopVar" || binding.kind === "slotScope")
    .map((binding) => binding.name);
  visit(owner.render, template);
  return found;
}

/**
 * Each identifier a `typeof` queries in type text or code, with its offsets in the text:
 * `SIZES` in `keyof typeof SIZES`, the root `theme` of `typeof theme.dark`. A query that a
 * binding in scope where it sits answers is left out, as TypeScript scopes it: a function's or
 * a function type's parameters, over the whole function; a block's declarations, over the block,
 * a `switch`'s cases one block; a loop's or a `catch`'s own; and `bound`, the names in scope
 * around the text. A type parameter is a type, which no `typeof` reads.
 */
export function typeQueries(
  text: string,
  kind: CodeKind | "type",
  bound: Iterable<string> = [],
): { name: string; start: number; end: number }[] {
  // Type text parses as the type of an assertion, whose offsets the prefix shifts.
  const prefix = kind === "type" ? "null as " : "";
  let root: unknown;
  try {
    root =
      kind === "type"
        ? parseExpressionSource(`${prefix}${text}`).expression
        : parseCodeSource(text, kind).root;
  } catch {
    return [];
  }
  // Statements are a block's body, whose declarations they bind.
  if (Array.isArray(root)) root = { type: "BlockStatement", body: root };
  const found: { name: string; start: number; end: number }[] = [];
  const visit = (node: unknown, scope: ReadonlySet<string>): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, scope);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "TSTypeQuery") {
      let name = node.exprName;
      while (isNode(name) && name.type === "TSQualifiedName") name = name.left;
      if (isNode(name) && name.type === "Identifier" && typeof name.name === "string") {
        if (!scope.has(name.name)) {
          found.push({
            name: name.name,
            start: (name.start as number) - prefix.length,
            end: (name.end as number) - prefix.length,
          });
        }
      }
    }
    const binds = bindings(node);
    const inner = binds.length ? new Set([...scope, ...binds]) : scope;
    for (const [key, value] of Object.entries(node)) if (key !== "parent") visit(value, inner);
  };
  visit(root, new Set(bound));
  return found;
}

/** A node of a parsed tree. */
type Node = { type: string; [key: string]: unknown };

function isNode(value: unknown): value is Node {
  return !!value && typeof value === "object" && typeof (value as Node).type === "string";
}

/** The function-like nodes, whose parameters bind over the whole node. */
const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
  "TSFunctionType",
  "TSConstructorType",
  "TSMethodSignature",
  "TSCallSignatureDeclaration",
  "TSConstructSignatureDeclaration",
]);

/** The names a node binds over itself: see {@link typeQueries}. */
function bindings(node: Node): string[] {
  const names: string[] = [];
  // A type parameter is a type, which a `typeof` never reads: only value bindings count.
  if (FUNCTIONS.has(node.type)) {
    for (const parameter of (node.params as unknown[] | undefined) ?? [])
      patternNames(parameter, names);
  } else if (node.type === "BlockStatement" || node.type === "StaticBlock") {
    for (const statement of (node.body as unknown[] | undefined) ?? []) declared(statement, names);
  } else if (node.type === "SwitchStatement") {
    // A `switch`'s cases share one block.
    for (const each of (node.cases as unknown[] | undefined) ?? []) {
      if (!isNode(each)) continue;
      for (const statement of (each.consequent as unknown[] | undefined) ?? []) {
        declared(statement, names);
      }
    }
  } else if (node.type === "ForStatement") {
    declared(node.init, names);
  } else if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
    declared(node.left, names);
  } else if (node.type === "CatchClause") {
    patternNames(node.param, names);
  }
  return names;
}

/** The names a statement declares in its block: its variables, its function's or class's name. */
function declared(statement: unknown, names: string[]): void {
  if (!isNode(statement)) return;
  if (statement.type === "VariableDeclaration") {
    for (const each of (statement.declarations as unknown[] | undefined) ?? []) {
      if (isNode(each)) patternNames(each.id, names);
    }
  } else if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
    patternNames(statement.id, names);
  }
}

/** The names a binding pattern binds: `a`, `{ b, c: d }`, `[e, ...f]`, `g = 1`. */
function patternNames(pattern: unknown, names: string[]): void {
  if (!isNode(pattern)) return;
  switch (pattern.type) {
    case "Identifier":
      if (typeof pattern.name === "string") names.push(pattern.name);
      return;
    case "AssignmentPattern":
      patternNames(pattern.left, names);
      return;
    case "RestElement":
      patternNames(pattern.argument, names);
      return;
    case "ArrayPattern":
      for (const element of (pattern.elements as unknown[] | undefined) ?? []) {
        patternNames(element, names);
      }
      return;
    case "ObjectPattern":
      for (const property of (pattern.properties as unknown[] | undefined) ?? []) {
        if (isNode(property)) {
          patternNames(property.type === "RestElement" ? property.argument : property.value, names);
        }
      }
      return;
    case "TSParameterProperty":
      patternNames(pattern.parameter, names);
      return;
    default:
      return;
  }
}

/**
 * Type text or code with each module name a `typeof` queries written as the output names it.
 * `skip` names the queries that read something else there, the owner's own bindings in the
 * owner's text; `bound` is as {@link typeQueries} takes it.
 */
export function renamedQueries(
  text: string,
  kind: CodeKind | "type",
  names: VueNames,
  { skip = new Set(), bound = [] }: { skip?: ReadonlySet<string>; bound?: Iterable<string> } = {},
): string {
  let written = "";
  let last = 0;
  const queries = typeQueries(text, kind, bound).toSorted((a, b) => a.start - b.start);
  for (const { name, start, end } of queries) {
    const local = skip.has(name) ? name : names.moduleLocal(name);
    if (local === name) continue;
    written += `${text.slice(last, start)}${local}`;
    last = end;
  }
  return `${written}${text.slice(last)}`;
}

/** The name of a binding id, `name@offset`. */
export function nameOf(id: string): string {
  return id.slice(0, id.lastIndexOf("@"));
}

/**
 * Whether the setup declares a binding of this kind (the script declares it as the source
 * does), as opposed to the props pattern or a template's list.
 */
function declaredBySetup(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
    case "loopVar":
    case "slotScope":
    case "component":
    // The module declares these, under their own names (ADR-0070).
    case "moduleConst":
    case "import":
      return false;
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
    case "model":
    case "slots":
    case "context":
    case "argument":
    case "usedState":
    case "usedDerived":
    case "usedFn":
    case "usedConst":
      return true;
    default:
      return unreachable(kind);
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
export function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
