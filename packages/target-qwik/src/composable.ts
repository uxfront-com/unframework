// A `.uf.ts` module's composable as a Qwik `use*` hook, `useToggle.ts` (ADR-0069): its setup as a
// component's (./plan.ts, ./setup.ts), with `useSignal`, `useComputed$` and tasks, returning its
// signals and its functions as `$()` QRLs. A hook's `$` scopes capture only what Qwik serialises,
// so its parameters change form where a plain function would be captured (optimizer C02): a
// getter, `() => T`, is the `ReadonlySignal<T>` its caller makes with `useComputed$`, read through
// `.value`, and a callback is the `QRL` its caller makes with `$()`, called as a QRL is. A value is
// taken as it is.
import { parseCodeSource } from "@unframework/codegen";
import type { CodeKind } from "@unframework/codegen";
import type {
  Code,
  ComposableParameter,
  FunctionCode,
  Span,
  UfComponent,
  UfComposable,
  UfModule,
} from "@unframework/ir";

import { unreachable } from "./plan.ts";
import type { OutputNames, SetupPlan } from "./plan.ts";

/** A node of oxc's syntax tree, as far as this walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * A composable as the component whose setup the planner reads: its bindings, its setup and the
 * types it declares, with no props and nothing to render.
 */
export function setupOwner(composable: UfComposable): UfComponent {
  return {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
}

/**
 * A parameter as the hook declares it: a value as written, a getter as the signal of what it
 * returns (`price: ReadonlySignal<number>`), a callback as its QRL (`onLimit: QRL<(count: number)
 * => void>`).
 */
export function parameterCode(parameter: ComposableParameter, names: OutputNames): string {
  const head = `${parameter.name}${parameter.optional ? "?" : ""}: `;
  const type = parameter.type.code;
  switch (parameter.kind) {
    case "value":
      return `${head}${type}`;
    case "getter": {
      // `() => T` returns what follows its arrow; a generic getter's return names its own type
      // parameters, which `ReturnType` reads.
      const returned = /^\(\s*\)\s*=>\s*([\s\S]+)$/.exec(type)?.[1] ?? `ReturnType<${type}>`;
      return `${head}${names.core("ReadonlySignal", { type: true })}<${returned}>`;
    }
    case "callback":
      return `${head}${names.core("QRL", { type: true })}<${type}>`;
    default:
      return unreachable(parameter.kind);
  }
}

/**
 * Reads each getter argument's signal where printed code calls it: `price()` becomes
 * `price.value`, `price?.()` `price?.value` and `price!()` `price!.value`. A getter takes no
 * arguments, so the call is the read. A test of it (`limit ? … : …`) reads the signal itself,
 * which is there where the getter is. `getters` are the names the code calls them by.
 */
export function readGetters(code: string, kind: CodeKind, getters: ReadonlySet<string>): string {
  if (getters.size === 0 || ![...getters].some((name) => code.includes(name))) return code;
  const { root } = parseCodeSource(code, kind);
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isNode(node)) return;
    const callee = node.callee as Node | undefined;
    const asserted = callee?.type === "TSNonNullExpression";
    const named = asserted ? (callee.expression as Node) : callee;
    if (
      node.type === "CallExpression" &&
      named?.type === "Identifier" &&
      getters.has(named.name as string) &&
      (node.arguments as unknown[]).length === 0
    ) {
      const read = node.optional === true ? "?.value" : asserted ? "!.value" : ".value";
      edits.push({ start: node.start, end: node.end, text: `${named.name as string}${read}` });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  let result = code;
  for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`;
  }
  return result;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

/** What a composable's code does that Qwik's hook cannot emit, each at its span. */
export interface ComposableProblem {
  span: Span;
  message: string;
  help: string;
}

/**
 * The reads of a composable's arguments that Qwik's forms of them cannot keep (see the module
 * comment), which the target reports rather than emit output that fails to type-check or
 * behaves otherwise (P2):
 * - a getter read other than by a call or a test (passed on, kept or aliased): it is a
 *   signal, not a function;
 * - a callback read other than by a call or a test, or called in a function of the code's own
 *   (an array method's callback, a comparator, a timer's): a QRL's call gives a promise, which
 *   only the code's own function awaits or leaves to run;
 * - a value whose type holds a function, or a setup `const` whose value holds one by the types
 *   it reads (`const format = options.format`, `const make = options.make()`), read where a `$`
 *   scope captures it (a derived value, a watcher, an effect, a hook, a function client code
 *   calls): Qwik serialises what a `$` scope captures, and no function
 *   (`qwik/valid-lexical-scope`);
 * - a setup `let` or `ref` whose initial value holds a function: Qwik's output makes it a signal,
 *   which serialises its value too.
 *
 * Types are read as written (`WrittenTypes`), through the module's own declarations and the
 * interfaces they extend: an imported type or a class is not seen.
 *
 * A test is what tells only whether the argument was passed: an `if`'s, a loop's or a `?:`'s
 * test, `!`, a comparison, or an operand of `&&`, `||` or `??` that is itself in a test, or on
 * the left of `&&`.
 */
export function composableProblems(composable: UfComposable, plan: SetupPlan): ComposableProblem[] {
  const problems: ComposableProblem[] = [];
  const functions = new Map(
    composable.parameters.map((parameter) => [parameter.binding, parameter]),
  );
  const holding = new Set(
    composable.parameters
      .filter(({ kind, type }) => kind === "value" && holdsFunction(type.code, plan.module))
      .map(({ binding }) => binding),
  );
  // What a setup `const`, `let` or `ref` that reads a value argument holds, by the types it reads,
  // in source order, so a later one reads an earlier one's.
  const nameOf = (id: string) => composable.bindings.find((binding) => binding.id === id)!.name;
  const written = new WrittenTypes(plan.module);
  for (const parameter of composable.parameters) {
    written.known.set(
      parameter.binding,
      parameter.kind === "value" ? { type: typeNode(parameter.type.code), free: false } : FREE,
    );
  }
  for (const item of composable.setup) {
    // A setup function gives what its declared return type says, or else what its body reads.
    if (item.kind === "Function") {
      written.known.set(item.binding, written.ofFunction(item.function));
      continue;
    }
    if (item.kind !== "Const" && item.kind !== "State" && item.kind !== "Variable") continue;
    const value = item.kind === "Const" ? item.value : item.initial;
    if (!value) continue;
    const reads = value.refs.some(
      (reference) =>
        reference.kind === "Binding" &&
        written.known.has(reference.binding) &&
        functions.get(reference.binding)?.kind !== "getter" &&
        functions.get(reference.binding)?.kind !== "callback",
    );
    if (!reads) continue;
    const judged = written.ofCode(value);
    // A `ref` is read through `.value`, its signal's, which the reads below don't follow: what
    // its initial value holds is judged here once.
    written.known.set(item.binding, item.kind === "State" ? FREE : judged);
    if (!written.holds(judged)) continue;
    if (item.kind === "Const") {
      holding.add(item.binding);
      continue;
    }
    const name = nameOf(item.binding);
    problems.push({
      span: value.span,
      message: `\`${name}\` would hold a function, by the types its value reads: the qwik target makes a \`${item.kind === "State" ? "ref" : "let"}\` a signal, which holds only values Qwik can serialise, never a function.`,
      help: `Declare it with \`const\` and call it where it is used, or make the function a callback parameter of its own.`,
    });
  }
  for (const { code, kind, captured } of composableCode(composable, plan)) {
    const references = code.refs.filter(
      (reference) =>
        reference.kind === "Binding" &&
        (functions.has(reference.binding) || holding.has(reference.binding)),
    );
    if (!references.length) continue;
    const uses = identifierUses(code.code, kind);
    for (const reference of references) {
      if (reference.kind !== "Binding") continue;
      const use = uses.get(reference.span.start - code.span.start);
      const parameter = functions.get(reference.binding);
      if (!parameter) {
        if (captured) problems.push(holdsProblem(reference.span, nameOf(reference.binding)));
        continue;
      }
      const { name } = parameter;
      switch (parameter.kind) {
        case "getter":
          if (use?.called || use?.tested) break;
          problems.push({
            span: reference.span,
            message: `\`${name}\` is a getter, which the qwik target takes as the signal its caller computes (\`ReadonlySignal\`): the composable may only call it, never pass it on or keep it as a function.`,
            help: `Call it where its value is read, \`${name}()\`, or read it in a \`computed\` and pass that on.`,
          });
          break;
        case "callback":
          if ((use?.called && !use.nested) || use?.tested) break;
          problems.push({
            span: reference.span,
            message: use?.called
              ? `\`${name}\` is a callback, which the qwik target takes as its caller's QRL, and it is called here in a function of its own: a QRL's call gives a promise, which that function cannot wait for (an array method's callback, a comparator) or which would run after it.`
              : `\`${name}\` is a callback, which the qwik target takes as its caller's QRL: the composable may only call it, never pass it on or keep it as a function.`,
            help: "Call it directly in the body of the composable's function, watcher or hook.",
          });
          break;
        case "value":
          if (captured && holding.has(parameter.binding)) {
            problems.push(holdsProblem(reference.span, name));
          }
          break;
        default:
          unreachable(parameter.kind);
      }
    }
  }
  return problems;
}

