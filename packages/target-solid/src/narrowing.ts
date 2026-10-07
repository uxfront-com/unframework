// What a Solid conditional's branches need of its tests. TypeScript narrows what a condition
// tests inside its branch (`user && <p>{user.name}</p>` reads a `User`, not a
// `User | undefined`), so the source type-checks, and so do the targets that write the branch
// inside the test: a ternary, `{#if}`, `@if`. Solid writes a conditional as `<Show>` or
// `<Switch>`/`<Match>`, whose children are no branch of their condition to TypeScript:
// `props.user.name` there fails L4. So a branch that reads what its tests read takes it from the
// callback `<Show>` and `<Match>` call with an accessor of their `when`, narrowed by TypeScript
// where the `when` builds it, and only as far as the tests have read it wherever the branch renders
// (see {@link carriedPaths}):
//
//   <Show when={props.user}>{(user) => <p>{user().name}</p>}</Show>
//   <Show when={props.count !== undefined ? { count: props.count } : undefined}>
//     {(narrowed) => <b>{narrowed().count.toFixed(1)}</b>}
//   </Show>
//
// The branch's code is then the source's, with each read of a path the callback receives written
// as a read of its accessor, which TypeScript types as the source's narrowed value. The branches
// are not keyed (ADR-0036, as M2 amends it): Solid calls the callback once while the `when` stays
// truthy and keeps its DOM, focus and state, where a keyed branch would re-create them for every
// new value (a new object, or state replaced whole, ADR-0008). The accessor reads the latest
// value, and Solid disposes the branch before anything inside can read one its test no longer
// guards. The rules are syntactic: carrying a value that needed no narrowing renders alike.
import {
  jsxBinding,
  parseExpression,
  parseStatementsSource,
  rewriteExpression,
} from "@unframework/codegen";
import type { ImportSet, JsxContext } from "@unframework/codegen";
import { reservedPropName } from "@unframework/ir";
import type {
  BindingId,
  BindingKind,
  Code,
  CodeReference,
  Expression,
  FunctionCode,
  RenderNode,
  Span,
  TypeDeclaration,
  UfComponent,
} from "@unframework/ir";

import { assertedPathEnds } from "./asserted.ts";

/** A parsed node with its offsets in an expression's code. */
type Parsed = ReturnType<typeof parseExpression>;

/**
 * A reference TypeScript narrows: one of the component's bindings, read whole (`user`, or
 * `props.user` in the object form) or through properties (`user.address`, `user?.address`,
 * `user["address"]`), which TypeScript matches whatever the access is written with.
 */
export interface ReferencePath {
  binding: BindingId;
  /** The properties read through the binding, in order: none for the binding itself. */
  keys: readonly string[];
}

/** Whether two paths are the same reference. */
export function samePath(a: ReferencePath, b: ReferencePath): boolean {
  return (
    a.binding === b.binding &&
    a.keys.length === b.keys.length &&
    a.keys.every((key, index) => key === b.keys[index])
  );
}

/**
 * The path a node of an expression's parsed code reads, or `undefined`: a reference to a binding
 * (its span is the reference's), or a property of a path, by name or by a literal key.
 */
function pathAt(node: Parsed, expression: Expression | Code): ReferencePath | undefined {
  const start = expression.span.start + node.start;
  const end = expression.span.start + node.end;
  const reference = expression.refs.find(
    (candidate) => candidate.span.start === start && candidate.span.end === end,
  );
  if (reference) {
    return reference.kind === "Binding" ? { binding: reference.binding, keys: [] } : undefined;
  }
  if (node.type === "ChainExpression") return pathAt(node.expression, expression);
  if (node.type !== "MemberExpression") return undefined;
  const key = !node.computed ? (node.property as { name: string }).name : literalKey(node.property);
  const object = key === undefined ? undefined : pathAt(node.object, expression);
  return object && { binding: object.binding, keys: [...object.keys, key!] };
}

/** A computed key TypeScript reads as a name: `"nick"`, `0`, or `` `nick` `` without `${}`. */
function literalKey(key: Parsed): string | undefined {
  if (key.type === "Literal") {
    return typeof key.value === "string" || typeof key.value === "number"
      ? String(key.value)
      : undefined;
  }
  if (key.type === "TemplateLiteral" && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** A node of parsed code, as the walks below see it. */
interface Node {
  type: string;
  start: number;
  end: number;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** A path's read in an expression's parsed code: the node, and the path. */
interface Read {
  node: Parsed;
  path: ReferencePath;
}

/**
 * The outermost reads of paths in an expression (`user.address.city`, not its `user`). A
 * method's callee reads its object (`label.trim()` reads `label`): a value taken without its
 * object would be called without its `this`.
 */
function readsOf(expression: Expression | Code): Read[] {
  const found: Read[] = [];
  const visit = (node: unknown, callee: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, false);
      return;
    }
    if (!isNode(node)) return;
    const parsed = node as Parsed;
    const path = pathAt(parsed, expression);
    if (path && !(callee && path.keys.length)) {
      found.push({ node: parsed, path });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && typeof value === "object") {
        visit(
          value,
          node.type === "CallExpression"
            ? key === "callee"
            : node.type === "ChainExpression" && callee,
        );
      }
    }
  };
  visit(parseExpression(expression.code), false);
  return found;
}

/**
 * Every expression nodes print on Solid (a list's key is not printed, so it is left out), and
 * the expression body of each inline handler: a handler that reads what a test narrows is one
 * call (UF3029), whose arguments read it through the branch's accessor.
 */
