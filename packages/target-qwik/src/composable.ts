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
 * - a value whose type holds a function, or a setup `const` that takes such a value or a part of
 *   it (`const format = options.format`), read where a `$` scope captures it (a derived value, a
 *   watcher, an effect, a hook, a function client code calls): Qwik serialises what a `$` scope
 *   captures, and no function (`qwik/valid-lexical-scope`). Its type is read as written, through
 *   the module's own declarations and the interfaces they extend.
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
  // A setup `const` holds what its value gives of such an argument, unless the value is one a
  // function never is (a call's result, an operator's, a literal).
  for (const item of composable.setup) {
    if (item.kind !== "Const") continue;
    const reads = item.value.refs.some(
      (reference) => reference.kind === "Binding" && holding.has(reference.binding),
    );
    if (reads && mayGiveFunction(item.value.code)) holding.add(item.binding);
  }
  const nameOf = (id: string) => composable.bindings.find((binding) => binding.id === id)!.name;
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

/**
 * Whether an expression's value may be a function it reads: anything but a call's or a `new`'s
 * result, an operator's, a template or a literal.
 */
function mayGiveFunction(code: string): boolean {
  let node = parseCodeSource(code, "expression").root as Node;
  while (
    [
      "TSAsExpression",
      "TSSatisfiesExpression",
      "TSNonNullExpression",
      "ParenthesizedExpression",
    ].includes(node.type)
  ) {
    node = node.expression as Node;
  }
  return ![
    "CallExpression",
    "NewExpression",
    "BinaryExpression",
    "UnaryExpression",
    "UpdateExpression",
    "AwaitExpression",
    "TemplateLiteral",
    "Literal",
  ].includes(node.type);
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