/** A read, where a `$` scope captures it, of a binding that may hold a function. */
function holdsProblem(span: Span, name: string): ComposableProblem {
  return {
    span,
    message: `\`${name}\` may hold a function, by its type, and this code runs in a Qwik \`$\` scope, which captures only values Qwik can serialise, never a function.`,
    help: "Make the function a callback parameter of its own, as in `format: (value: number) => string`, and call it where it is used.",
  };
}

/** A piece of a composable's code, its kind, and whether a `$` scope of the hook captures it. */
interface ComposableCode {
  code: Code;
  kind: CodeKind;
  captured: boolean;
}

/** Every piece of a composable's setup code, in source order (see {@link ComposableCode}). */
function composableCode(composable: UfComposable, plan: SetupPlan): ComposableCode[] {
  const found: ComposableCode[] = [];
  const value = (code: Code | undefined) => {
    if (code) found.push({ code, kind: "expression", captured: false });
  };
  const fn = (each: FunctionCode, captured: boolean) =>
    found.push({ code: each.body, kind: each.expression ? "expression" : "statements", captured });
  for (const item of composable.setup) {
    switch (item.kind) {
      case "State":
      case "Variable":
        value(item.initial);
        break;
      case "Const":
        value(item.value);
        break;
      case "Derived":
        fn(item.getter, true);
        break;
      case "Watch":
        for (const source of item.sources) if (source.kind === "Getter") fn(source.getter, true);
        fn(item.callback, true);
        break;
      case "WatchEffect":
        fn(item.effect, true);
        break;
      case "Lifecycle":
        fn(item.callback, true);
        break;
      case "Function": {
        const form = plan.functions.get(item.binding)?.form;
        fn(item.function, form === "qrl" || form === "both");
        break;
      }
      case "Provide":
        value(item.value);
        break;
      case "Inject":
        value(item.fallback);
        break;
      case "TemplateRef":
      case "Id":
      case "Model":
      case "Use":
        break;
      default:
        unreachable(item);
    }
  }
  return found;
}