function expressionsIn(nodes: readonly RenderNode[]): (Expression | Code)[] {
  const found: (Expression | Code)[] = [];
  const visit = (node: RenderNode): void => {
    switch (node.kind) {
      case "Element":
        for (const attribute of node.attributes) {
          switch (attribute.kind) {
            case "Static":
              break;
            case "Bound":
            case "Spread":
              found.push(attribute.value);
              break;
            case "Class":
              for (const item of attribute.items) {
                if (item.kind === "Toggle") found.push(item.condition);
                else if (item.kind === "Dynamic") found.push(item.value);
              }
              break;
            case "Style":
              for (const declaration of attribute.declarations) {
                if (declaration.kind !== "Static") found.push(declaration.value);
              }
              break;
            case "Event":
              if (attribute.handler.kind === "Inline" && attribute.handler.function.expression) {
                found.push(attribute.handler.function.body);
              }
              break;
            case "Ref":
              break;
            default:
              attribute satisfies never;
          }
        }
        node.children.forEach(visit);
        return;
      case "Text":
        return;
      case "Interpolation":
        found.push(node.value);
        return;
      case "If":
        for (const branch of node.branches) {
          if (branch.condition) found.push(branch.condition);
          branch.children.forEach(visit);
        }
        return;
      case "For":
        found.push(node.source);
        visit(node.body);
        return;
      default:
        node satisfies never;
    }
  };
  nodes.forEach(visit);
  return found;
}

/**
 * The paths a branch takes from its keyed callback: for each path the branch reads, its longest
 * prefix that its tests have read wherever it renders (all but the last failed, and the last
 * held or failed as `holds` says), every object on the way present, unless a callback around it
 * already gives a longer one (`enclosing`), which the read then takes: `user` of `user.name` when
 * the test is `user?.address`, `res` of `res.value.t` when it is `res.ok`, `box.inner.t` when it
 * is `box.inner?.t`, but only `box.inner` of `box.inner?.t` in the else of
 * `box.inner && box.inner.t.length > 3`, which may not have read `box.inner.t`. The `when`
 * reads such a prefix before the branch does, so it must not throw where the source's read, as
 * written (`box.inner?.t`), would not; and TypeScript narrows no reference a test has not read
 * there, so the rest of the read, left as the source writes it, needs no narrowing. None when
 * the branch reads no binding its tests read.
 */
export function carriedPaths(
  children: readonly RenderNode[],
  tests: readonly Expression[],
  holds: boolean,
  enclosing: readonly ReferencePath[],
  types: BindingTypes,
): ReferencePath[] {
  const read = union(
    ...tests.map((test, index) =>
      outcome(parseExpression(test.code), test, holds && index === tests.length - 1),
    ),
  );
  const narrowing = union(...tests.map((test) => narrowingReads(test)));
  const carried: ReferencePath[] = [];
  for (const expression of expressionsIn(children)) {
    for (const { path } of readsOf(expression)) {
      const longest = longestPrefix(path, read);
      const around = longestPrefix(path, enclosing);
      if (!longest || (around && around.keys.length > longest.keys.length)) continue;
      // A path whose read no test narrows (`results().length > 0`), through it or a path it
      // is read through, reads as everywhere else.
      const narrowed = narrowing.some(
        (entry) =>
          (isPrefix(entry, longest) || isPrefix(longest, entry)) && types.narrowable(entry),
      );
      if (!narrowed) continue;
      if (!carried.some((entry) => samePath(entry, longest))) carried.push(longest);
    }
  }
  return carried;
}

/**
 * The paths a test may narrow, with the objects they are read through (a discriminant narrows
 * its object): those it reads where TypeScript narrows, as a truthiness test (`user`, `!user`,
 * `res.ok && …`), a side of an equality (`shape.kind === "circle"`, `typeof value === "string"`),
 * `instanceof`'s left, `in`'s right, or a call's argument (a type guard). A comparison
 * (`results.length > 0`, `total > 2`) or arithmetic narrows nothing.
 */
function narrowingReads(test: Expression): ReferencePath[] {
  const found: ReferencePath[] = [];
  const add = (node: Parsed): void => {
    const path = pathAt(node, test);
    if (path) found.push(...prefixes(path, path.keys.length));
  };
  const compared = (node: Parsed): void => {
    const inner = unwrapped(node);
    if (inner.type === "UnaryExpression" && inner.operator === "typeof") add(inner.argument);
    else add(inner);
  };
  const truthy = (node: Parsed): void => {
    const inner = unwrapped(node);
    switch (inner.type) {
      case "UnaryExpression":
        if (inner.operator === "!") truthy(inner.argument);
        return;
      case "LogicalExpression":
        truthy(inner.left);
        truthy(inner.right);
        return;
      case "ConditionalExpression":
        truthy(inner.test);
        truthy(inner.consequent);
        truthy(inner.alternate);
        return;
      case "BinaryExpression":
        if (["===", "!==", "==", "!="].includes(inner.operator)) {
          if (inner.left.type !== "PrivateIdentifier") compared(inner.left);
          compared(inner.right);
        } else if (inner.operator === "instanceof") {
          add(inner.left as Parsed);
        } else if (inner.operator === "in") {
          add(inner.right);
        }
        return;
      case "CallExpression":
        for (const argument of inner.arguments) {
          if (argument.type !== "SpreadElement") add(argument);
        }
        return;
      default:
        add(inner);
    }
  };
  truthy(parseExpression(test.code));
  return union(found);
}

/** An expression without the parentheses and type assertions around it. */
function unwrapped(node: Parsed): Parsed {
  let current = node;
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSNonNullExpression"
  ) {
    current = current.expression;
  }
  return current;
}

/** Types TypeScript knows to be no union, by name: a test narrows nothing of such a value. */
const PLAIN_TYPES: ReadonlySet<string> = new Set([
  "Array",
  "Date",
  "Map",
  "Promise",
  "ReadonlyArray",
  "ReadonlyMap",
  "ReadonlySet",
  "Record",
  "RegExp",
  "Set",
  "URL",
]);

/** A parsed type annotation, as the walks below read it. */
interface TypeNode {
  type: string;
  [key: string]: unknown;
}

