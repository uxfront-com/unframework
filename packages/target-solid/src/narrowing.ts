// What a Solid conditional's branches need of its tests. TypeScript narrows what a condition
// tests inside its branch (`user && <p>{user.name}</p>` reads a `User`, not a
// `User | undefined`), so the source type-checks, and so do the targets that write the branch
// inside the test: a ternary, `{#if}`, `@if`. Solid writes a conditional as `<Show>` or
// `<Switch>`/`<Match>`, whose children are no branch of their condition to TypeScript:
// `props.user.name` there fails L4. So a branch that reads what its tests read takes it from a
// keyed callback as a plain value, narrowed by TypeScript where the `when` builds it, and only
// as far as the tests have read it wherever the branch renders (see {@link carriedPaths}):
//
//   <Show keyed when={props.user}>{(user) => <p>{user.name}</p>}</Show>
//   <Show keyed when={props.count !== undefined ? { count: props.count } : undefined}>
//     {({ count }) => <b>{count.toFixed(1)}</b>}
//   </Show>
//
// The branch's code is then the source's, with plain names that TypeScript narrows as it
// narrows the source's, in closures too. A value a callback receives never goes stale: Solid
// re-creates a keyed branch when its value changes, and the `<Show>` or `<Switch>` memo disposes
// it before anything inside can read a value its test no longer guards. The rules are syntactic:
// carrying a value that needed no narrowing renders alike.
import { jsxBinding, parseExpression, rewriteExpression } from "@unframework/codegen";
import type { ImportSet, JsxContext } from "@unframework/codegen";
import { reservedPropName } from "@unframework/ir";
import type { BindingId, Expression, RenderNode, UfComponent } from "@unframework/ir";

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
function pathAt(node: Parsed, expression: Expression): ReferencePath | undefined {
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
function readsOf(expression: Expression): Read[] {
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

/** Every expression nodes print on Solid (a list's key is not printed, so it is left out). */
function expressionsIn(nodes: readonly RenderNode[]): Expression[] {
  const found: Expression[] = [];
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
): ReferencePath[] {
  const read = union(
    ...tests.map((test, index) =>
      outcome(parseExpression(test.code), test, holds && index === tests.length - 1),
    ),
  );
  const carried: ReferencePath[] = [];
  for (const expression of expressionsIn(children)) {
    for (const { path } of readsOf(expression)) {
      const longest = longestPrefix(path, read);
      const around = longestPrefix(path, enclosing);
      if (!longest || (around && around.keys.length > longest.keys.length)) continue;
      if (!carried.some((entry) => samePath(entry, longest))) carried.push(longest);
    }
  }
  return carried;
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
export function slice(expression: Expression, part: { start: number; end: number }): Expression {
  const start = expression.span.start + part.start;
  const end = expression.span.start + part.end;
  return {
    code: expression.code.slice(part.start, part.end),
    span: { start, end },
    refs: expression.refs.filter(
      (reference) => reference.span.start >= start && reference.span.end <= end,
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
function prefixOf(read: Read, depth: number, expression: Expression): Parsed {
  let node = read.node;
  for (;;) {
    if (pathAt(node, expression)?.keys.length === depth) return node;
    if (node.type === "ChainExpression") node = node.expression;
    else if (node.type === "MemberExpression") node = node.object;
    else return node;
  }
}

/** The names a keyed callback gives the paths it receives. */
interface Frame {
  names: { path: ReferencePath; name: string }[];
}

/**
 * The keyed callbacks around what is being printed, innermost last, and the names they give the
 * values they receive. One per output file, beside its name scope.
 */
export class Narrowings {
  readonly #imports: ImportSet;
  readonly #sourceNames: ReadonlySet<string>;
  /** Source names an output prints as they are (a list's variable, an arrow's parameter, a
   * global, the object form's parameter), which a callback's name would capture. */
  readonly #bare: ReadonlySet<string>;
  /** The names callbacks took that are neither the source's nor another claim's. */
  readonly #taken = new Set<string>();
  readonly #frames: Frame[] = [];

  constructor(imports: ImportSet, sourceNames: ReadonlySet<string>, component: UfComponent) {
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
   * capture something: a name an output prints as it is (a list's variable, but for itself taken
   * whole, an arrow's parameter, a global, the object form's parameter), an import or a helper
   * the output claimed, a name a callback around it gives another path, or a name this callback
   * gives another path. Then a free name is claimed from the file's name scope, and a name kept
   * is reserved there, so nothing claimed later takes it.
   */
  names(paths: readonly ReferencePath[], context: JsxContext): string[] {
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
      // A list's variable taken whole is every read of it inside, so its own name captures
      // nothing (UF3024 rejects a parameter that would shadow it).
      const own = key === undefined && jsxBinding(path.binding, context).kind === "loopVar";
      if (
        (this.#bare.has(preferred) && !own) ||
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

  /** The paths the keyed callbacks around what is being printed receive. */
  carried(): ReferencePath[] {
    return this.#frames.flatMap((frame) => frame.names.map((entry) => entry.path));
  }

  /** What `print` returns, with the frame's paths read by their names while it prints. */
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
   * as that callback's name for it (the longest such path, the innermost callback's), and
   * every other reference as the rewrite rules spell it.
   */
  code(expression: Expression, context: JsxContext): string {
    const rules = context.rules!;
    const entries = this.#frames.flatMap((frame) => frame.names);
    if (!entries.length) return rewriteExpression(expression, context.component, rules);
    const offset = expression.span.start;
    const edits: { start: number; end: number; text: string }[] = [];
    const replaced: { start: number; end: number }[] = [];
    for (const read of readsOf(expression)) {
      // The longest carried prefix of the read, from the innermost callback.
      let best: { name: string; depth: number } | undefined;
      for (const entry of entries) {
        if (entry.path.binding !== read.path.binding) continue;
        if (entry.path.keys.length > read.path.keys.length) continue;
        if (!entry.path.keys.every((key, index) => read.path.keys[index] === key)) continue;
        if (!best || entry.path.keys.length >= best.depth) {
          best = { name: entry.name, depth: entry.path.keys.length };
        }
      }
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
      const text = shorthand && written !== best.name ? `${written}: ${best.name}` : best.name;
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
      const spelling = rules.binding(reference, jsxBinding(reference.binding, context), written);
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