/** How code uses an identifier, by its offset in the code. */
interface IdentifierUse {
  /** Whether it is the callee of a call, `price()`, `onLimit?.(count)` or `limit!()`. */
  called: boolean;
  /** Whether it is read only as a test of whether it was passed (see `composableProblems`). */
  tested: boolean;
  /** Whether that call is in a function the code declares. */
  nested: boolean;
}

/** Each identifier of code, by its offset, with how the code uses it. */
function identifierUses(code: string, kind: CodeKind): Map<number, IdentifierUse> {
  const { root } = parseCodeSource(code, kind);
  const found = new Map<number, IdentifierUse>();
  const visit = (node: unknown, ancestors: readonly Node[]): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, ancestors);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "Identifier") {
      const parent = ancestors.at(-1);
      const asserted = parent?.type === "TSNonNullExpression";
      const callee = asserted ? parent : node;
      const caller = asserted ? ancestors.at(-2) : parent;
      found.set(node.start, {
        called: caller?.type === "CallExpression" && caller.callee === callee,
        tested: isTested(node, ancestors),
        nested: ancestors.some(isFunction),
      });
    }
    const next = [...ancestors, node];
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value, next);
    }
  };
  visit(root, []);
  return found;
}

/** Whether a node is read only as a test (see `composableProblems`), by its ancestors. */
function isTested(node: Node, ancestors: readonly Node[]): boolean {
  const parent = ancestors.at(-1);
  if (!parent) return false;
  switch (parent.type) {
    case "IfStatement":
    case "ConditionalExpression":
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
      return parent.test === node;
    case "UnaryExpression":
      return parent.operator === "!";
    case "BinaryExpression":
      return ["===", "!==", "==", "!="].includes(parent.operator as string);
    case "LogicalExpression":
      return (
        (parent.operator === "&&" && parent.left === node) ||
        isTested(parent, ancestors.slice(0, -1))
      );
    default:
      return false;
  }
}