/**
 * What the source says of a value's type: its annotation (`node`), or none it can read
 * (`undefined`), and whether the value may be absent besides (an optional member).
 */
interface TypeFacts {
  node: TypeNode | undefined;
  optional: boolean;
  /** A value whose type is no union though its members' are unknown: a literal's. */
  plain?: true;
}

const UNKNOWN: TypeFacts = { node: undefined, optional: false };

/**
 * Whether the bindings' values, and their members, may be a union or `null`/`undefined`, which
 * a test can narrow: read from what the source writes (a prop's type and whether it is optional,
 * a state's or a constant's type argument or annotation, else its initial value, a member's type
 * in an object type or an interface the module declares, an array's `length`), conservatively: a
 * type it cannot read through (an imported alias, a value no annotation types) may be one.
 */
export class BindingTypes {
  readonly #component: UfComponent;
  readonly #types: ReadonlyMap<string, string>;

  constructor(component: UfComponent, types: readonly TypeDeclaration[]) {
    this.#component = component;
    this.#types = new Map(types.map((declaration) => [declaration.name, declaration.code]));
  }

  /** Whether a test may narrow a path. */
  narrowable(path: ReferencePath): boolean {
    let facts = this.#binding(path.binding, new Set());
    for (const key of path.keys) {
      // A member of what may be absent or a union is read through what a test narrows.
      if (facts.optional || this.#union(facts)) return true;
      facts = this.#member(facts, key);
    }
    return facts.optional || this.#union(facts);
  }

  /** What the source says of a binding's type. */
  #binding(id: BindingId, seen: Set<BindingId>): TypeFacts {
    if (seen.has(id)) return UNKNOWN;
    const component = this.#component;
    const prop = component.props.find((each) => each.binding === id);
    if (prop) return { node: parseType(prop.type.code), optional: prop.optional };
    const item = component.setup.find((each) => "binding" in each && each.binding === id);
    const annotated = (type: { code: string } | undefined) =>
      type ? { node: parseType(type.code), optional: false } : undefined;
    switch (item?.kind) {
      case "State":
        return (
          annotated(item.type) ?? (item.initial ? this.#value(item.initial, seen, id) : UNKNOWN)
        );
      case "Const":
        return annotated(item.type) ?? this.#value(item.value, seen, id);
      case "Derived":
        return annotated(item.type) ?? UNKNOWN;
      default:
        return UNKNOWN;
    }
  }

  /** What an initial value's code says of its type: a literal's, or a binding's it copies. */
  #value(code: Code, seen: Set<BindingId>, id: BindingId): TypeFacts {
    const [only] = code.refs;
    if (
      code.refs.length === 1 &&
      only!.kind === "Binding" &&
      only!.span.start === code.span.start &&
      only!.span.end === code.span.end
    ) {
      return this.#binding(only!.binding, new Set([...seen, id]));
    }
    return literalFacts(code.code);
  }

  /** A member's type, where an object type, an interface or an array says it. */
  #member(facts: TypeFacts, key: string): TypeFacts {
    const node = this.#resolve(facts.node, new Set());
    if (!node) return UNKNOWN;
    if (node.type === "TSArrayType" || node.type === "TSTupleType" || isArrayReference(node)) {
      return key === "length" ? { node: { type: "TSNumberKeyword" }, optional: false } : UNKNOWN;
    }
    const members =
      node.type === "TSTypeLiteral"
        ? (node.members as TypeNode[])
        : node.type === "TSInterfaceBody"
          ? (node.body as TypeNode[])
          : [];
    for (const member of members) {
      if (member.type !== "TSPropertySignature" || member.computed) continue;
      const name =
        (member.key as { name?: string; value?: unknown }).name ??
        (member.key as { value?: unknown }).value;
      if (name !== key) continue;
      const annotation = member.typeAnnotation as { typeAnnotation?: TypeNode } | null;
      return { node: annotation?.typeAnnotation, optional: Boolean(member.optional) };
    }
    return UNKNOWN;
  }

  /** A type, through the aliases and interfaces the module declares, to an object type's body. */
  #resolve(node: TypeNode | undefined, seen: Set<string>): TypeNode | undefined {
    if (!node) return undefined;
    if (node.type === "TSParenthesizedType") {
      return this.#resolve(node.typeAnnotation as TypeNode, seen);
    }
    if (node.type !== "TSTypeReference") return node;
    const name = (node.typeName as { type: string; name?: string }).name;
    if (name === undefined || isArrayReference(node)) return node;
    const declared = this.#types.get(name);
    if (declared === undefined || seen.has(name)) return undefined;
    const declaration = parseDeclaration(declared);
    if (!declaration) return undefined;
    if (declaration.type === "TSInterfaceDeclaration") return declaration.body as TypeNode;
    return this.#resolve(declaration.typeAnnotation as TypeNode, new Set([...seen, name]));
  }

  /** Whether a type may be a union, or `null` or `undefined`. */
  #union(facts: TypeFacts): boolean {
    if (facts.plain) return false;
    return this.#unionType(facts.node, new Set());
  }

  #unionType(node: TypeNode | undefined, seen: Set<string>): boolean {
    if (!node) return true;
    switch (node.type) {
      case "TSStringKeyword":
      case "TSNumberKeyword":
      case "TSBooleanKeyword":
      case "TSBigIntKeyword":
      case "TSSymbolKeyword":
      case "TSObjectKeyword":
      case "TSArrayType":
      case "TSTupleType":
      case "TSTypeLiteral":
      case "TSFunctionType":
      case "TSLiteralType":
      case "TSTemplateLiteralType":
      case "TSInterfaceBody":
        return false;
      case "TSParenthesizedType":
      case "TSTypeOperator":
        return this.#unionType(node.typeAnnotation as TypeNode, seen);
      case "TSTypeReference": {
        const name = (node.typeName as { type: string; name?: string }).name;
        if (name === undefined) return true;
        if (PLAIN_TYPES.has(name)) return false;
        const declared = this.#types.get(name);
        if (declared === undefined || seen.has(name)) return true;
        const declaration = parseDeclaration(declared);
        if (!declaration) return true;
        if (declaration.type === "TSInterfaceDeclaration") return false;
        return this.#unionType(declaration.typeAnnotation as TypeNode, new Set([...seen, name]));
      }
      default:
        // A union, `null`, `undefined`, `unknown`, `any`, a conditional or an indexed type.
        return true;
    }
  }
}

