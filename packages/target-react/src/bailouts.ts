// What React Compiler 1.0 cannot compile yet (its `Todo` and `Invariant` bail-outs), found in
// the component's own output (ADR-0046). The source language admits these shapes on every target
// (plan §4: a rule that rejects everyday code for one target's compiler is not the language's), so
// where the component's code holds one, React opts the component out of React Compiler with
// `"use no memo"`, a comment naming the shape, and L3 checks that the opt-out is needed. React's
// own spelling can make one: an emit is an optional call (`onSaved?.(id)`), which inside a `try`
// block is a value block. Each shape here is one React Compiler 1.0 bails out on, pinned by a probe
// in test/toolchain.test.ts that fails once the compiler compiles it.
import { parseCodeSource } from "@unframework/codegen";
import type { CodeKind } from "@unframework/codegen";

/** Code of the component's function: a statement of its body, its returned JSX, a prop's default. */
export interface ComponentCode {
  code: string;
  /** `default` is a parameter's default value, which React Compiler must be able to reorder. */
  kind: CodeKind | "default";
}

/**
 * The first shape, in the order given, that React Compiler 1.0 cannot compile in a component's
 * code, as a phrase for the comment beside the opt-out (`a \`throw\` inside a \`try\` block`), or
 * `undefined` when it compiles all of it. `locals` are the names the component's function
 * declares (its parameters and every declaration in its body, nested functions' included): React
 * Compiler reorders a read of a module's or a global's binding, never a local one.
 */
export function compilerBailout(
  pieces: readonly ComponentCode[],
  locals: ReadonlySet<string>,
): string | undefined {
  for (const piece of pieces) {
    if (piece.kind === "default") {
      const { root } = parseCodeSource(piece.code, "expression");
      if (!reorderable(root as Node, locals, true)) return defaultReason(piece.code);
      const found = new Walk(locals).run(root);
      if (found) return found;
      continue;
    }
    const { root } = parseCodeSource(piece.code, piece.kind);
    const found = new Walk(locals).run(root);
    if (found) return found;
  }
  return undefined;
}

/** The names code declares anywhere in it: variables, functions, parameters, `catch` parameters. */
export function declaredNames(pieces: readonly ComponentCode[]): Set<string> {
  const names = new Set<string>();
  for (const piece of pieces) {
    if (piece.kind === "default") continue;
    const { root } = parseCodeSource(piece.code, piece.kind);
    visit(root, (node) => {
      for (const pattern of declaredPatterns(node)) {
        for (const name of patternNames(pattern)) names.add(name);
      }
    });
  }
  return names;
}

/** A node of oxc's AST (TS-ESTree), as far as the walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);
const LOOPS = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);
const ASSERTIONS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
]);

/** A function's scope: the names it declares, and those of them a nested function reads. */
interface Scope {
  declared: Set<string>;
  captured: Set<string>;
}

/**
 * One walk over code: the scopes of its functions first (for an assignment's target, which React
 * Compiler stores as a context variable where a nested function reads it), then the shapes.
 */
class Walk {
  readonly #locals: ReadonlySet<string>;
  readonly #scopes = new Map<Node, Scope>();

  constructor(locals: ReadonlySet<string>) {
    this.#locals = locals;
  }

  run(root: unknown): string | undefined {
    const top: Scope = { declared: new Set(), captured: new Set() };
    this.#collect(root, [top]);
    return this.#check(root, undefined, { inTry: false, scopes: [top] });
  }