function isFunction(node: Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

/**
 * Whether a type as written may hold a function: a function or constructor type, a method or a
 * call signature, \`Function\`, or one of these in a member, an element or a union, here or
 * through the module's own type declarations.
 */
function holdsFunction(type: string, module: UfModule, seen = new Set<string>()): boolean {
  const { root } = parseCodeSource(`let value: ${type};`, "statements");
  return nodesHoldFunction(root, module, seen);
}

function nodesHoldFunction(root: unknown, module: UfModule, seen: Set<string>): boolean {
  let holds = false;
  visitNodes(root, (node) => {
    if (holds) return;
    switch (node.type) {
      case "TSFunctionType":
      case "TSConstructorType":
      case "TSMethodSignature":
      case "TSCallSignatureDeclaration":
      case "TSConstructSignatureDeclaration":
        holds = true;
        return;
      // An interface's `extends` names a type as a reference does.
      case "TSInterfaceHeritage":
      case "TSTypeReference": {
        const name = (node.type === "TSTypeReference" ? node.typeName : node.expression) as Node;
        if (name.type !== "Identifier") return;
        const named = name.name as string;
        if (["Function", "CallableFunction", "NewableFunction"].includes(named)) {
          holds = true;
          return;
        }
        if (seen.has(named)) return;
        seen.add(named);
        const declaration = module.types.find((each) => each.name === named);
        if (declaration) {
          holds = nodesHoldFunction(
            parseCodeSource(declaration.code, "statements").root,
            module,
            seen,
          );
        }
        return;
      }
    }
  });
  return holds;
}

/** Visits every node of a tree, parents first. */
function visitNodes(root: unknown, visit: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visitNodes(item, visit);
    return;
  }
  if (!isNode(root)) return;
  visit(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") visitNodes(value, visit);
  }
}

/**
 * What the written types say of a value: its type, where the code names one, or, where it
 * doesn't, whether it may hold a function at all (`free` when it can't).
 */
interface WrittenType {
  type?: Node;
  free: boolean;
}

const FREE: WrittenType = { free: true };

/** A type as written, `{ format: (value: number) => string }`, as a node. */
function typeNode(type: string): Node {
  const [statement] = parseCodeSource(`let value: ${type};`, "statements").root as Node[];
  const [declarator] = statement!.declarations as Node[];
  return ((declarator!.id as Node).typeAnnotation as Node).typeAnnotation as Node;
}

/** Array methods that give the array they are called on, or a copy of it. */
const ARRAY_COPIES = new Set([
  "concat",
  "filter",
  "flat",
  "reverse",
  "slice",
  "sort",
  "toReversed",
  "toSorted",
  "toSpliced",
]);

/** Array methods that give one of its elements. */
const ARRAY_ELEMENTS = new Set(["at", "find", "findLast", "pop", "shift"]);

/** Array methods that give what their callback returns, which may be an element. */
const ARRAY_RESULTS = new Set(["flatMap", "map", "reduce", "reduceRight"]);

/** Array methods that give no function, whatever the array holds. */
const ARRAY_SCALARS = new Set([
  "every",
  "findIndex",
  "findLastIndex",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "keys",
  "lastIndexOf",
  "push",
  "some",
  "toLocaleString",
  "toString",
  "unshift",
]);

/** Expressions whose value is never a function: literals, templates and operators. */
const SCALAR_EXPRESSIONS = new Set([
  "BinaryExpression",
  "Literal",
  "MetaProperty",
  "TemplateLiteral",
  "ThisExpression",
  "UnaryExpression",
  "UpdateExpression",
]);

/**
 * Reads the type of a setup value from the types its code names, as written (ADR-0067's
 * syntactic reading, without an oracle): an argument's annotation, a member's declared type, a
 * call's declared return type, an assertion's type, an array's elements, and the module's own
 * declarations with the interfaces they extend. `known` holds what each binding read so far
 * holds; a binding it doesn't hold is free. Wherever the written types don't give a value's type
 * exactly (a global's call, `Object.assign({}, options)`, a callback with a destructured, default
 * or rest parameter or a block body, a generic function's result, a setup function without a
 * return type), it holds a function exactly when its code reads a binding that holds one: a
 * primitive holds none, so its methods give none. A module interface's or alias's type
 * arguments are substituted; a composable's own type parameter is its caller's to choose, as an
 * imported type is, and is free.
 */
class WrittenTypes {
  readonly known: Map<string, WrittenType> = new Map();
  readonly #module: UfModule;
  /** What the parameters of the callback being read hold, by name (`items.map((item) => …)`). */
  readonly #locals = new Map<string, WrittenType>();

  constructor(module: UfModule) {
    this.#module = module;
  }