/** `Array<T>` or `ReadonlyArray<T>`. */
function isArrayReference(node: TypeNode): boolean {
  const name = (node.typeName as { name?: string } | undefined)?.name;
  return node.type === "TSTypeReference" && (name === "Array" || name === "ReadonlyArray");
}

/** A type annotation's AST, or `undefined` where it does not parse alone. */
function parseType(code: string): TypeNode | undefined {
  try {
    const [statement] = parseStatementsSource(`type T = ${code};`).statements;
    return (statement as unknown as { typeAnnotation?: TypeNode }).typeAnnotation;
  } catch {
    return undefined;
  }
}

/** A module's type declaration's AST: an interface or an alias. */
function parseDeclaration(code: string): TypeNode | undefined {
  try {
    const [statement] = parseStatementsSource(code).statements;
    return statement as unknown as TypeNode;
  } catch {
    return undefined;
  }
}

/** What a literal initial value says of its type: no union for a number, string, array or object. */
function literalFacts(code: string): TypeFacts {
  let node: Parsed;
  try {
    node = unwrapped(parseExpression(code));
  } catch {
    return UNKNOWN;
  }
  const plain: TypeFacts = { node: undefined, optional: false, plain: true };
  switch (node.type) {
    case "Literal":
      return node.raw === "null" ? UNKNOWN : plain;
    case "TemplateLiteral":
    case "ArrayExpression":
    case "ObjectExpression":
      return plain;
    case "UnaryExpression":
      return (node.operator === "-" || node.operator === "+") &&
        node.argument.type === "Literal" &&
        typeof node.argument.value === "number"
        ? plain
        : UNKNOWN;
    default:
      return UNKNOWN;
  }
}

/** Whether `prefix` is `path` or a path `path` is read through. */
function isPrefix(prefix: ReferencePath, path: ReferencePath): boolean {
  return (
    prefix.binding === path.binding &&
    prefix.keys.length <= path.keys.length &&
    prefix.keys.every((key, index) => path.keys[index] === key)
  );
}

/** The longest of `candidates` that is `path` or a prefix of it. */
function longestPrefix(
  path: ReferencePath,
  candidates: readonly ReferencePath[],
): ReferencePath | undefined {
  let longest: ReferencePath | undefined;
  for (const candidate of candidates) {
    if (
      candidate.binding === path.binding &&
      candidate.keys.length <= path.keys.length &&
      candidate.keys.every((key, index) => path.keys[index] === key) &&
      candidate.keys.length >= (longest?.keys.length ?? 0)
    ) {
      longest = candidate;
    }
  }
  return longest;
}

/**
 * Whether the props' types may hold a falsy literal (`""`, `0`, `false`): a keyed callback's
 * value is typed `NonNullable<T>` of its `when`, which keeps them where the source's truthiness
 * test removes them, so a `when` that is the test itself is then written `test || undefined`,
 * which TypeScript narrows as the source does. Read from the types' text, conservatively: a
 * `0`, a `false` or an empty quote anywhere counts, a comment's or a longer literal's included.
 * A `boolean` does not: a branch reads a tested boolean as a boolean, which `NonNullable` keeps.
 */