  /** Records each function's declarations, and the names nested functions read of them. */
  #collect(node: unknown, scopes: Scope[]): void {
    if (Array.isArray(node)) {
      for (const item of node) this.#collect(item, scopes);
      return;
    }
    if (!isNode(node)) return;
    let inner = scopes;
    if (FUNCTIONS.has(node.type)) {
      const scope: Scope = { declared: new Set(), captured: new Set() };
      for (const parameter of node.params as Node[]) {
        for (const name of patternNames(parameter)) scope.declared.add(name);
      }
      this.#scopes.set(node, scope);
      inner = [...scopes, scope];
      if (node.type === "FunctionDeclaration" && isNode(node.id)) {
        scopes.at(-1)!.declared.add(node.id.name as string);
      }
    }
    for (const pattern of declaredPatterns(node)) {
      if (FUNCTIONS.has(node.type)) continue;
      for (const name of patternNames(pattern)) inner.at(-1)!.declared.add(name);
    }
    if (node.type === "Identifier") {
      const name = node.name as string;
      const owner = inner.findLastIndex((scope) => scope.declared.has(name));
      if (owner !== -1 && owner < inner.length - 1) inner[owner]!.captured.add(name);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") {
        this.#collect(value, inner);
      }
    }
  }

  #check(
    node: unknown,
    parent: { node: Node; key: string; last: boolean } | undefined,
    context: { inTry: boolean; scopes: Scope[] },
  ): string | undefined {
    if (Array.isArray(node)) {
      for (const [index, item] of node.entries()) {
        const found = this.#check(
          item,
          parent && { ...parent, last: index === node.length - 1 },
          context,
        );
        if (found) return found;
      }
      return undefined;
    }
    if (!isNode(node)) return undefined;
    const own = this.#shape(node, parent, context);
    if (own) return own;
    let inner = context;
    // A function is lowered on its own: a `try` around it is not around its code.
    if (FUNCTIONS.has(node.type)) {
      inner = { inTry: false, scopes: [...context.scopes, this.#scopes.get(node)!] };
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "type" || key === "parent" || typeof value !== "object" || value === null) {
        continue;
      }
      const child =
        node.type === "TryStatement" && key === "block" ? { ...inner, inTry: true } : inner;
      const found = this.#check(value, { node, key, last: true }, child);
      if (found) return found;
    }
    return undefined;
  }

  /** The shape a node is, where React Compiler bails out on it. */
  #shape(
    node: Node,
    parent: { node: Node; key: string; last: boolean } | undefined,
    context: { inTry: boolean; scopes: Scope[] },
  ): string | undefined {
    if (context.inTry) {
      const value = TRY_VALUES.get(node.type);
      if (value) return `${value} inside a \`try\` block`;
      if (node.type === "LogicalExpression") {
        return `\`${node.operator as string}\` inside a \`try\` block`;
      }
    }
    switch (node.type) {
      case "TryStatement":
        if (!node.handler) return "a `try` without a `catch` clause";
        if (node.finalizer) return "a `try` with a `finally` clause";
        return undefined;
      case "CatchClause":
        return isNode(node.param) && node.param.type !== "Identifier"
          ? "a destructured `catch` parameter"
          : undefined;
      case "AssignmentPattern":
        return reorderable(node.right as Node, this.#locals, true) ? undefined : defaultReason("");
      case "SwitchCase":
        return isNode(node.test) && !reorderable(node.test, this.#locals, true)
          ? "a `case` test it cannot reorder"
          : undefined;
      case "ForStatement":
        if (!isNode(node.init) || node.init.type !== "VariableDeclaration") {
          return "a `for` loop whose head declares no variable";
        }
        if (!node.test) return "a `for` loop without a condition";
        if (isNode(node.update) && node.update.type === "SequenceExpression") {
          return "a `for` loop whose update is a comma expression";
        }
        return undefined;
      case "ForInStatement":
      case "ForOfStatement":
        if (node.await) return "`for await`";
        return hasDefault(node.left) ? "a default in a `for…of` or `for…in` pattern" : undefined;
      case "Literal":
        return node.bigint !== undefined && node.bigint !== null ? "a BigInt literal" : undefined;
      case "ObjectPattern":
        return (node.properties as Node[]).some((property) => property.computed === true)
          ? "a computed key in a destructuring pattern"
          : undefined;
      case "AssignmentExpression":
      case "UpdateExpression": {
        const target = (node.type === "AssignmentExpression" ? node.left : node.argument) as Node;
        if (ASSERTIONS.has(target.type)) return "a type assertion on an assignment's target";
        if (
          node.type === "AssignmentExpression" &&
          node.operator === "=" &&
          target.type === "Identifier" &&
          parent &&
          valueUsed(parent) &&
          this.#ownVariable(target.name as string, context.scopes)
        ) {
          return "an assignment to a variable whose value is used";
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  /**
   * Whether a name is a variable of the function the code is in that no nested function reads:
   * React Compiler stores another as a context variable, which it can read back as a value.
   */
  #ownVariable(name: string, scopes: readonly Scope[]): boolean {
    const scope = scopes.at(-1)!;
    return scope.declared.has(name) && !scope.captured.has(name);
  }
}

/** The value blocks React Compiler 1.0 does not lower inside a `try` block, by node type. */
const TRY_VALUES: ReadonlyMap<string, string> = new Map([
  ["ThrowStatement", "a `throw`"],
  ["ConditionalExpression", "`?:`"],
  ["ChainExpression", "`?.`"],
  ["SequenceExpression", "a comma expression"],
  ["AssignmentPattern", "a destructuring default"],
  ...[...LOOPS].map((type) => [type, "a loop"] as const),
]);

function defaultReason(code: string): string {
  if (!code || code.length > 40 || code.includes("\n")) return "a default value it cannot reorder";
  return `a default value it cannot reorder (${code.includes("`") ? `\`\` ${code} \`\`` : `\`${code}\``})`;
}

/**
 * Whether React Compiler can reorder an expression (its `isReorderableExpression`), as it needs
 * for a default value and a `case` test: a literal, a binding, a member of a module's or a
 * global's binding, a call of reorderable parts, and arrays, objects, `!`, `+`, `-`, `&&`, `||`,
 * `??` and `?:` of them; an arrow whose body reads no local binding.
 */
function reorderable(node: Node, locals: ReadonlySet<string>, allowLocals: boolean): boolean {
  const recurse = (child: unknown) => isNode(child) && reorderable(child, locals, allowLocals);
  switch (node.type) {
    case "Identifier":
      return allowLocals || !locals.has(node.name as string);
    case "Literal":
      return true;
    case "UnaryExpression":
      return ["!", "+", "-"].includes(node.operator as string) && recurse(node.argument);
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSInstantiationExpression":
      return recurse(node.expression);
    case "LogicalExpression":
      return recurse(node.left) && recurse(node.right);
    case "ConditionalExpression":
      return recurse(node.test) && recurse(node.consequent) && recurse(node.alternate);
    case "ArrayExpression":
      return (node.elements as unknown[]).every(
        (element) => isNode(element) && element.type !== "SpreadElement" && recurse(element),
      );
    case "ObjectExpression":
      return (node.properties as Node[]).every(
        (property) =>
          property.type === "Property" &&
          property.kind === "init" &&
          property.method !== true &&
          property.computed !== true &&
          recurse(property.value),
      );
    case "MemberExpression": {
      let inner: Node = node;
      while (inner.type === "MemberExpression") inner = inner.object as Node;
      return inner.type === "Identifier" && !locals.has(inner.name as string);
    }
    case "ArrowFunctionExpression": {
      const body = node.body as Node;
      if (body.type === "BlockStatement" || body.type === "FunctionBody") {
        return (body.body as unknown[]).length === 0;
      }
      return reorderable(body, locals, false);
    }
    case "CallExpression":
      return (
        recurse(node.callee) &&
        (node.arguments as Node[]).every(
          (argument) => argument.type !== "SpreadElement" && recurse(argument),
        )
      );
    default:
      return false;
  }
}

/**
 * Whether an assignment's value is used where React Compiler 1.0 reads it back from the store it
 * lowers it to: an argument, a returned or thrown value, an element, a property's value, a
 * member's object, an operand of `await` or of a unary operator but `void`, a `switch`'s
 * discriminant, and a comma expression's last value. A statement, an initializer, another
 * assignment's value, an operand of a binary, logical or conditional expression, a template's
 * part and a condition take it as it is.
 */
function valueUsed(parent: { node: Node; key: string; last: boolean }): boolean {
  const { node, key, last } = parent;
  switch (node.type) {
    case "CallExpression":
    case "NewExpression":
    case "ReturnStatement":
    case "ThrowStatement":
    case "ArrayExpression":
    case "SpreadElement":
    case "AwaitExpression":
    case "MemberExpression":
    case "Property":
      return true;
    case "UnaryExpression":
      return node.operator !== "void";
    case "SwitchStatement":
      return key === "discriminant";
    case "SequenceExpression":
      return last;
    default:
      return false;
  }
}

/** Whether a pattern holds a default value at any depth. */
function hasDefault(pattern: unknown): boolean {
  let found = false;
  visit(pattern, (node) => {
    if (node.type === "AssignmentPattern") found = true;
  });
  return found;
}

/** The patterns a node declares names with: a variable's, a function's parameters, a `catch`'s. */
function declaredPatterns(node: Node): unknown[] {
  switch (node.type) {
    case "VariableDeclarator":
      return [node.id];
    case "ArrowFunctionExpression":
    case "FunctionExpression":
    case "FunctionDeclaration":
      return [...(node.params as unknown[]), ...(isNode(node.id) ? [node.id] : [])];
    case "CatchClause":
      return node.param ? [node.param] : [];
    default:
      return [];
  }
}

/** The names a binding pattern declares. */
function patternNames(pattern: unknown): string[] {
  if (!isNode(pattern)) return [];
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name as string];
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "RestElement":
      return patternNames(pattern.argument);
    case "ArrayPattern":
      return (pattern.elements as unknown[]).flatMap(patternNames);
    case "ObjectPattern":
      return (pattern.properties as Node[]).flatMap((property) =>
        patternNames(property.type === "RestElement" ? property : property.value),
      );
    case "TSParameterProperty":
      return patternNames(pattern.parameter);
    default:
      return [];
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

/** Calls `callback` on every node of an AST, parents before their children. */
function visit(root: unknown, callback: (node: Node) => void): void {
  if (Array.isArray(root)) {
    for (const item of root) visit(item, callback);
    return;
  }
  if (!isNode(root)) return;
  callback(root);
  for (const [key, value] of Object.entries(root)) {
    if (key !== "type" && key !== "parent" && typeof value === "object") visit(value, callback);
  }
}