  /** Whether a value may hold a function. */
  holds(value: WrittenType): boolean {
    return value.type ? nodesHoldFunction(value.type, this.#module, new Set()) : !value.free;
  }

  /** What a piece of code, an expression, holds. */
  ofCode(code: Code): WrittenType {
    const ids = new Map<number, string>();
    for (const reference of code.refs) {
      if (reference.kind === "Binding")
        ids.set(reference.span.start - code.span.start, reference.binding);
    }
    return this.#of(parseCodeSource(code.code, "expression").root as Node, ids);
  }

  /**
   * What a setup function holds, as a value its callers call: its declared return type, or else
   * a function exactly when its body reads a binding that holds one.
   */
  ofFunction(fn: FunctionCode): WrittenType {
    if (fn.returnType) {
      const returnType = { type: "TSTypeAnnotation", typeAnnotation: typeNode(fn.returnType.code) };
      return { type: { type: "TSFunctionType", returnType, start: 0, end: 0 }, free: false };
    }
    return {
      free: !fn.body.refs.some(
        (reference) =>
          reference.kind === "Binding" && this.holds(this.known.get(reference.binding) ?? FREE),
      ),
    };
  }

  /** Whether a node's code reads a binding that holds a function: what it holds, untyped. */
  #reads(node: Node, ids: ReadonlyMap<number, string>): WrittenType {
    for (const [offset, id] of ids) {
      if (offset < node.start || offset >= node.end) continue;
      if (this.holds(this.known.get(id) ?? FREE)) return { free: false };
    }
    for (const local of identifierNames(node)) {
      const value = this.#locals.get(local);
      if (value && this.holds(value)) return { free: false };
    }
    return FREE;
  }