export function declaresFalsyLiteral(types: readonly string[]): boolean {
  return types.some(
    (code) =>
      /(["'`])\1/.test(code) ||
      /(?<![\w$])false(?![\w$])/.test(code) ||
      [...code.matchAll(/(?<![\w$])\.?\d[\w.]*/g)].some(
        ([token]) => Number(token.replaceAll("_", "").replace(/n$/, "")) === 0,
      ),
  );
}

/**
 * Whether a branch's expressions narrow a path it receives further: a conditional or a logical
 * operator whose test reads past it (`user.nick ? user.nick.trim() : "none"`, with `user`
 * received, or `plan.kind === "paid" && plan.renews`). TypeScript narrows a read of a value, never
 * of a call, so such a branch needs the values themselves: a keyed callback.
 */
export function narrowsFurther(
  children: readonly RenderNode[],
  paths: readonly ReferencePath[],
): boolean {
  const further = (part: Expression) =>
    readsOf(part).some(({ path: read }) =>
      paths.some(
        (path) =>
          path.binding === read.binding &&
          read.keys.length > path.keys.length &&
          path.keys.every((key, index) => read.keys[index] === key),
      ),
    );
  return expressionsIn(children).some((expression) => {
    let found = false;
    const visit = (node: unknown): void => {
      if (found) return;
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (!isNode(node)) return;
      // The walk reads parsed nodes, as `readsOf` does.
      const parsed = node as Parsed;
      // `??` narrows nothing its right operand reads.
      const test =
        parsed.type === "ConditionalExpression"
          ? parsed.test
          : parsed.type === "LogicalExpression" && parsed.operator !== "??"
            ? parsed.left
            : undefined;
      if (test && further(slice(expression, test))) {
        found = true;
        return;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key !== "type" && typeof value === "object") visit(value);
      }
    };
    visit(parseExpression(expression.code));
    return found;
  });
}

/** Paths, each once. */
function union(...groups: (readonly ReferencePath[])[]): ReferencePath[] {
  const paths: ReferencePath[] = [];
  for (const path of groups.flat()) {
    if (!paths.some((entry) => samePath(entry, path))) paths.push(path);
  }
  return paths;
}

function intersection(a: readonly ReferencePath[], b: readonly ReferencePath[]): ReferencePath[] {
  return a.filter((path) => b.some((entry) => samePath(entry, path)));
}

/** A path and each of its prefixes up to `depth` properties: `user`, `user.address`… */
function prefixes(path: ReferencePath, depth: number): ReferencePath[] {
  return Array.from({ length: depth + 1 }, (_, length) => ({
    binding: path.binding,
    keys: path.keys.slice(0, length),
  }));
}

/** The properties of a path's read before its first `?.`: 1 for `box.inner?.t`. */
function plainDepth(node: Parsed): number {
  const optional: boolean[] = [];
  let current: Parsed = node.type === "ChainExpression" ? node.expression : node;
  while (current.type === "MemberExpression") {
    optional.unshift(current.optional);
    current = current.object;
  }
  const first = optional.indexOf(true);
  return first < 0 ? optional.length : first;
}

/**
 * The paths an expression reads, every object on the way present, whenever it runs: the paths it
 * reads before any `&&`, `||`, `??` or `?:` decides, and before the first `?.` of a chain, which
 * may stop there. `whole` where the chain is known to have run to its end.
 */
function evaluated(node: Parsed, expression: Expression, whole = false): ReferencePath[] {
  const path = pathAt(node, expression);
  if (path) return prefixes(path, whole ? path.keys.length : plainDepth(node));
  switch (node.type) {
    case "ChainExpression": {
      if (whole) return evaluated(node.expression, expression, true);
      // Up to the object of its first `?.`, which runs whatever the chain gives.
      let head: Parsed = node.expression;
      let reached: Parsed | undefined;
      for (;;) {
        if (head.type === "MemberExpression") {
          if (head.optional) reached = head.object;
          head = head.object;
        } else if (head.type === "CallExpression") {
          if (head.optional) reached = head.callee;
          head = head.callee;
        } else {
          break;
        }
      }
      return reached ? evaluated(reached, expression, true) : [];
    }
    case "MemberExpression":
      return union(
        evaluated(node.object, expression, whole),
        node.computed ? evaluated(node.property, expression, whole) : [],
      );
    case "CallExpression":
      return union(
        node.callee.type === "MemberExpression"
          ? evaluated(node.callee.object, expression, whole)
          : evaluated(node.callee, expression, whole),
        ...node.arguments.map((argument) =>
          argument.type === "SpreadElement" ? [] : evaluated(argument, expression),
        ),
      );
    case "UnaryExpression":
      return evaluated(node.argument, expression);
    case "BinaryExpression":
      return union(
        node.left.type === "PrivateIdentifier" ? [] : evaluated(node.left, expression),
        evaluated(node.right, expression),
      );
    case "LogicalExpression":
      return evaluated(node.left, expression);
    case "ConditionalExpression":
      return evaluated(node.test, expression);
    case "TemplateLiteral":
      return union(...node.expressions.map((part) => evaluated(part, expression)));
    case "ParenthesizedExpression":
      return evaluated(node.expression, expression, whole);
    default:
      return [];
  }
}

/**
 * The paths a test reads, every object on the way present, wherever it is truthy (`truthy`) or
 * falsy: a chain that gives a truthy value ran to its end, `a && b` that is falsy read what `a`
 * read when falsy, and also when truthy or what `b` read when falsy, and so on.
 */
function outcome(node: Parsed, expression: Expression, truthy: boolean): ReferencePath[] {
  if (pathAt(node, expression) || node.type === "ChainExpression") {
    return evaluated(node, expression, truthy);
  }
  switch (node.type) {
    case "ParenthesizedExpression":
      return outcome(node.expression, expression, truthy);
    case "UnaryExpression":
      return node.operator === "!"
        ? outcome(node.argument, expression, !truthy)
        : evaluated(node, expression);
    case "LogicalExpression": {
      const left = (value: boolean) => outcome(node.left, expression, value);
      const right = (value: boolean) => outcome(node.right, expression, value);
      if (node.operator === "&&") {
        return truthy
          ? union(left(true), right(true))
          : intersection(left(false), union(left(true), right(false)));
      }
      if (node.operator === "||") {
        return truthy
          ? intersection(left(true), union(left(false), right(true)))
          : union(left(false), right(false));
      }
      return evaluated(node, expression);
    }
    case "BinaryExpression": {
      const read = evaluated(node, expression);
      if (!["===", "==", "!==", "!="].includes(node.operator)) return read;
      if (node.left.type === "PrivateIdentifier") return read;
      // Whether the sides are equal, and so whether a chain on one side ran to its end.
      const equal = (node.operator === "===" || node.operator === "==") === truthy;
      const loose = node.operator === "==" || node.operator === "!=";
      const ends = (other: Parsed): boolean =>
        equal ? isPresent(other) : isUndefined(other) || (loose && isNull(other));
      const sides: [Parsed, Parsed][] = [
        [node.left, node.right],
        [node.right, node.left],
      ];
      const whole = sides.flatMap(([side, other]) => {
        // `typeof x?.k === "string"` or `!== "undefined"`: the chain gave something, so it ran
        // to its end.
        if (side.type === "UnaryExpression" && side.operator === "typeof") {
          return other.type === "Literal" &&
            typeof other.value === "string" &&
            equal === (other.value !== "undefined")
            ? evaluated(side.argument, expression, true)
            : [];
        }
        return ends(other) ? evaluated(side, expression, true) : [];
      });
      return union(read, whole);
    }
    case "CallExpression": {
      const read = evaluated(node, expression);
      const [argument] = node.arguments;
      const isArray =
        truthy &&
        node.callee.type === "MemberExpression" &&
        !node.callee.computed &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "Array" &&
        node.callee.property.name === "isArray" &&
        argument !== undefined &&
        argument.type !== "SpreadElement";
      return isArray ? union(read, evaluated(argument, expression, true)) : read;
    }
    default:
      return evaluated(node, expression);
  }
}

/** A literal that is neither `null` nor `undefined`: `"circle"`, `0`, `-1`, `` `a` ``. */
function isPresent(node: Parsed): boolean {
  if (node.type === "Literal") return node.raw !== "null";
  if (node.type === "TemplateLiteral") return true;
  return (
    node.type === "UnaryExpression" &&
    (node.operator === "-" || node.operator === "+") &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number"
  );
}

function isUndefined(node: Parsed): boolean {
  return (
    (node.type === "Identifier" && node.name === "undefined") ||
    (node.type === "UnaryExpression" && node.operator === "void")
  );
}

function isNull(node: Parsed): boolean {
  return node.type === "Literal" && node.raw === "null";
}

/** Whether a condition is exactly one path, `user` or `box.inner?.t`, and which. */
export function wholePath(condition: Expression): ReferencePath | undefined {
  return pathAt(parseExpression(condition.code), condition);
}

/** The operand of a negated condition, `user` of `!user`, or `undefined`. */
export function negatedOperand(condition: Expression): Expression | undefined {
  const node = parseExpression(condition.code);
  return node.type === "UnaryExpression" && node.operator === "!"
    ? slice(condition, node.argument)
    : undefined;
}

/** The part of an expression that a node of its parsed code spans, with its references. */
export function slice(
  expression: Expression | Code,
  part: { start: number; end: number },
): Expression {
  const start = expression.span.start + part.start;
  const end = expression.span.start + part.end;
  return {
    code: expression.code.slice(part.start, part.end),
    span: { start, end },
    // A handler's code holds writes and emits too: a path's read holds none.
    refs: (expression.refs as readonly CodeReference[]).flatMap((reference) =>
      (reference.kind === "Binding" || reference.kind === "Global") &&
      reference.span.start >= start &&
      reference.span.end <= end
        ? [reference]
        : [],
    ),
  };
}

/**
 * A carried path as an expression the `when` builds the value from: the first read of it, or of
 * a longer path through it, in the tests or the branch, cut to the path (`props.box.inner` of
 * `box.inner?.t`).
 */
export function pathExpression(
  path: ReferencePath,
  tests: readonly Expression[],
  children: readonly RenderNode[],
): Expression {
  for (const expression of [...tests, ...expressionsIn(children)]) {
    for (const read of readsOf(expression)) {
      if (read.path.binding !== path.binding || read.path.keys.length < path.keys.length) continue;
      if (!path.keys.every((key, index) => read.path.keys[index] === key)) continue;
      return slice(expression, prefixOf(read, path.keys.length, expression));
    }
  }
  throw new Error("A carried path is read nowhere.");
}

/** The node of a read that spans its first `depth` properties: its object, its object's… */
function prefixOf(read: Read, depth: number, expression: Expression | Code): Parsed {
  let node = read.node;
  for (;;) {
    if (pathAt(node, expression)?.keys.length === depth) return node;
    if (node.type === "ChainExpression") node = node.expression;
    else if (node.type === "MemberExpression") node = node.object;
    else return node;
  }
}

/**
 * How a branch's callback reads the paths it receives: for each, the code that reads it through
 * the callback's accessor (`user()`, `narrowed().count`).
 */
export interface Frame {
  /** The callback's parameter: the accessor. */
  parameter: string;
  names: { path: ReferencePath; name: string; read: string }[];
}

/**
 * The callbacks around what is being printed, innermost last, and how they read the paths they
 * receive. One per output file, beside its name scope.
 */
export class Narrowings {
  readonly #imports: ImportSet;
  readonly #sourceNames: ReadonlySet<string>;
  /** Source names an output prints as they are (a list's variable, an arrow's parameter, a
   * global, the object form's parameter), which a callback's name would capture. */
  readonly #bare: ReadonlySet<string>;
  /** The names callbacks took that are neither the source's nor another claim's. */
  readonly #taken = new Set<string>();
  /** The accessor names of object-valued branches this file claimed (`narrowed`, `narrowed_1`). */
  readonly #accessors: string[] = [];
  readonly #frames: Frame[] = [];
  /** The reads {@link once} is taking as parameters, by what they read. */
  #once: Map<string, { name: string; read: string }> | undefined;
  /** What the bindings' types allow a test to narrow. */
  readonly types: BindingTypes;

  constructor(
    imports: ImportSet,
    sourceNames: ReadonlySet<string>,
    component: UfComponent,
    types: BindingTypes,
  ) {
    this.types = types;
    this.#imports = imports;
    this.#sourceNames = sourceNames;
    // A prop prints as `props.user` or `card.user`, never as `user`: its name captures nothing,
    // unless the object form's parameter has it.
    const props = new Set(component.props.map((prop) => prop.name));
    const parameter = component.propsParameter?.name;
    this.#bare = new Set([...sourceNames].filter((name) => !props.has(name) || name === parameter));
  }

  /**
   * Names for the values a callback receives: each path's binding's name, or its last
   * property's (`user`, `address`), or `value` for one no target can declare, unless that would
   * capture something: a name an output prints as it is (a list's variable, a state's accessor,
   * an arrow's parameter, a global, the object form's parameter), an import or a helper the
   * output claimed, a name a callback around it gives another path, or a name this callback
   * gives another path. Then a free name is claimed from the file's name scope, and a name kept
   * is reserved there, so nothing claimed later takes it. A keyed callback's value takes a list's
   * item's name, as every read of it inside is the narrowed value. An accessor takes the name of
   * a binding it narrows whole (a list's item, a state) only in a branch without client code
   * (`accessor-only`): a handler inside would read the accessor, which throws once the branch's
   * test fails, where the source reads the binding; every render read of the binding goes
   * through the accessor anyway.
   */
  names(
    paths: readonly ReferencePath[],
    context: JsxContext,
    mode: "keyed" | "accessor" | "accessor-only",
  ): string[] {
    const names: string[] = [];
    for (const path of paths) {
      const key = path.keys.at(-1);
      const preferred =
        key === undefined
          ? jsxBinding(path.binding, context).name
          : reservedPropName(key) === undefined
            ? key
            : "value";
      const claimed =
        this.#imports.scope.has(preferred) &&
        !this.#sourceNames.has(preferred) &&
        !this.#taken.has(preferred);
      const enclosing = this.#frames.some((frame) =>
        frame.names.some((entry) => entry.name === preferred && !samePath(entry.path, path)),
      );
      // Keyed, a list's variable taken whole is every read of it inside, so its own name
      // captures nothing (UF3024 rejects a parameter that would shadow it); an accessor may take
      // the name of a binding that prints as it (a list's variable, a state's or a derived
      // value's accessor) where no client code inside would read it.
      const printed = printedAsName(jsxBinding(path.binding, context).kind);
      const shadows =
        key === undefined &&
        (mode === "keyed" ? printed === "loopVar" : mode === "accessor-only" && Boolean(printed));
      if (
        (this.#bare.has(preferred) && !shadows) ||
        claimed ||
        enclosing ||
        names.includes(preferred)
      ) {
        names.push(this.#imports.claim(preferred));
        continue;
      }
      if (!this.#imports.scope.has(preferred)) {
        this.#imports.reserve(preferred);
        this.#taken.add(preferred);
      }
      names.push(preferred);
    }
    return names;
  }

  /**
   * The keys of the object a `when` builds of `paths`, read as `narrowed().count`: each path's
   * binding's name, or its last property's, or `value` for one no target can declare, and
   * `_1`, `_2`… for one an earlier key took. Keys are no variables, so they capture nothing.
   */
  keys(paths: readonly ReferencePath[], context: JsxContext): string[] {
    const keys: string[] = [];
    for (const path of paths) {
      const key = path.keys.at(-1);
      const preferred =
        key === undefined
          ? jsxBinding(path.binding, context).name
          : reservedPropName(key) === undefined
            ? key
            : "value";
      let unique = preferred;
      for (let suffix = 1; keys.includes(unique); suffix++) unique = `${preferred}_${suffix}`;
      keys.push(unique);
    }
    return keys;
  }

  /**
   * The accessor's name for a branch whose `when` is an object of paths: `narrowed`, or the
   * first of `narrowed_1`, `narrowed_2`… that no callback around it uses, claimed once per file.
   */
  accessor(): string {
    const around = new Set(this.#frames.map((frame) => frame.parameter));
    const free = this.#accessors.find((name) => !around.has(name));
    if (free) return free;
    const name = this.#imports.claim("narrowed");
    this.#accessors.push(name);
    return name;
  }

  /** The paths the callbacks around what is being printed receive. */
  carried(): ReferencePath[] {
    return this.#frames.flatMap((frame) => frame.names.map((entry) => entry.path));
  }

  /**
   * What `print` returns, with each read that calls (a state's or a derived value's accessor, a
   * callback's accessor) written as a parameter, and those reads: a `when` that builds an object
   * of what its tests narrow reads each once, as an arrow's argument it calls at once, where
   * TypeScript narrows it (`((user) => (user !== null ? { user } : undefined))(user())`), as it
   * narrows no call.
   */
  once<T>(print: () => T): { value: T; parameters: { name: string; read: string }[] } {
    const outer = this.#once;
    const parameters = new Map<string, { name: string; read: string }>();
    this.#once = parameters;
    try {
      return { value: print(), parameters: [...parameters.values()] };
    } finally {
      this.#once = outer;
    }
  }

  /** The parameter {@link once} takes for a read that calls, keyed by what it reads. */
  #parameter(key: string, read: string, preferred: string, own: boolean): string {
    const parameters = this.#once!;
    const known = parameters.get(key);
    if (known) return known.name;
    const used = new Set([...parameters.values()].map((entry) => entry.name));
    // A binding's own name shadows only the accessor it replaces; any other might capture a name
    // the code prints as it is, a callback's or one the output claimed.
    const captures =
      this.#bare.has(preferred) ||
      this.#taken.has(preferred) ||
      (this.#imports.scope.has(preferred) && !this.#sourceNames.has(preferred));
    let name =
      !used.has(preferred) && (own || !captures) ? preferred : this.#imports.claim(preferred);
    while (used.has(name)) name = this.#imports.claim(preferred);
    parameters.set(key, { name, read });
    return name;
  }

  /**
   * A handler's function with each read of a path a callback around it receives written as that
   * callback's read of it (`() => pick(member().name)`): TypeScript does not narrow a prop's or a
   * state's read inside a branch's callback, where the accessor gives the narrowed value. A
   * handler that reads one is a call whose arguments run at once, while its element and so its
   * branch are there (UF3029).
   */
  client(fn: FunctionCode): FunctionCode {
    const entries = this.#frames.flatMap((frame) => frame.names);
    if (!entries.length || !fn.expression) return fn;
    const edits: { start: number; end: number; text: string }[] = [];
    for (const read of readsOf(fn.body)) {
      const best = this.#best(read, entries);
      if (!best) continue;
      const node = prefixOf(read, best.depth, fn.body);
      edits.push({ start: node.start, end: node.end, text: best.read });
    }
    if (!edits.length) return fn;
    return { ...fn, body: replaced(fn.body, edits) };
  }

  /** The longest carried prefix of a read, from the innermost callback. */
  #best(
    read: Read,
    entries: readonly Frame["names"][number][],
  ): { read: string; depth: number; name: string } | undefined {
    let best: { read: string; depth: number; name: string } | undefined;
    for (const entry of entries) {
      if (entry.path.binding !== read.path.binding) continue;
      if (entry.path.keys.length > read.path.keys.length) continue;
      if (!entry.path.keys.every((key, index) => read.path.keys[index] === key)) continue;
      if (!best || entry.path.keys.length >= best.depth) {
        best = { read: entry.read, depth: entry.path.keys.length, name: entry.name };
      }
    }
    return best;
  }

  /** What `print` returns, with the frame's paths read through its accessor while it prints. */
  within<T>(frame: Frame, print: () => T): T {
    this.#frames.push(frame);
    try {
      return print();
    } finally {
      this.#frames.pop();
    }
  }

  /**
   * An expression's code: its source with every read of a path a callback around it receives
   * as that callback's read of it (the longest such path, the innermost callback's), and every
   * other reference as the rewrite rules spell it.
   */
  code(expression: Expression, context: JsxContext): string {
    const rules = context.rules!;
    const entries = this.#frames.flatMap((frame) => frame.names);
    // A narrowed member path whose read Solid spells as a call asserts its end (src/asserted.ts).
    const asserts = expression.refs.some(
      (reference) =>
        reference.kind === "Binding" &&
        assertedPathEnds(reference, jsxBinding(reference.binding, context)).length > 0,
    );
    if (!entries.length && !this.#once && !asserts) {
      return rewriteExpression(expression, context.component, rules);
    }
    const offset = expression.span.start;
    const edits: { start: number; end: number; text: string }[] = [];
    const replaced: { start: number; end: number }[] = [];
    for (const read of readsOf(expression)) {
      const best = this.#best(read, entries);
      if (!best) continue;
      const node = prefixOf(read, best.depth, expression);
      const written = expression.code.slice(node.start, node.end);
      // A shorthand property (`{ user }`) is a binding read whole.
      const shorthand = expression.refs.some(
        (reference) =>
          reference.kind === "Binding" &&
          reference.shorthand &&
          reference.span.start - offset === node.start,
      );
      const value =
        this.#once && best.read.endsWith(")")
          ? this.#parameter(
              `read:${best.read}`,
              best.read,
              best.name,
              best.read === `${best.name}()`,
            )
          : best.read;
      const text = shorthand && value !== written ? `${written}: ${value}` : value;
      edits.push({ start: node.start, end: node.end, text });
      replaced.push(node);
    }
    for (const reference of expression.refs) {
      const start = reference.span.start - offset;
      const end = reference.span.end - offset;
      // The rules spell no global differently on Solid: only bindings change.
      if (
        reference.kind !== "Binding" ||
        replaced.some((node) => start >= node.start && end <= node.end)
      ) {
        continue;
      }
      const written = expression.code.slice(start, end);
      const binding = jsxBinding(reference.binding, context);
      let spelling = rules.binding(reference, binding, written, "render");
      if (this.#once && printedAsName(binding.kind) === "accessor") {
        // An arrow's parameter, which TypeScript narrows itself: no assertion.
        spelling = this.#parameter(
          `binding:${binding.id}`,
          spelling.replace(/!$/, ""),
          binding.name,
          true,
        );
      } else {
        for (const position of assertedPathEnds(reference, binding)) {
          edits.push({ start: position - offset, end: position - offset, text: "!" });
        }
      }
      if (spelling === written) continue;
      edits.push({ start, end, text: reference.shorthand ? `${written}: ${spelling}` : spelling });
    }
    let code = "";
    let last = 0;
    for (const edit of edits.toSorted((a, b) => a.start - b.start)) {
      code += expression.code.slice(last, edit.start) + edit.text;
      last = edit.end;
    }
    return code + expression.code.slice(last);
  }
}

