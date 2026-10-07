// Calls of local functions written in place (ADR-0045, ADR-0047). A function client code calls is
// a `$()` QRL, and Qwik runs a QRL's call later: once its segment has loaded, and, being awaited,
// after the caller's `await`. Qwik's loader runs the next listener of the dispatch as soon as a
// handler's synchronous code returns (./listeners.ts), so in a handler that another listener may
// follow, what comes after an awaited call would run after that listener (the semantics
// contract's read after write in another listener): so a handler that shares its dispatch with
// another listener, and a task, runs inline its calls of the functions that return no promise
// (a call of one that does is not awaited, ./calls.ts), and its code is one segment (./plan.ts
// says which). And a call of a type predicate or an assertion function is written in place
// wherever client code makes it: TypeScript narrows through the function's own signature, which
// a QRL's promise loses.
//
// A call that is a statement of its own, of a function that is not async and never returns, is
// replaced by the function's statements: each parameter is the argument itself where that is a
// literal or a name the body neither declares nor assigns, else a `const` (a `let` where the body
// assigns it), all in a block where they could clash with what follows. Any other call stays as
// written, and the function is declared in the code that calls it, as the source declares it
// (`function check(…) {…}`): a plain function, which runs at once and keeps its returns and the
// narrowing of a type predicate's or an assertion function's signature (TypeScript narrows
// through an assertion only when it calls it by name, TS2776).
import { functionSource, parseCodeSource } from "@unframework/codegen";
import type { CodeKind } from "@unframework/codegen";
import type { FunctionCode, Parameter } from "@unframework/ir";

/** A node of oxc's syntax tree, as far as these walks read it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** A function as it is written in place: its parameters and body, printed for client code. */
export interface InlineFunction {
  /** The source's function: its `async`, return type and form. */
  fn: FunctionCode;
  /** Whether the source declares it as a `function` (else as a `const` arrow). */
  declaration: boolean;
  /** The parameters it is printed with (an event nothing reads renamed, Qwik's element added). */
  parameters: readonly Parameter[];
  /** Its body as printed, its own calls already in place: a block `{ … }`, or an expression. */
  body: string;
  /** The functions its body declares for the calls it keeps (./setup.ts `clientCode`). */
  locals: ReadonlySet<string>;
}

/** Where a call is, as {@link Inliner} judges it. */
export interface CallSite {
  /** Whether it is in a function inside the code (a callback that runs later). */
  nested: boolean;
  /** Whether an `await` takes its value. */
  awaited: boolean;
  /** Whether the code returns its value: an expression body's value, or a `return`'s. */
  returned: boolean;
  /** Whether it is a statement of its own, or the whole of a discarded expression body. */
  statement: boolean;
}

/** Which calls of printed client code {@link inlineCalls} writes in place. */
export interface Inliner {
  /** The function a call of `name` writes in place, if it does. */
  target(name: string, site: CallSite): InlineFunction | undefined;
}

/** Printed code with its calls written in place, and its kind: an expression body may become a block. */
export interface InlinedCode {
  code: string;
  kind: CodeKind;
  /** The functions the code declares for the calls it keeps: no call of theirs is a QRL's. */
  locals: ReadonlySet<string>;
}

/** How {@link inlineCalls} reads the code. */
export interface InlineOptions {
  /** Whether the code is inside a function of the code around it (a callback's). */
  nested?: boolean;
  /**
   * Whether the code is an arrow's expression body whose value nothing reads (a handler's): one
   * call it is may become the function's statements.
   */
  discarded?: boolean;
}

/**
 * Writes in place every call of printed client code that `inliner` names (see the module
 * comment). A discarded expression body that is one such call becomes statements, and an
 * expression body that declares a function becomes a block.
 */
export function inlineCalls(
  code: string,
  kind: CodeKind,
  inliner: Inliner,
  options: InlineOptions = {},
): InlinedCode {
  const { result, kindOut, locals, spliced } = inlineIn(code, kind, inliner, options);
  // A call in a function the code declares, or in the statements it splices, of one that
  // function's body declares is no QRL's either.
  const names = new Set([
    ...[...locals].flatMap(([name, target]) => [name, ...target.locals]),
    ...[...spliced].flatMap((target) => [...target.locals]),
  ]);
  if (!locals.size) {
    return kindOut === kind
      ? { code: result, kind, locals: names }
      : { code: `{\n${result}\n}`, kind: kindOut, locals: names };
  }
  const declarations = [...locals].map(([name, target]) => localDeclaration(name, target));
  if (kind === "statements") {
    // After the block's opening brace.
    return {
      code: `{\n${declarations.join("\n")}\n${result.trimStart().slice(1)}`,
      kind,
      locals: names,
    };
  }
  const statements =
    kindOut === "statements"
      ? result
      : options.discarded === true
        ? asStatement(result)
        : `return ${result};`;
  return {
    code: `{\n${declarations.join("\n")}\n${statements}\n}`,
    kind: "statements",
    locals: names,
  };
}