  #of(node: Node, ids: ReadonlyMap<number, string>): WrittenType {
    const of = (each: Node) => this.#of(each, ids);
    switch (node.type) {
      case "Identifier": {
        const id = ids.get(node.start);
        if (id) return this.known.get(id) ?? FREE;
        return this.#locals.get(node.name as string) ?? FREE;
      }
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
        return of(node.expression as Node);
      case "TSAsExpression": {
        const type = node.typeAnnotation as Node;
        const constant =
          type.type === "TSTypeReference" && (type.typeName as Node).name === "const";
        return constant ? of(node.expression as Node) : { type, free: false };
      }
      case "MemberExpression":
        return this.#member(of(node.object as Node), memberKey(node));
      case "CallExpression":
        return this.#call(node, ids);
      case "ConditionalExpression":
        return this.#join([of(node.consequent as Node), of(node.alternate as Node)]);
      case "LogicalExpression":
        return this.#join([of(node.left as Node), of(node.right as Node)]);
      case "SequenceExpression":
        return of((node.expressions as Node[]).at(-1)!);
      case "ArrayExpression":
        return this.#join(
          (node.elements as (Node | null)[])
            .filter((each): each is Node => each !== null)
            .map((each) => of(each.type === "SpreadElement" ? (each.argument as Node) : each)),
          false,
        );
      case "ObjectExpression":
        return this.#join(
          (node.properties as Node[]).map((each) =>
            of((each.type === "SpreadElement" ? each.argument : each.value) as Node),
          ),
          false,
        );
      case "ArrowFunctionExpression":
      case "FunctionExpression":
      case "ClassExpression":
        return { free: false };
      case "AwaitExpression": {
        const awaited = of(node.argument as Node);
        const type = awaited.type && this.#resolve(awaited.type);
        const name = type?.type === "TSTypeReference" ? (type.typeName as Node).name : undefined;
        const [value] = ((type?.typeArguments as Node | null)?.params as Node[] | undefined) ?? [];
        return (name === "Promise" || name === "PromiseLike") && value
          ? { type: value, free: false }
          : { free: !this.holds(awaited) };
      }
      default:
        if (SCALAR_EXPRESSIONS.has(node.type)) return FREE;
        // Any other expression (`new Map([…])`, a tagged template) by what it reads.
        return this.#join(childExpressions(node).map(of), false);
    }
  }

  /** What a member of a value holds: `key` is its name, or `undefined` for a computed index. */
  #member(object: WrittenType, key: string | undefined): WrittenType {
    if (!object.type) return { free: object.free };
    const type = this.#resolve(object.type);
    const element = elementType(type);
    if (element !== undefined) {
      if (key === "length") return FREE;
      // An index gives an element, and a named member is a method, a function.
      return key === undefined ? { type: element, free: false } : { free: false };
    }
    if (isKeyword(type)) return key === "length" ? FREE : { free: false };
    // A function's `name` and `length`; any other member is a method of it, a function.
    if (isFunctionType(type)) return key === "name" || key === "length" ? FREE : { free: false };
    const member = key === undefined ? undefined : this.#memberType(type, key);
    if (member) return { type: member, free: false };
    return this.holds(object) ? { free: false } : FREE;
  }

  #call(node: Node, ids: ReadonlyMap<number, string>): WrittenType {
    const callee = unwrapped(node.callee as Node);
    const args = (node.arguments as Node[]).map((each) =>
      each.type === "SpreadElement" ? (each.argument as Node) : each,
    );
    // Where no written type gives its result, a call holds what its receiver or its arguments
    // hold, each read as exactly as its own type allows.
    const untyped = (receiver?: WrittenType) =>
      this.#join(
        [...(receiver ? [receiver] : []), ...args.map((each) => this.#of(each, ids))],
        false,
      );
    if (callee.type === "MemberExpression" && !callee.computed) {
      const receiver = this.#of(callee.object as Node, ids);
      const name = memberKey(callee)!;
      const type = receiver.type && this.#resolve(receiver.type);
      // No method of a string, a number, a boolean or a bigint gives a function.
      if (type && isKeyword(type)) return FREE;
      if (type && isFunctionType(type)) {
        if (name === "bind") return receiver;
        if (name === "call" || name === "apply") return this.#returned(type, node, ids);
        if (name === "toString") return FREE;
      }
      const element = type && elementType(type);
      if (element !== undefined) {
        if (ARRAY_COPIES.has(name)) return receiver;
        if (ARRAY_ELEMENTS.has(name)) return { type: element, free: false };
        if (ARRAY_SCALARS.has(name)) return FREE;
        if (ARRAY_RESULTS.has(name)) {
          return this.#callbackResult(name, element, type!, args, node, ids);
        }
        return untyped(receiver);
      }
      const called = this.#member(receiver, name);
      return called.type ? this.#callOf(called.type, node, ids) : untyped(receiver);
    }
    const called = this.#of(callee, ids);
    return called.type ? this.#callOf(called.type, node, ids) : untyped(called);
  }

  /**
   * What calling a value of a type gives: its declared return type, or each one's of a union of
   * functions (`(() => F) | undefined`, an optional call); what the call reads otherwise.
   */
  #callOf(type: Node, node: Node, ids: ReadonlyMap<number, string>): WrittenType {
    const resolved = this.#resolve(type);
    const parts = resolved.type === "TSUnionType" ? (resolved.types as Node[]) : [resolved];
    const functions = parts.map((each) => this.#resolve(each)).filter((each) => !isNullish(each));
    if (functions.length && functions.every(isFunctionType)) {
      return this.#join(functions.map((each) => this.#returned(each, node, ids)));
    }
    return functions.length && !functions.some(isFunctionType) ? FREE : this.#reads(node, ids);
  }

  /**
   * A function type's declared return type, for a call: a generic one's result is whatever its
   * type argument is, so what the call reads.
   */
  #returned(type: Node, node: Node, ids: ReadonlyMap<number, string>): WrittenType {
    const parameters = (type.typeParameters as Node | null | undefined)?.params as
      | Node[]
      | undefined;
    if (parameters?.length) return this.#reads(node, ids);
    return returned(type);
  }

  /**
   * What `map`, `flatMap`, `reduce` or `reduceRight` gives: what its callback returns, with its
   * parameters bound (an element, its index, the array, and a reduction's accumulator, its
   * initial value or an element), and a reduction's initial value. A callback whose parameters
   * aren't all plain names, or whose body is a block, or that isn't written in place, gives what
   * the call reads.
   */
  #callbackResult(
    name: string,
    element: Node,
    array: Node,
    args: readonly Node[],
    node: Node,
    ids: ReadonlyMap<number, string>,
  ): WrittenType {
    const [callback, initial] = args;
    if (!callback) return FREE;
    const inPlace =
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression") &&
      (callback.body as Node).type !== "BlockStatement" &&
      (callback.params as Node[]).every((each) => each.type === "Identifier");
    if (!inPlace) return this.#reads(node, ids);
    const reduces = name === "reduce" || name === "reduceRight";
    const item: WrittenType = { type: element, free: false };
    const start = initial ? this.#join([this.#of(initial, ids), item], false) : item;
    const values: WrittenType[] = reduces
      ? [start, item, FREE, { type: array, free: false }]
      : [item, FREE, { type: array, free: false }];
    const saved = new Map<string, WrittenType | undefined>();
    for (const [index, parameter] of (callback.params as Node[]).entries()) {
      const local = parameter.name as string;
      saved.set(local, this.#locals.get(local));
      this.#locals.set(local, values[index] ?? FREE);
    }
    try {
      const result = this.#of(callback.body as Node, ids);
      return this.#join(reduces ? [start, result] : [result], false);
    } finally {
      for (const [local, value] of saved) {
        if (value === undefined) this.#locals.delete(local);
        else this.#locals.set(local, value);
      }
    }
  }

  /** Several values, any of which a value may be: a type where each has one. */
  #join(values: readonly WrittenType[], typed = true): WrittenType {
    if (typed && values.length && values.every((each) => each.type)) {
      return {
        type: { type: "TSUnionType", types: values.map((each) => each.type), start: 0, end: 0 },
        free: false,
      };
    }
    return values.some((each) => this.holds(each)) ? { free: false } : FREE;
  }

  /**
   * A type with its parentheses, `readonly`, the `null` and `undefined` of a union, `Readonly`,
   * `Partial`, `Required` and `NonNullable`, and the module's own names it reaches resolved, each
   * with its type arguments in place of its type parameters.
   */
  #resolve(type: Node, seen = new Set<string>()): Node {
    switch (type.type) {
      case "TSParenthesizedType":
        return this.#resolve(type.typeAnnotation as Node, seen);
      case "TSTypeOperator":
        return type.operator === "readonly"
          ? this.#resolve(type.typeAnnotation as Node, seen)
          : type;
      case "TSUnionType": {
        const present = (type.types as Node[]).filter(
          (each) => !isNullish(this.#resolve(each, seen)),
        );
        return present.length === 1 ? this.#resolve(present[0]!, seen) : type;
      }
      case "TSTypeReference": {
        const name = (type.typeName as Node).name as string | undefined;
        const typeArguments =
          ((type.typeArguments as Node | null)?.params as Node[] | undefined) ?? [];
        if (name !== undefined && WRAPPERS.has(name) && typeArguments.length === 1) {
          return this.#resolve(typeArguments[0]!, seen);
        }
        if (name === undefined || seen.has(name)) return type;
        const declaration = this.#module.types.find((each) => each.name === name);
        if (!declaration) return type;
        const [statement] = parseCodeSource(declaration.code, "statements").root as Node[];
        let declared = (
          statement!.type === "ExportNamedDeclaration" ? statement!.declaration : statement
        ) as Node;
        // A generic declaration with its type arguments in place of its parameters.
        const parameters =
          ((declared.typeParameters as Node | null)?.params as Node[] | undefined) ?? [];
        if (parameters.length) {
          const substitutes = new Map<string, Node>();
          for (const [index, parameter] of parameters.entries()) {
            const argument =
              typeArguments[index] ?? (parameter.default as Node | null | undefined) ?? undefined;
            if (argument) substitutes.set((parameter.name as Node).name as string, argument);
          }
          declared = substituted(declared, substitutes);
        }
        const next = new Set(seen).add(name);
        if (declared.type === "TSTypeAliasDeclaration") {
          return this.#resolve(declared.typeAnnotation as Node, next);
        }
        if (declared.type !== "TSInterfaceDeclaration") return type;
        // An interface as an object type of its members and those it inherits.
        const members = [...((declared.body as Node).body as Node[])];
        for (const heritage of (declared.extends as Node[] | undefined) ?? []) {
          const inherited = this.#resolve(
            {
              type: "TSTypeReference",
              typeName: heritage.expression,
              typeArguments: heritage.typeArguments ?? null,
              start: 0,
              end: 0,
            },
            next,
          );
          if (inherited.type === "TSTypeLiteral") members.push(...(inherited.members as Node[]));
        }
        return { type: "TSTypeLiteral", members, start: 0, end: 0 };
      }
      default:
        return type;
    }
  }

  /** A member's type in an object type or a union of them: a method is its signature. */
  #memberType(type: Node, key: string): Node | undefined {
    switch (type.type) {
      case "TSTypeLiteral": {
        const member = (type.members as Node[]).find(
          (each) => propertyName(each.key as Node | undefined) === key,
        );
        if (!member) return undefined;
        if (member.type === "TSMethodSignature") return member;
        return (
          ((member.typeAnnotation as Node | null)?.typeAnnotation as Node | undefined) ?? undefined
        );
      }
      case "TSUnionType":
      case "TSIntersectionType": {
        const found = (type.types as Node[])
          .map((each) => this.#memberType(this.#resolve(each), key))
          .filter((each): each is Node => each !== undefined);
        if (!found.length) return undefined;
        return found.length === 1
          ? found[0]
          : { type: "TSUnionType", types: found, start: 0, end: 0 };
      }
      default:
        return undefined;
    }
  }
}