/**
 * Code with ranges of its text replaced (reads of paths, which hold only the references of those
 * paths): the references inside them dropped, and every other span moved past what changed
 * before it.
 */
function replaced(
  code: Code,
  edits: readonly { start: number; end: number; text: string }[],
): Code {
  const offset = code.span.start;
  const sorted = edits.toSorted((a, b) => a.start - b.start);
  const shift = (position: number) =>
    position +
    sorted
      .filter((edit) => edit.end + offset <= position)
      .reduce((sum, edit) => sum + edit.text.length - (edit.end - edit.start), 0);
  const moved = (span: Span): Span => ({ start: shift(span.start), end: shift(span.end) });
  const inside = (span: Span) =>
    sorted.some((edit) => span.start >= edit.start + offset && span.end <= edit.end + offset);
  let text = "";
  let last = 0;
  for (const edit of sorted) {
    text += code.code.slice(last, edit.start) + edit.text;
    last = edit.end;
  }
  text += code.code.slice(last);
  const refs = code.refs.flatMap((ref): CodeReference[] => {
    if (inside(ref.span)) return [];
    switch (ref.kind) {
      case "Write":
        return [
          {
            ...ref,
            span: moved(ref.span),
            target: moved(ref.target),
            ...(ref.value ? { value: moved(ref.value) } : {}),
          },
        ];
      case "Emit":
        return [{ ...ref, span: moved(ref.span), arguments: ref.arguments.map(moved) }];
      case "Binding":
      case "Global":
      case "Event":
      case "Api":
        return [{ ...ref, span: moved(ref.span) }];
      default:
        return ref satisfies never;
    }
  });
  return { code: text, span: { start: offset, end: offset + text.length }, refs };
}

/**
 * How a binding of a kind prints in a template, where a branch's callback might take its name: a
 * list's variable as its name, a state's or a derived value's as its accessor's (`count()`); a
 * prop never as its name alone (`props.count`), and nothing else reaches a template.
 */
function printedAsName(kind: BindingKind): "loopVar" | "accessor" | undefined {
  switch (kind) {
    case "loopVar":
      return "loopVar";
    case "state":
    case "derived":
      return "accessor";
    case "prop":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return undefined;
    default:
      return kind satisfies never;
  }
}