/** {@link inlineCalls}' edits, and the functions whose calls it keeps, to declare. */
function inlineIn(
  code: string,
  kind: CodeKind,
  inliner: Inliner,
  options: InlineOptions,
): {
  result: string;
  kindOut: CodeKind;
  locals: Map<string, InlineFunction>;
  spliced: Set<InlineFunction>;
} {
  const nested = options.nested === true;
  const { root } = parseCodeSource(code, kind);
  const edits: { start: number; end: number; text: string }[] = [];
  const locals = new Map<string, InlineFunction>();
  const spliced = new Set<InlineFunction>();
  let kindOut = kind;
  const visit = (node: unknown, ancestors: readonly Node[], inFunction: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, ancestors, inFunction);
      return;
    }
    if (!isNode(node)) return;
    const site = siteOf(node, ancestors, inFunction || nested, {
      kind,
      root,
      discarded: options.discarded === true,
    });
    const target = callTarget(node, inliner, site);
    if (target) {
      const name = (node.callee as Node).name as string;
      const args = (node.arguments as Node[]).map((argument) => {
        if (argument.type === "SpreadElement") return undefined;
        const inner = inlineIn(code.slice(argument.start, argument.end), "expression", inliner, {
          nested: inFunction || nested,
        });
        for (const [local, fn] of inner.locals) locals.set(local, fn);
        for (const fn of inner.spliced) spliced.add(fn);
        return inner.result;
      });
      const parent = ancestors.at(-1);
      const statement = parent?.type === "ExpressionStatement" ? parent : undefined;
      const whole =
        kind === "expression" && node === root && !inFunction && options.discarded === true;
      const block =
        (statement || whole) && !args.includes(undefined)
          ? blockForm(target, args as string[])
          : undefined;
      if (block) spliced.add(target);
      if (block && whole) {
        edits.push({ start: node.start, end: node.end, text: block.statements });
        kindOut = "statements";
      } else if (block && statement) {
        const grand = ancestors.at(-2);
        const owner = ancestors.at(-3);
        // The only statement of a block that is no function's body (an `if`'s, a loop's), or of
        // the code's own: what it declares cannot meet anything else there.
        const alone =
          grand?.type === "BlockStatement" &&
          (grand.body as Node[]).length === 1 &&
          (ancestors.length === 2
            ? kind === "statements" && !inFunction
            : owner !== undefined && !isFunction(owner));
        const braces = (block.declares && !alone) || grand?.type !== "BlockStatement";
        edits.push({
          start: statement.start,
          end: statement.end,
          text: braces ? `{\n${block.statements}\n}` : block.statements,
        });
      } else {
        // The call stays, of the function the code declares (see the module comment).
        locals.set(name, target);
        const call = `${name}(${(node.arguments as Node[])
          .map((argument, index) => args[index] ?? code.slice(argument.start, argument.end))
          .join(", ")})`;
        const floating = target.fn.async === true && (statement !== undefined || whole);
        edits.push({ start: node.start, end: node.end, text: floating ? `void ${call}` : call });
      }
      return;
    }
    const inner = inFunction || isFunction(node);
    const next = [...ancestors, node];
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object")
        visit(value, next, inner);
    }
  };
  visit(root, [], false);
  let result = code;
  for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`;
  }
  return { result, kindOut, locals, spliced };
}

/** Where a node is, if it is a call (see {@link CallSite}). */
function siteOf(
  node: Node,
  ancestors: readonly Node[],
  nested: boolean,
  code: { kind: CodeKind; root: unknown; discarded: boolean },
): CallSite {
  const parent = ancestors.at(-1);
  const tail = code.kind === "expression" && !nested && returnedValue(node, ancestors, code.root);
  const whole = code.kind === "expression" && !nested && node === code.root && code.discarded;
  return {
    nested,
    awaited: parent?.type === "AwaitExpression",
    returned: parent?.type === "ReturnStatement" || (tail && !code.discarded),
    statement: parent?.type === "ExpressionStatement" || whole,
  };
}

/** The function a call writes in place: a call by name of one the inliner names. */
function callTarget(node: Node, inliner: Inliner, site: CallSite): InlineFunction | undefined {
  if (node.type !== "CallExpression" || node.optional) return undefined;
  const callee = node.callee as Node;
  if (callee.type !== "Identifier") return undefined;
  return inliner.target(callee.name as string, site);
}

/**
 * Whether an expression body returns the node's value: the body is the node, or the node is the
 * body's value through `a && node`, `a ? node : b` or `a, node`.
 */
function returnedValue(node: Node, ancestors: readonly Node[], root: unknown): boolean {
  let child: Node = node;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const parent = ancestors[index]!;
    const tail =
      (parent.type === "LogicalExpression" && parent.right === child) ||
      (parent.type === "ConditionalExpression" && parent.test !== child) ||
      (parent.type === "SequenceExpression" && (parent.expressions as Node[]).at(-1) === child);
    if (!tail) return false;
    child = parent;
  }
  return child === root;
}

/**
 * The calls by name in code, by their callee's offset in it, with where each is (see
 * {@link CallSite}): what {@link inlineCalls} reads, for code before it is printed (./plan.ts).
 */
export function callSites(code: string, kind: CodeKind, discarded = false): Map<number, CallSite> {
  const sites = new Map<number, CallSite>();
  const { root } = parseCodeSource(code, kind);
  const visit = (node: unknown, ancestors: readonly Node[], inFunction: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, ancestors, inFunction);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "CallExpression" && (node.callee as Node).type === "Identifier") {
      sites.set(
        (node.callee as Node).start,
        siteOf(node, ancestors, inFunction, { kind, root, discarded }),
      );
    }
    const inner = inFunction || isFunction(node);
    const next = [...ancestors, node];
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object")
        visit(value, next, inner);
    }
  };
  visit(root, [], false);
  return sites;
}

/**
 * A function the code declares for the calls it keeps: as the source declares it, but an
 * assertion function as a `function` (TypeScript asserts through a `const` only when its type is
 * written, TS2775).
 */
function localDeclaration(name: string, target: InlineFunction): string {
  const fn: FunctionCode = { ...target.fn, parameters: [...target.parameters] };
  const asserts = /^asserts\s/.test(fn.returnType?.code.trim() ?? "");
  if (target.declaration || asserts) return functionSource(fn, target.body, { name });
  return `const ${name} = ${functionSource(fn, target.body)};`;
}

/** An expression as a statement: an object literal or a function in parentheses. */
function asStatement(code: string): string {
  return `${/^(?:\{|function\b|class\b|let\s*\[)/.test(code.trimStart()) ? `(${code})` : code};`;
}

/**
 * The statements a call that is a statement of its own becomes (see the module comment), and
 * whether they declare names; `undefined` where the call must stay, of a declared function.
 */
function blockForm(
  target: InlineFunction,
  args: readonly string[],
): { statements: string; declares: boolean } | undefined {
  const { fn, parameters, body } = target;
  if (!spliceable(fn, parameters, body)) return undefined;
  const kind: CodeKind = fn.expression ? "expression" : "statements";
  const { root } = parseCodeSource(body, kind);
  const declared = declaredNames(root);
  const topLevel = kind === "statements" ? topLevelNames(root) : new Set<string>();
  const block = new Set([...topLevel, ...parameters.map((parameter) => parameter.name!)]);
  const constants: string[] = [];
  const substitutions = new Map<string, string>();
  for (const [index, parameter] of parameters.entries()) {
    const name = parameter.name!;
    const argument = (args[index] ?? "undefined").trim();
    const used = references(root, name);
    if (!used.length) {
      // An argument nothing reads: dropped where reading it does nothing.
      if (isLiteral(argument) || isName(argument)) continue;
      return undefined;
    }
    // The caller's own name for it: the body reads the same variable.
    if (argument === name) continue;
    const substitutable =
      (isLiteral(argument) || (isName(argument) && !declared.has(argument))) &&
      !assigns(root, name) &&
      !typeQueries(root, name);
    if (substitutable) {
      substitutions.set(name, argument);
      continue;
    }
    // A `const` evaluates the argument once, before the body, as the call did (a `let` where the
    // body assigns the parameter); an argument that reads a name the block declares would read
    // the block's.
    if (namesIn(argument).some((read) => block.has(read))) return undefined;
    const type = parameter.type
      ? `: ${parameter.type.code}${parameter.optional ? " | undefined" : ""}`
      : "";
    constants.push(`${assigns(root, name) ? "let" : "const"} ${name}${type} = ${argument};`);
  }
  const substituted = substitute(body, root, substitutions);
  const statements =
    kind === "statements"
      ? substituted.trim().slice(1, -1).trim()
      : `${/^(?:\{|function\b|class\b|let\s*\[)/.test(substituted.trimStart()) ? `(${substituted})` : substituted};`;
  return {
    statements: [...constants, statements].filter(Boolean).join("\n"),
    declares: constants.length > 0 || topLevel.size > 0,
  };
}

/**
 * Whether a call that is a statement of its own may become the function's statements (see the
 * module comment), whatever its arguments: the function is not async, never returns, and takes
 * named parameters without defaults.
 */
export function spliceable(
  fn: FunctionCode,
  parameters: readonly Parameter[] = fn.parameters,
  body: string = fn.body.code,
): boolean {
  if (fn.async) return false;
  if (parameters.some((parameter) => parameter.name === undefined || parameter.rest)) {
    return false;
  }
  if (parameters.some((parameter) => parameter.default)) return false;
  return fn.expression === true || !returns(parseCodeSource(body, "statements").root);
}

/** Whether a function body returns, outside the functions in it. */
function returns(root: unknown): boolean {
  let found = false;
  walkNodes(root, (node) => {
    if (node.type === "ReturnStatement") found = true;
    return !isFunction(node);
  });
  return found;
}

/** Every name a body declares, at any depth: variables, functions, classes, parameters, `catch`. */
function declaredNames(root: unknown): Set<string> {
  const names = new Set<string>();
  walkNodes(root, (node) => {
    if (node.type === "VariableDeclarator")
      for (const name of patternNames(node.id)) names.add(name);
    if (
      (node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ClassDeclaration") &&
      isNode(node.id)
    ) {
      names.add(node.id.name as string);
    }
    if (isFunction(node)) {
      for (const parameter of node.params as unknown[]) {
        for (const name of patternNames(parameter)) names.add(name);
      }
    }
    if (node.type === "CatchClause" && node.param) {
      for (const name of patternNames(node.param)) names.add(name);
    }
    return true;
  });
  return names;
}

/** The names a block body declares at its top level. */
function topLevelNames(root: unknown): Set<string> {
  const names = new Set<string>();
  const [block] = root as Node[];
  for (const statement of (block?.body as Node[] | undefined) ?? []) {
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations as Node[]) {
        for (const name of patternNames(declarator.id)) names.add(name);
      }
    } else if (
      (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") &&
      isNode(statement.id)
    ) {
      names.add(statement.id.name as string);
    }
  }
  return names;
}

/** The names a binding pattern declares. */
function patternNames(pattern: unknown): string[] {
  if (!isNode(pattern)) return [];
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name as string];
    case "ObjectPattern":
      return (pattern.properties as Node[]).flatMap((property) =>
        property.type === "RestElement"
          ? patternNames(property.argument)
          : patternNames(property.value),
      );
    case "ArrayPattern":
      return (pattern.elements as unknown[]).flatMap(patternNames);
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "RestElement":
      return patternNames(pattern.argument);
    case "TSParameterProperty":
      return patternNames(pattern.parameter);
    default:
      return [];
  }
}

/**
 * The identifiers that read `name` as a variable where it means the body's own `name`: not a
 * member's or a key's name, nor a type's, and not inside a function or a block that declares a
 * `name` of its own.
 */
function references(root: unknown, name: string): Node[] {
  const found: Node[] = [];
  const visit = (node: unknown, parent: Node | undefined, key: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, parent, key);
      return;
    }
    if (!isNode(node)) return;
    if (node.type === "Identifier") {
      const member = parent?.type === "MemberExpression" && key === "property" && !parent.computed;
      const property =
        parent?.type === "Property" && key === "key" && !parent.computed && !parent.shorthand;
      const label = key === "label";
      const type =
        parent !== undefined && parent.type.startsWith("TS") && !TS_VALUE_PARENTS.has(parent.type);
      if (node.name === name && !member && !property && !label && !type) found.push(node);
      return;
    }
    if (shadows(node, name)) return;
    for (const [childKey, value] of Object.entries(node)) {
      if (childKey === "type" || childKey === "parent" || typeof value !== "object") continue;
      // A shorthand property's key and value are one identifier: the value reads it.
      if (node.type === "Property" && node.shorthand && childKey === "key") continue;
      visit(value, node, childKey);
    }
  };
  visit(root, undefined, "");
  return found;
}

/** The TypeScript nodes whose child is a value, not a type. */
const TS_VALUE_PARENTS = new Set([
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** Whether a function, a block or a `catch` declares its own `name`, hiding the body's. */
function shadows(node: Node, name: string): boolean {
  if (isFunction(node)) {
    return (node.params as unknown[]).some((parameter) => patternNames(parameter).includes(name));
  }
  if (node.type === "CatchClause") return patternNames(node.param).includes(name);
  const statements =
    node.type === "BlockStatement" || node.type === "StaticBlock"
      ? (node.body as Node[])
      : node.type === "ForStatement" ||
          node.type === "ForOfStatement" ||
          node.type === "ForInStatement"
        ? [node.init ?? node.left].filter(isNode)
        : [];
  return statements.some(
    (statement) =>
      (statement.type === "VariableDeclaration" &&
        (statement.declarations as Node[]).some((declarator) =>
          patternNames(declarator.id).includes(name),
        )) ||
      ((statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") &&
        isNode(statement.id) &&
        statement.id.name === name),
  );
}

/** Whether a body assigns `name`: `name = …`, `name += …`, `name++`. */
function assigns(root: unknown, name: string): boolean {
  let found = false;
  walkNodes(root, (node) => {
    const target =
      node.type === "AssignmentExpression"
        ? node.left
        : node.type === "UpdateExpression"
          ? node.argument
          : undefined;
    if (isNode(target) && patternNames(target).includes(name)) found = true;
    return true;
  });
  return found;
}

/** Whether a body names `name` in a type query (`typeof name`), which a value cannot replace. */
function typeQueries(root: unknown, name: string): boolean {
  let found = false;
  walkNodes(root, (node) => {
    if (node.type === "TSTypeQuery" && isNode(node.exprName) && node.exprName.name === name) {
      found = true;
    }
    return true;
  });
  return found;
}

/** The body with each read of a parameter replaced by its argument. */
function substitute(
  body: string,
  root: unknown,
  substitutions: ReadonlyMap<string, string>,
): string {
  const edits: { start: number; end: number; text: string }[] = [];
  for (const [name, value] of substitutions) {
    const shorthand = new Set<number>();
    walkNodes(root, (node) => {
      if (node.type === "Property" && node.shorthand && isNode(node.value)) {
        const inner = node.value.type === "AssignmentPattern" ? node.value.left : node.value;
        if (isNode(inner) && inner.name === name) {
          shorthand.add(inner.start);
          edits.push({ start: node.start, end: node.end, text: `${name}: ${value}` });
        }
      }
      return true;
    });
    for (const reference of references(root, name)) {
      if (!shorthand.has(reference.start)) {
        edits.push({ start: reference.start, end: reference.end, text: value });
      }
    }
  }
  let result = body;
  for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`;
  }
  return result;
}

/** Whether code is a literal: a string, a number, a boolean, `null`, `undefined`, a plain template. */
function isLiteral(code: string): boolean {
  return /^(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`$\\]*`|-?\d[\d_]*(?:\.\d+)?|true|false|null|undefined)$/.test(
    code.trim(),
  );
}

/** Whether code is one name. */
function isName(code: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(code.trim()) && !isLiteral(code);
}

/** The names an expression reads. */
function namesIn(code: string): string[] {
  const { root } = parseCodeSource(code, "expression");
  const names: string[] = [];
  walkNodes(root, (node) => {
    if (node.type === "Identifier") names.push(node.name as string);
    return true;
  });
  return names;
}

function isFunction(node: Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

/** Calls `visit` on each node, parents first; `false` skips a node's children. */
function walkNodes(root: unknown, visit: (node: Node) => boolean): void {
  if (Array.isArray(root)) {
    for (const item of root) walkNodes(item, visit);
    return;
  }
  if (!isNode(root)) return;
  if (!visit(root)) return;
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") walkNodes(value, visit);
  }
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}