/** The utility types whose members are their argument's, for reading a member's type. */
const WRAPPERS = new Set(["NonNullable", "Partial", "Readonly", "Required"]);

/** Whether a type is `null`, `undefined` or `void`, which a union's member reads leave out. */
function isNullish(type: Node): boolean {
  return ["TSNullKeyword", "TSUndefinedKeyword", "TSVoidKeyword"].includes(type.type);
}

/** A declaration with each reference to one of `substitutes`' names replaced by its type. */
function substituted(node: Node, substitutes: ReadonlyMap<string, Node>): Node {
  const copy = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(copy);
    if (!isNode(value)) return value;
    if (value.type === "TSTypeReference" && !value.typeArguments) {
      const name = (value.typeName as Node).name as string | undefined;
      const substitute = name === undefined ? undefined : substitutes.get(name);
      if (substitute) return substitute;
    }
    const result: Record<string, unknown> = {};
    for (const [key, each] of Object.entries(value)) {
      result[key] = key === "parent" || key === "typeParameters" ? each : copy(each);
    }
    return result;
  };
  return copy(node) as Node;
}

/** The identifiers' names in a node. */
function identifierNames(node: Node): Set<string> {
  const names = new Set<string>();
  visitNodes(node, (each) => {
    if (each.type === "Identifier") names.add(each.name as string);
  });
  return names;
}

/** The expressions directly in an expression: its operands, its callee, its arguments. */
function childExpressions(node: Node): Node[] {
  const found: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "type" || key === "parent" || key === "typeArguments") continue;
    for (const each of Array.isArray(value) ? value : [value]) {
      if (!isNode(each)) continue;
      if (each.type === "SpreadElement") found.push(each.argument as Node);
      else if (!each.type.startsWith("TS")) found.push(each);
    }
  }
  return found;
}

/** A member expression's key: its name, a literal's value, or `undefined` for any other index. */
function memberKey(node: Node): string | undefined {
  const property = node.property as Node;
  if (!node.computed) return property.name as string;
  return property.type === "Literal" && typeof property.value === "string"
    ? property.value
    : undefined;
}

/** A property key's name: an identifier's or a string literal's. */
function propertyName(key: Node | undefined): string | undefined {
  if (key?.type === "Identifier") return key.name as string;
  if (key?.type === "Literal") return String(key.value);
  return undefined;
}

/** A callee without its parentheses, its optional chain and its non-null assertion. */
function unwrapped(node: Node): Node {
  let each = node;
  while (
    ["ParenthesizedExpression", "ChainExpression", "TSNonNullExpression"].includes(each.type)
  ) {
    each = each.expression as Node;
  }
  return each;
}

/** The element type of an array, a tuple or `Array<T>`, or `undefined` for any other type. */
function elementType(type: Node): Node | undefined {
  switch (type.type) {
    case "TSArrayType":
      return type.elementType as Node;
    case "TSTupleType": {
      const elements = (type.elementTypes as Node[]).map((each) =>
        each.type === "TSNamedTupleMember" ? (each.elementType as Node) : each,
      );
      return { type: "TSUnionType", types: elements, start: 0, end: 0 };
    }
    case "TSTypeReference": {
      const name = (type.typeName as Node).name;
      if (name !== "Array" && name !== "ReadonlyArray") return undefined;
      const [element] = ((type.typeArguments as Node | null)?.params as Node[] | undefined) ?? [];
      return element ?? { type: "TSUnknownKeyword", start: 0, end: 0 };
    }
    default:
      return undefined;
  }
}

/** Whether a type is a primitive keyword (`string`, `number`…), whose named members are methods. */
function isKeyword(type: Node): boolean {
  return ["TSStringKeyword", "TSNumberKeyword", "TSBooleanKeyword", "TSBigIntKeyword"].includes(
    type.type,
  );
}

/** Whether a type is a function's: a function type, a method signature, or `Function`. */
function isFunctionType(type: Node): boolean {
  return (
    type.type === "TSFunctionType" ||
    type.type === "TSMethodSignature" ||
    (type.type === "TSTypeReference" && (type.typeName as Node).name === "Function")
  );
}

/** What calling a function type gives: its declared return type, or anything without one. */
function returned(type: Node): WrittenType {
  const annotation = (type.returnType as Node | null | undefined)?.typeAnnotation as
    | Node
    | undefined;
  return annotation ? { type: annotation, free: false } : { free: false };
}
