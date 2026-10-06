// What the conditions around a reference make of it where it is read (ADR-0035, ADR-0039): its
// declared kinds, or present (never nullish), or absent, as TypeScript and every target's
// checker narrow it there. A reference that may be nullish by its type is read alike only where
// the checkers agree: a `.` on one they take to be nullish fails them, and Angular rejects a `?.`
// or a `??` on one it has narrowed to a value (NG8107, NG8102), except on a template variable of
// its own (a `@let` that reads an input, a `@for` item). Every target narrows as TypeScript
// narrows the source: the JSX targets and Solid write its conditionals as it does, and
// Angular's, Vue's and Svelte's checkers read their template blocks as TypeScript does. So the
// rules are TypeScript's, where the compiler follows them, probed against Angular 22's compiler
// (strict templates) and every target's type check:
//
// - A test of the reference itself, its negation, any operand of an `&&` or an `||` as the
//   condition holds or fails, the comparisons TypeScript narrows by (with `null` or `undefined`,
//   whose strict forms add up by the declared kinds, with a value, of `typeof`), a member read
//   through `?.` (`box.inner?.title`), `Array.isArray`, and a discriminant of a union the
//   reference is a member of (`plan.kind === "paid"` narrows `plan.renews`).
// - A closure: TypeScript keeps the narrowing of a parameter in one (a list's item, an arrow
//   function's parameter), and forgets that of a property. A destructured prop is one in a
//   conditional child's branch: Solid's keyed `<Show>` or `<Match>` passes its callback the
//   narrowed value, and the other targets read the source's own local. An expression's own
//   conditional is not: Solid copies it with `props.x`, a property. The object form and members
//   are properties on the JSX targets; Angular's and the other template targets' loops keep
//   their narrowing, and their arrow functions forget a member's.
// - A list's key: Angular's `track` reads a prop again from its input (`this.inner()`), which its
//   checker never narrows.
// - Where a narrowing reaches some targets and not others (a closure, a key), a use that relies
//   on it is reported, and one that only tests the value, passes it to `?.` or `??`, compares it
//   or writes it into a string is not (`usedLoosely`).
// - A value a test shows absent (`!box.inner`, `x === undefined`) is `never` to TypeScript, and
//   the template targets' loops and Solid's keyed callbacks keep that.
// - An equality with a value that is no literal (`member === current`) narrows the reference in
//   TypeScript's own way, which the compiler does not follow. Nothing else that mentions it (a
//   relational comparison, arithmetic, `??`, a call's argument) narrows it.
// - The same tests narrow the reference's kinds as TypeScript narrows its type (`narrowedKinds`):
//   `typeof`, `Array.isArray`, truthiness, an equality with a literal and a discriminant of a
//   union keep or take out the kinds they test, in either branch, where every target keeps the
//   narrowing. A discriminant is a member TypeScript reads as one: of a literal type in some of
//   the union's shapes.

import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { RenderContext } from "./render.ts";
import {
  booleanLiteral,
  has,
  memberOf,
  NOTHING,
  numberLiteral,
  stringLiteral,
  union,
  UNDEFINED,
  UNKNOWN,
  without,
} from "./types/kinds.ts";
import type { Kinds, Member, ObjectShape, Primitive } from "./types/kinds.ts";

/** A reference TypeScript narrows: a parameter (a prop or a list's item) and static keys. */
export interface ReferencePath {
  /** What declares the parameter. */
  root: object;
  names: readonly string[];
}

/** Why the checkers read a reference that a condition tests differently. */
export type Unfollowed =
  /**
   * A condition outside a list's callback narrows a property (a prop on Solid, a member):
   * TypeScript forgets it in the callback, and the template targets' loops keep it.
   */
  | "callback"
  /**
   * A condition outside an arrow function in an expression narrows a property: TypeScript
   * forgets it there, Angular's checker too for a member, and Solid copies an expression's
   * conditional with `props.x`.
   */
  | "closure"
  /** A list's key reads a prop a condition narrows: Angular's `track` reads it again. */
  | "key"
  /** A condition tests it in a form the compiler does not follow. */
  | "form";

/** What the conditions around a reference make of it where it is read. */
export type Narrowing =
  /** Its declared kinds: no condition around it says anything of it that every checker reads. */
  | { kind: "declared" }
  /** Never nullish there, on every target. */
  | { kind: "present" }
  /** A condition around it holds only when it is nullish. */
  | { kind: "absent"; condition: AST.Expression }
  /** The targets' checkers may read it differently there, for the reason given. */
  | { kind: "unfollowed"; condition: AST.Expression; reason: Unfollowed };

/** The reference an expression is, through parentheses and `?.`, or `undefined`. */
export function referencePath(
  node: AST.Expression,
  render: RenderContext,
): ReferencePath | undefined {
  const inner = unwrap(node);
  if (inner.type === "Identifier") {
    const resolution = render.scopes.resolve(inner);
    return resolution.kind === "parameter"
      ? { root: resolution.declaration, names: [] }
      : undefined;
  }
  if (inner.type !== "MemberExpression") return undefined;
  const object = referencePath(inner.object, render);
  const name = memberName(inner);
  return object && name !== undefined
    ? { root: object.root, names: [...object.names, name] }
    : undefined;
}

/**
 * Whether Angular's checker reads a reference as an expression whose type it checks, where a
 * needless `?.` or `??` is NG8107 or NG8102: anything but a template variable of its own, which
 * a prop (`@let label = this.label();`, the object form's `props.label` included) and a list's
 * item or index are. An arrow function's parameter is checked too.
 */
export function angularChecks(path: ReferencePath, render: RenderContext): boolean {
  if (path.root === render.propsObject?.declaration) return path.names.length >= 2;
  if (render.propsByDeclaration.has(path.root) || render.loopVariables.has(path.root)) {
    return path.names.length >= 1;
  }
  return true;
}

/**
 * Whether a read of a value only tests it or passes it on where its declared kinds read alike
 * whatever narrows it: the object of `?.` whose chain is used so too, the left of `??`, a test
 * (`?:`, `&&`, `||`, `!`), `typeof`, an equality, a template literal's part, a spread (which
 * reads its keys as its source says), or the value of a list's key. Any other use (a member read
 * through `.`, a call's argument, arithmetic, a relational comparison) relies on its narrowing.
 * A `+` reads alike when its other side is a string, which the caller knows: it is returned.
 */
export function usedLoosely(node: AST.Node, render: RenderContext): boolean | AST.BinaryExpression {
  const ancestors = ancestorsOf(node, render.component);
  // Whether a `?.` of the chain being climbed lies below: the chain ends there where the value
  // is absent, so the links after it read nothing of it.
  let optional = false;
  for (let index = ancestors.length - 1; index > 0; index--) {
    const child = ancestors[index]!;
    const parent = ancestors[index - 1]!;
    switch (parent.type) {
      case "ParenthesizedExpression":
        continue;
      case "ChainExpression":
        optional = false;
        continue;
      case "MemberExpression":
      case "CallExpression": {
        const receiver = parent.type === "MemberExpression" ? parent.object : parent.callee;
        if (receiver !== child) return false;
        if (parent.optional) optional = true;
        else if (!optional) return false;
        continue;
      }
      case "LogicalExpression":
        if (parent.left === child) return true;
        continue;
      case "ConditionalExpression":
        if (parent.test === child) return true;
        continue;
      case "UnaryExpression":
        return parent.operator === "!" || parent.operator === "typeof";
      case "BinaryExpression":
        if (EQUALITY.has(parent.operator)) return true;
        return parent.operator === "+" ? parent : false;
      case "TemplateLiteral":
      case "JSXExpressionContainer":
      case "JSXSpreadAttribute":
        return true;
      default:
        return false;
    }
  }
  return false;
}

/** A regular expression's members and the string methods that read it without its text. */
const REGEX_MEMBERS: ReadonlySet<string> = new Set([
  "test",
  "exec",
  "flags",
  "global",
  "ignoreCase",
  "multiline",
  "sticky",
  "unicode",
  "unicodeSets",
  "dotAll",
  "hasIndices",
  "lastIndex",
]);
const REGEX_METHODS: ReadonlySet<string> = new Set([
  "replace",
  "replaceAll",
  "split",
  "match",
  "matchAll",
  "search",
]);

/**
 * Whether an expression's value (a regular expression literal) may be read as text: anything
 * but a member that is no text of it (`.test()`, `.flags`), the pattern of a string method
 * (`replace`, `split`, …), an equality or a test. Its `.source`, its string form (`String(re)`,
 * `` `${re}` ``, `+`) and anything that passes it on are.
 */
export function readsAsText(node: AST.Node, render: RenderContext): boolean {
  const ancestors = ancestorsOf(node, render.component);
  for (let index = ancestors.length - 1; index > 0; index--) {
    const child = ancestors[index]!;
    const parent = ancestors[index - 1]!;
    switch (parent.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
        continue;
      case "ConditionalExpression":
        if (parent.test === child) return false;
        continue;
      case "LogicalExpression":
        if (parent.left === child && parent.operator !== "??") return false;
        continue;
      case "MemberExpression": {
        if (parent.object !== child) return true;
        const name = memberName(parent);
        return name === undefined || !REGEX_MEMBERS.has(name);
      }
      case "CallExpression": {
        const { callee } = parent;
        if (callee === child || parent.arguments[0] !== child) return true;
        const name = callee.type === "MemberExpression" ? memberName(callee) : undefined;
        return name === undefined || !REGEX_METHODS.has(name);
      }
      case "BinaryExpression":
        return !EQUALITY.has(parent.operator);
      case "UnaryExpression":
        return parent.operator !== "!" && parent.operator !== "typeof";
      // Rendered or bound whole, an object is reported for its kind (UF3016, UF3018).
      case "JSXExpressionContainer":
        return false;
      default:
        return true;
    }
  }
  return true;
}

const NARROWINGS = new WeakMap<object, Narrowing>();

/** What the conditions around `node` make of `path`, which it reads (see the module's comment). */
export function narrowingAt(node: AST.Node, path: ReferencePath, render: RenderContext): Narrowing {
  const known = NARROWINGS.get(node);
  if (known) return known;
  const ancestors = ancestorsOf(node, render.component);
  let present: AST.Expression | undefined;
  let unfollowed: Extract<Narrowing, { kind: "unfollowed" }> | undefined;
  let found: Narrowing | undefined;
  for (const fact of factsAround(ancestors, render.component)) {
    const effect = across(fact, effectOf(fact, path, render), path, render);
    if (effect === "absent") {
      found = { kind: "absent", condition: fact.condition };
      break;
    }
    if (effect === "present") present ??= fact.condition;
    else if (effect !== "none") {
      unfollowed ??= { kind: "unfollowed", condition: fact.condition, reason: effect };
    }
  }
  found ??= present ? { kind: "present" } : (unfollowed ?? { kind: "declared" });
  // Angular's `track` reads a prop again from its input, which its checker never narrows.
  const condition = present ?? (found.kind === "unfollowed" ? found.condition : undefined);
  if (condition && found.kind !== "absent" && inKey(ancestors) && isProp(path, render)) {
    found = { kind: "unfollowed", condition, reason: "key" };
  }
  NARROWINGS.set(node, found);
  return found;
}

/** A reference's kinds where it is read, and a narrowing of them some target does not keep. */
export interface NarrowedKinds {
  kinds: Kinds;
  /** A condition that narrows the reference to fewer kinds where some target forgets it. */
  apart?: { condition: AST.Expression; reason: Exclude<Unfollowed, "form"> };
}

/**
 * The kinds of `path`, which `node` reads, as TypeScript narrows its type by the conditions
 * around it (see the module's comment), outermost first: those every target keeps there, where
 * `narrowingAt` follows them. One that would leave fewer kinds where some target forgets it (a
 * property in a closure, a prop in a list's key) leaves them as they are, and comes back as
 * `apart`, for the uses that rely on it.
 */
export function narrowedKinds(
  node: AST.Node,
  path: ReferencePath,
  kinds: Kinds,
  render: RenderContext,
): NarrowedKinds {
  const ancestors = ancestorsOf(node, render.component);
  // Angular's `track` reads a prop again from its input, which its checker never narrows.
  const key = inKey(ancestors) && isProp(path, render);
  let result = kinds;
  let apart: NarrowedKinds["apart"];
  for (const fact of factsAround(ancestors, render.component).toReversed()) {
    const narrowed = refine(fact.condition, path, fact.holds, result, render);
    const kept = fact.boundary === "none" || keepsAcross(fact, path, render);
    if (kept && !key) result = narrowed;
    else if (!apart && changesKinds(result, narrowed)) {
      const reason = kept ? "key" : fact.boundary === "list" ? "callback" : "closure";
      apart = { condition: fact.condition, reason };
    }
  }
  return apart ? { kinds: result, apart } : { kinds: result };
}

/**
 * The kinds of the source where a condition holds (`holds`) or fails, as TypeScript narrows its
 * type there, through `!`, `&&` and `||`: `a && b` holds where both hold, and fails where `a`
 * fails or `a` holds and `b` fails; `a || b` the other way round.
 */
function refine(
  node: AST.Expression,
  source: ReferencePath,
  holds: boolean,
  kinds: Kinds,
  render: RenderContext,
): Kinds {
  const inner = withoutParentheses(node);
  if (inner.type === "UnaryExpression" && inner.operator === "!") {
    return refine(inner.argument, source, !holds, kinds, render);
  }
  if (inner.type === "LogicalExpression" && inner.operator !== "??") {
    const left = (as: boolean) => refine(inner.left, source, as, kinds, render);
    if ((inner.operator === "&&") === holds) {
      return refine(inner.right, source, holds, left(holds), render);
    }
    return union(left(holds), refine(inner.right, source, holds, left(!holds), render));
  }
  return refineOperand(inner, source, holds, kinds, render);
}

/**
 * What an operand leaves of the source's kinds where it holds or fails: the source's
 * truthiness, a discriminant read from it (through `?.` too, which holds only where the source
 * is there), `typeof` it or the source compared with a literal, and `Array.isArray(source)`.
 * Anything else leaves them as they are.
 */
function refineOperand(
  operand: AST.Expression,
  source: ReferencePath,
  holds: boolean,
  kinds: Kinds,
  render: RenderContext,
): Kinds {
  const reading = readOf(operand, source, render);
  if (reading === "source") return holds ? truthy(kinds) : falsy(kinds);
  if (reading === "optional" || reading === "member") {
    const key = ownMember(operand, source, render);
    const result =
      key === undefined
        ? kinds
        : byMember(kinds, key, (member) => (holds ? mayBeTruthy(member) : mayBeFalsy(member)));
    return reading === "optional" && holds ? without(result, "null", "undefined") : result;
  }
  if (operand.type === "BinaryExpression" && EQUALITY.has(operand.operator)) {
    return refineEquality(operand, source, holds, kinds, render);
  }
  if (operand.type === "CallExpression" && isArrayCheck(operand, source, render)) {
    return holds ? only(kinds, ["array"]) : without(kinds, "array");
  }
  return kinds;
}

/** The kinds `typeof` names, by its result. */
const TYPEOF: ReadonlyMap<string, readonly Primitive[]> = new Map([
  ["string", ["string"]],
  ["number", ["number"]],
  ["boolean", ["boolean"]],
  ["bigint", ["bigint"]],
  ["symbol", ["symbol"]],
  ["undefined", ["undefined"]],
  ["function", ["function"]],
  ["object", ["object", "array", "null"]],
]);

/** What an equality with a literal leaves of the source's kinds (see `refineOperand`). */
function refineEquality(
  node: AST.BinaryExpression | AST.PrivateInExpression,
  source: ReferencePath,
  holds: boolean,
  kinds: Kinds,
  render: RenderContext,
): Kinds {
  if (node.left.type === "PrivateIdentifier") return kinds;
  const loose = node.operator === "==" || node.operator === "!=";
  const equal = (node.operator === "===" || node.operator === "==") === holds;
  for (const [side, other] of [
    [node.left, node.right],
    [node.right, node.left],
  ] as const) {
    const value = literalOf(other, render);
    if (value === NOT_LITERAL) continue;
    const inner = withoutParentheses(side);
    if (inner.type === "UnaryExpression" && inner.operator === "typeof") {
      if (readOf(withoutParentheses(inner.argument), source, render) !== "source") continue;
      const named = typeof value === "string" ? TYPEOF.get(value) : undefined;
      if (!named) return kinds;
      return equal ? only(kinds, named) : without(kinds, ...named);
    }
    const reading = readOf(inner, source, render);
    if (reading === "source") return byValue(kinds, value, loose, equal);
    if (reading !== "optional" && reading !== "member") continue;
    const key = ownMember(inner, source, render);
    const result =
      key === undefined
        ? kinds
        : byMember(kinds, key, (member) =>
            equal ? mayEqual(member, value, loose) : !onlyEqual(member, value, loose),
          );
    // `source?.key` is `undefined` where the source is absent.
    const present = equal
      ? value !== null && value !== undefined
      : value === undefined || (loose && value === null);
    return reading === "optional" && present ? without(result, "null", "undefined") : result;
  }
  return kinds;
}

/** The kinds without those outside `kept` (`unknown`, which may be any, stays). */
function only(kinds: Kinds, kept: readonly Primitive[]): Kinds {
  const others = [...kinds.primitives].filter(
    (primitive) => primitive !== "unknown" && !kept.includes(primitive),
  );
  return others.length ? without(kinds, ...others) : kinds;
}

/** What the source's kinds keep where it equals a literal (`==` when `loose`), or does not. */
function byValue(kinds: Kinds, value: Literal, loose: boolean, equal: boolean): Kinds {
  if (value === null || value === undefined) {
    const nullish: Primitive[] = loose
      ? ["null", "undefined"]
      : [value === null ? "null" : "undefined"];
    return equal ? only(kinds, nullish) : without(kinds, ...nullish);
  }
  // `==` converts a value of another kind, which the compiler does not follow.
  if (loose) return kinds;
  if (equal) {
    const known = without(kinds, "unknown");
    const literal = mayEqual(known, value, false) ? literalKinds(value) : NOTHING;
    return has(kinds, "unknown") ? union(literal, UNKNOWN) : literal;
  }
  return withoutLiteral(kinds, value);
}

function literalKinds(value: string | number | boolean): Kinds {
  if (typeof value === "string") return stringLiteral(value);
  return typeof value === "number" ? numberLiteral(value) : booleanLiteral(value);
}

/** The kinds without one literal value, where they list the values of its kind. */
function withoutLiteral(kinds: Kinds, value: string | number | boolean): Kinds {
  if (typeof value === "boolean") {
    return keepLiterals(kinds, "boolean", (item) => item !== value, [true, false]);
  }
  return typeof value === "string"
    ? keepLiterals(kinds, "string", (item) => item !== value)
    : keepLiterals(kinds, "number", (item) => item !== value);
}

/** The kinds a truthy value of these kinds has: no nullish kind, `""`, `0` or `false`. */
function truthy(kinds: Kinds): Kinds {
  let result = without(kinds, "null", "undefined");
  result = keepLiterals(result, "string", (value) => value !== "");
  result = keepLiterals(result, "number", (value) => value !== 0);
  return keepLiterals(result, "boolean", (value) => value, [true, false]);
}

/** The kinds a falsy value of these kinds has: no object, array, function or symbol. */
function falsy(kinds: Kinds): Kinds {
  let result = without(kinds, "object", "array", "function", "symbol");
  result = keepLiterals(result, "string", (value) => value === "");
  result = keepLiterals(result, "number", (value) => value === 0);
  return keepLiterals(result, "boolean", (value) => !value, [true, false]);
}

/**
 * The kinds with only the literals of a primitive that `keep` keeps, where they are listed (or
 * every literal of it is in `all`, as `boolean` is `true` or `false`); without the primitive
 * when none is left.
 */
function keepLiterals<T extends string | number | boolean>(
  kinds: Kinds,
  primitive: "string" | "number" | "boolean",
  keep: (value: T) => boolean,
  all?: readonly T[],
): Kinds {
  if (!has(kinds, primitive)) return kinds;
  const field =
    primitive === "string" ? "strings" : primitive === "number" ? "numbers" : "booleans";
  const listed = (kinds[field] as ReadonlySet<T> | undefined) ?? (all && new Set(all));
  if (!listed) return kinds;
  const kept = new Set([...listed].filter(keep));
  if (!kept.size) return without(kinds, primitive);
  if (kept.size === listed.size && kinds[field]) return kinds;
  return { ...kinds, [field]: kept };
}

/**
 * The key of a member that `node` reads right off the source (`source.kind`, `source?.kind`),
 * or `undefined`.
 */
function ownMember(
  node: AST.Expression,
  source: ReferencePath,
  render: RenderContext,
): string | undefined {
  const path = referencePath(node, render);
  if (!path || path.names.length !== source.names.length + 1) return undefined;
  return path.names.at(-1);
}

/**
 * The source's kinds with only the shapes of its union whose member `key` can pass a test, when
 * that member is a discriminant (`isDiscriminant`); a shape without it stays.
 */
function byMember(kinds: Kinds, key: string, passes: (member: Kinds) => boolean): Kinds {
  const shapes = kinds.objects;
  if (!shapes || shapes.length < 2 || !isDiscriminant(shapes, key)) return kinds;
  const kept = shapes.filter((shape) => {
    const member = shape.members().get(key);
    return !member || passes(kindsOfMember(member));
  });
  if (kept.length === shapes.length) return kinds;
  return kept.length ? { ...kinds, objects: kept } : without(kinds, "object");
}

function kindsOfMember(member: Member): Kinds {
  return member.optional ? union(member.kinds(), UNDEFINED) : member.kinds();
}

/**
 * Whether TypeScript narrows a union of object types by a member: one whose type is a literal
 * one (a union of literals, `boolean`, `null` or `undefined`) in some of the shapes.
 */
function isDiscriminant(shapes: readonly ObjectShape[], key: string): boolean {
  return shapes.some((shape) => {
    const member = shape.members().get(key);
    if (!member) return false;
    const kinds = kindsOfMember(member);
    return (
      kinds.primitives.size > 0 &&
      [...kinds.primitives].every(
        (primitive) =>
          primitive === "null" ||
          primitive === "undefined" ||
          primitive === "boolean" ||
          (primitive === "string" && kinds.strings !== undefined) ||
          (primitive === "number" && kinds.numbers !== undefined),
      )
    );
  });
}

/**
 * Whether a narrowing leaves fewer kinds of value that are there (primitives or shapes): what it
 * says of `null` and `undefined` alone, and a value it shows absent, are `narrowingAt`'s.
 */
function changesKinds(before: Kinds, after: Kinds): boolean {
  const left = presentKinds(after);
  if (!left.length) return false;
  if (presentKinds(before).length !== left.length) return true;
  return (before.objects?.length ?? 0) !== (after.objects?.length ?? 0);
}

/** The primitives of a value that is there: neither `null` nor `undefined`. */
function presentKinds(kinds: Kinds): Primitive[] {
  return [...kinds.primitives].filter(
    (primitive) => primitive !== "null" && primitive !== "undefined",
  );
}

type Effect = "present" | "absent" | "none" | Unfollowed;

/**
 * What a test says of the reference where it holds or fails: present, absent, nothing, not
 * followed (`unknown`), or the nullish kinds comparisons take out (`count !== undefined`), which
 * make it present when its declared kinds hold no other, with whether a test the compiler does
 * not follow comes with them.
 */
type TestEffect = "present" | "absent" | "none" | "unknown" | Removed;

/** The nullish kinds comparisons take out, and whether a test not followed comes with them. */
interface Removed {
  readonly removed: readonly Nullish[];
  readonly unknown: boolean;
}

type Nullish = "null" | "undefined";

/** What a fact says of the reference where the condition sits. */
function effectOf(
  fact: Fact,
  source: ReferencePath,
  render: RenderContext,
  rootOnly = false,
): Effect {
  const effect = testEffect(fact.condition, source, fact.holds, render, rootOnly);
  if (typeof effect !== "string") {
    if (presentWithout(source, effect.removed, render)) return "present";
    return effect.unknown ? "form" : "none";
  }
  return effect === "unknown" ? "form" : effect;
}

/**
 * What a condition says of the source where it holds (`holds`) or fails, through `!`, `&&` and
 * `||` as TypeScript reads them: `a && b` holds where both hold, and fails where `a` fails or
 * `a` holds and `b` fails; `a || b` the other way round.
 */
function testEffect(
  node: AST.Expression,
  source: ReferencePath,
  holds: boolean,
  render: RenderContext,
  rootOnly: boolean,
): TestEffect {
  const inner = withoutParentheses(node);
  if (inner.type === "UnaryExpression" && inner.operator === "!") {
    return testEffect(inner.argument, source, !holds, render, rootOnly);
  }
  if (inner.type === "LogicalExpression" && inner.operator !== "??") {
    const left = testEffect(inner.left, source, holds, render, rootOnly);
    const right = testEffect(inner.right, source, holds, render, rootOnly);
    // `a && b` that holds and `a || b` that fails: both are as `holds` says.
    if ((inner.operator === "&&") === holds) return both(left, right);
    // Otherwise the left side is as `holds` says, or it is the other way and the right side is.
    const other = testEffect(inner.left, source, !holds, render, rootOnly);
    return either(left, both(other, right));
  }
  // A discriminant of the reference's root is all that narrows it as a parameter.
  if (rootOnly) return discriminant(inner, source, holds, render, true) ?? "none";
  return operandEffect(inner, source, holds, render);
}

/** The nullish kinds and the unknown a test says, as one shape. */
function removedOf(effect: TestEffect): Removed | undefined {
  if (typeof effect !== "string") return effect;
  return effect === "unknown" ? { removed: [], unknown: true } : undefined;
}

/** Two tests that both hold where the reference is read. */
function both(a: TestEffect, b: TestEffect): TestEffect {
  if (a === "absent" || b === "absent") return "absent";
  if (a === "present" || b === "present") return "present";
  const left = removedOf(a);
  const right = removedOf(b);
  if (!left && !right) return "none";
  const removed = [...(left?.removed ?? []), ...(right?.removed ?? [])];
  const unknown = Boolean(left?.unknown || right?.unknown);
  return removed.length ? { removed, unknown } : unknown ? "unknown" : "none";
}

/**
 * Either of two tests where the reference is read: what both say. Present only where both are;
 * nothing where either leaves it as declared or absent alone.
 */
function either(a: TestEffect, b: TestEffect): TestEffect {
  if (a === "absent" && b === "absent") return "absent";
  if (a === "present" && b === "present") return "present";
  if (a === "present") return removedOf(b) ? b : "none";
  if (b === "present") return removedOf(a) ? a : "none";
  const left = removedOf(a);
  const right = removedOf(b);
  if (!left || !right) return "none";
  const removed = left.removed.filter((kind) => right.removed.includes(kind));
  const unknown = left.unknown || right.unknown;
  return removed.length ? { removed, unknown } : unknown ? "unknown" : "none";
}

/**
 * A fact's effect where a function lies between its condition and the read: TypeScript keeps a
 * parameter's narrowing in a closure and forgets a property's (see the module's comment).
 */
function across(fact: Fact, effect: Effect, path: ReferencePath, render: RenderContext): Effect {
  if (fact.boundary === "none" || effect === "none") return effect;
  if (keepsAcross(fact, path, render)) return effect;
  // A member narrowed by a discriminant of its root narrows that root, which may be one.
  if (path.names.length && keepsAcross(fact, { root: path.root, names: [] }, render)) {
    const root = effectOf(fact, path, render, true);
    if (root === "present") return root;
  }
  // The template targets' loops keep a narrowing, and Solid's keyed callbacks: what shows the
  // reference absent stays so there; their arrow functions forget a property's.
  if (effect === "absent") return fact.boundary === "list" ? "absent" : "none";
  if (effect === "present") return fact.boundary === "list" ? "callback" : "closure";
  // A test the compiler does not follow: the template targets' loops keep it, and Solid copies
  // an expression's conditional, a prop's included, with `props.x`.
  if (fact.boundary === "list") return effect;
  return isProp(path, render) && path.names.length === 0 ? "closure" : "none";
}

/**
 * Whether a reference keeps a fact's narrowing in a closure on every target: a list's item and
 * an arrow function's parameter are parameters in every output, and so is a destructured prop in
 * a conditional child's branch (Solid's keyed callback receives it; the other targets read the
 * source's own local).
 */
function keepsAcross(fact: Fact, path: ReferencePath, render: RenderContext): boolean {
  return (
    path.names.length === 0 &&
    path.root !== render.propsObject?.declaration &&
    (fact.child || !render.propsByDeclaration.has(path.root))
  );
}

/** Whether a reference is a prop's, destructured or read through the object form. */
function isProp(path: ReferencePath, render: RenderContext): boolean {
  return path.root === render.propsObject?.declaration || render.propsByDeclaration.has(path.root);
}

/** Whether a node lies in a list's key, which Angular writes as its `@for`'s `track`. */
function inKey(ancestors: readonly AST.Node[]): boolean {
  return ancestors.some(
    (node) =>
      node.type === "JSXAttribute" &&
      node.name.type === "JSXIdentifier" &&
      node.name.name.toLowerCase() === "key",
  );
}

/** The operands of a condition, through parentheses. */
function withoutParentheses(node: AST.Expression): AST.Expression {
  let inner = node;
  while (inner.type === "ParenthesizedExpression") inner = inner.expression;
  return inner;
}

/** A member's static key: `a.b`, `a["b"]`, `a[0]`. */
function memberName(node: AST.MemberExpression): string | undefined {
  const { property } = node;
  if (!node.computed) return property.type === "Identifier" ? property.name : undefined;
  return property.type === "Literal" &&
    (typeof property.value === "string" || typeof property.value === "number")
    ? String(property.value)
    : undefined;
}

function unwrap(node: AST.Expression): AST.Expression {
  let inner = node;
  while (inner.type === "ParenthesizedExpression" || inner.type === "ChainExpression") {
    inner = inner.expression;
  }
  return inner;
}

function samePath(a: ReferencePath, b: ReferencePath): boolean {
  return (
    a.root === b.root &&
    a.names.length === b.names.length &&
    a.names.every((name, index) => name === b.names[index])
  );
}

/** A condition that holds, or fails, where the reference is read. */
interface Fact {
  condition: AST.Expression;
  holds: boolean;
  /**
   * The functions between the condition and the read: none, a list's callback (which renders
   * JSX), or an arrow function in an expression, the outermost kind that lies there.
   */
  boundary: "none" | "list" | "expression";
  /**
   * Whether the condition is a conditional child's, which the analyser lowers to an If, rather
   * than one inside an expression, which every target copies (Solid with `props.x`).
   */
  child: boolean;
}

/**
 * The conditions around a node, from its ancestors in the component, innermost first: the test
 * of each `?:` whose branch holds it, and the left side of each `&&` (which holds), `||` or `??`
 * (which fail) whose right side does.
 */
function factsAround(ancestors: readonly AST.Node[], component: AST.Node): Fact[] {
  const facts: Fact[] = [];
  let boundary: Fact["boundary"] = "none";
  for (let index = ancestors.length - 2; index >= 0; index--) {
    const parent = ancestors[index]!;
    const child = ancestors[index + 1];
    if (parent === component) break;
    if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionExpression") {
      // JSX in a function is a list's element: anywhere else it is reported (UF3012).
      if (!containsJsx(parent.body)) boundary = "expression";
      else if (boundary === "none") boundary = "list";
    } else if (parent.type === "ConditionalExpression" && child !== parent.test) {
      const holds = child === parent.consequent;
      facts.push({ condition: parent.test, holds, boundary, child: isIf(ancestors, index) });
    } else if (parent.type === "LogicalExpression" && child === parent.right) {
      const holds = parent.operator === "&&";
      const conditional = holds && isIf(ancestors, index);
      facts.push({ condition: parent.left, holds, boundary, child: conditional });
    }
  }
  return facts;
}

/**
 * Whether the conditional at `ancestors[index]` is a child the analyser lowers to an If
 * (ADR-0036): any `&&`, and a `?:` that holds JSX, in a child's place.
 */
function isIf(ancestors: readonly AST.Node[], index: number): boolean {
  const node = ancestors[index]!;
  const lowered =
    node.type === "LogicalExpression"
      ? node.operator === "&&"
      : node.type === "ConditionalExpression" &&
        (containsJsx(node.consequent) || containsJsx(node.alternate));
  return lowered && isChild(ancestors, index);
}

/** Whether the node at `ancestors[index]` is in a child's place: a child, or a branch of one. */
function isChild(ancestors: readonly AST.Node[], index: number): boolean {
  const node = ancestors[index]!;
  const parent = ancestors[index - 1];
  if (!parent) return false;
  if (parent.type === "JSXExpressionContainer") {
    const holder = ancestors[index - 2];
    return holder?.type === "JSXElement" || holder?.type === "JSXFragment";
  }
  if (parent.type === "ReturnStatement") return true;
  if (parent.type === "ConditionalExpression" && parent.test !== node) {
    return isIf(ancestors, index - 1);
  }
  if (parent.type === "LogicalExpression" && parent.right === node) {
    return isIf(ancestors, index - 1);
  }
  return false;
}

/** Whether a node holds JSX anywhere in it. */
function containsJsx(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(containsJsx);
  if (!isNode(node)) return false;
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true;
  return childrenOf(node).some(containsJsx);
}

/** The nodes from `root` down to `target`, both included: none when `target` is not in it. */
function ancestorsOf(target: AST.Node, root: AST.Node): AST.Node[] {
  const path: AST.Node[] = [];
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!isNode(value) || value.start > target.start || value.end < target.end) return false;
    path.push(value);
    if (value === target || childrenOf(value).some(visit)) return true;
    path.pop();
    return false;
  };
  visit(root);
  return path;
}

/** A node's children, by oxc's visitor keys: nodes, arrays of them, or nothing. */
function childrenOf(node: AST.Node): unknown[] {
  const fields = node as unknown as Record<string, unknown>;
  return (visitorKeys[node.type] ?? []).map((key) => fields[key]);
}

function isNode(value: unknown): value is AST.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string" &&
    typeof (value as { start?: unknown }).start === "number"
  );
}

/**
 * What an operand says of the source where it holds (`holds`) or fails: the source itself is
 * there where it holds and nullish where it fails; a member through `?.`, the comparisons
 * TypeScript narrows by and a discriminant are followed; a member through `.` says nothing new;
 * any other mention is not followed.
 */
function operandEffect(
  operand: AST.Expression,
  source: ReferencePath,
  holds: boolean,
  render: RenderContext,
): TestEffect {
  const reading = readOf(operand, source, render);
  // A falsy string, number or boolean is no nullish one: only a value that is falsy when it
  // is nullish alone (an object, an array) is absent where it fails.
  if (reading === "source")
    return holds ? "present" : falsyOnlyNullish(source, render) ? "absent" : "none";
  if (reading === "optional") return holds ? "present" : "none";
  // A member read through `.` says the source is there already, and may discriminate it.
  if (reading === "member") return discriminant(operand, source, holds, render) ?? "none";
  if (operand.type === "BinaryExpression" && EQUALITY.has(operand.operator)) {
    const compared = comparison(operand, source, holds, render);
    if (compared) return compared;
    // TypeScript narrows by an equality with a value of another type, which the compiler does
    // not follow; it narrows by nothing else that mentions the reference (a relational
    // comparison, arithmetic, `??`, a call's argument).
    if (comparesSource(operand, source, render)) return "unknown";
  }
  if (operand.type === "CallExpression" && isArrayCheck(operand, source, render)) {
    return holds ? "present" : "none";
  }
  return discriminant(operand, source, holds, render) ?? "none";
}

/** Whether an equality compares the source, a member of it through `?.`, or `typeof` it. */
function comparesSource(
  node: AST.BinaryExpression | AST.PrivateInExpression,
  source: ReferencePath,
  render: RenderContext,
): boolean {
  if (node.left.type === "PrivateIdentifier") return false;
  return [node.left, node.right].some((side) => {
    const inner = withoutParentheses(side);
    const read =
      inner.type === "UnaryExpression" && inner.operator === "typeof"
        ? withoutParentheses(inner.argument)
        : inner;
    const reading = readOf(read, source, render);
    return reading === "source" || reading === "optional";
  });
}

/** Whether a reference is falsy only where it is nullish: its declared kinds hold no other. */
function falsyOnlyNullish(source: ReferencePath, render: RenderContext): boolean {
  const kinds = declaredKinds(source, render);
  if (!kinds) return false;
  return !mayBeFalsy(without(kinds, "null", "undefined"));
}

const EQUALITY = new Set(["===", "!==", "==", "!="]);
/**
 * How an expression reads the source: as itself, as the object of a member through `?.` right
 * after it (there only if the source is), through `.` (the source is there already), or not.
 */
function readOf(
  node: AST.Expression,
  source: ReferencePath,
  render: RenderContext,
): "source" | "optional" | "member" | undefined {
  const own = referencePath(node, render);
  if (!own || own.root !== source.root) return undefined;
  if (samePath(own, source)) return "source";
  if (own.names.length <= source.names.length) return undefined;
  let inner = unwrap(node);
  while (inner.type === "MemberExpression") {
    const object = unwrap(inner.object);
    const path = referencePath(object, render);
    if (path && samePath(path, source)) return inner.optional ? "optional" : "member";
    inner = object;
  }
  return undefined;
}

/**
 * What an equality says of the source where the operand holds or fails, when it compares the
 * source, a member of it, or `typeof` it with a literal; `undefined` for any other comparison.
 */
function comparison(
  node: AST.BinaryExpression | AST.PrivateInExpression,
  source: ReferencePath,
  holds: boolean,
  render: RenderContext,
): TestEffect | undefined {
  if (node.left.type === "PrivateIdentifier") return undefined;
  const { left, right } = node;
  const loose = node.operator === "==" || node.operator === "!=";
  // Whether the two sides are equal where the operand is as `holds` says.
  const equal = (node.operator === "===" || node.operator === "==") === holds;
  for (const [side, other] of [
    [left, right],
    [right, left],
  ] as const) {
    const value = literalOf(other, render);
    if (value === NOT_LITERAL) continue;
    const inner = withoutParentheses(side);
    if (inner.type === "UnaryExpression" && inner.operator === "typeof") {
      if (readOf(withoutParentheses(inner.argument), source, render) !== "source") continue;
      if (typeof value !== "string") return "none";
      if (value === "undefined") return equal ? "absent" : removing("undefined");
      if (!equal) return "none";
      return value === "object" ? removing("undefined") : "present";
    }
    const reading = readOf(inner, source, render);
    if (reading === "source") {
      if (value === null || value === undefined) {
        if (equal) return "absent";
        return loose
          ? removing("null", "undefined")
          : removing(value === null ? "null" : "undefined");
      }
      return equal ? "present" : "none";
    }
    if (reading === "optional") {
      // `source?.key` is `undefined` where the source is nullish.
      if (value === null || value === undefined) {
        return !equal && (loose || value === undefined) ? "present" : "none";
      }
      return equal ? "present" : "none";
    }
    // A member through `.` is left to `discriminant`.
    if (reading === "member") return undefined;
  }
  return undefined;
}

/** A comparison that takes nullish kinds out. */
function removing(...removed: Nullish[]): Removed {
  return { removed, unknown: false };
}

const NOT_LITERAL = Symbol("not a literal");

/** The value of a literal (`null`, `undefined` as the global, a string, a number, a boolean). */
function literalOf(
  node: AST.Expression,
  render: RenderContext,
): string | number | boolean | null | undefined | typeof NOT_LITERAL {
  const inner = withoutParentheses(node);
  if (inner.type === "Literal") {
    const { value } = inner;
    return value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? value
      : NOT_LITERAL;
  }
  if (inner.type === "Identifier" && inner.name === "undefined") {
    return render.scopes.resolve(inner).kind === "parameter" ? NOT_LITERAL : undefined;
  }
  return NOT_LITERAL;
}

/** Whether a call is `Array.isArray(source)`: an array is never nullish. */
function isArrayCheck(
  node: AST.CallExpression,
  source: ReferencePath,
  render: RenderContext,
): boolean {
  const { callee } = node;
  const [argument] = node.arguments;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Array" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "isArray" &&
    node.arguments.length === 1 &&
    argument !== undefined &&
    argument.type !== "SpreadElement" &&
    readOf(withoutParentheses(argument), source, render) === "source"
  );
}

/**
 * Whether the source is never nullish without the nullish kinds comparisons took out: only
 * when its declared kinds hold no other (`count !== undefined` leaves a `null`), and are known.
 */
function presentWithout(
  source: ReferencePath,
  removed: readonly Nullish[],
  render: RenderContext,
): boolean {
  const kinds = declaredKinds(source, render);
  if (!kinds) return false;
  const left = without(kinds, ...removed);
  return !has(left, "null") && !has(left, "undefined") && !has(left, "unknown");
}

/**
 * What a test of a sibling of the source says of it: TypeScript narrows a union of object types
 * by a member of literal types (`plan.kind === "paid"`, a truthy `result.ok`), so the source,
 * read from a member of that union (`plan.renews`), takes its kinds from the shapes that
 * remain. `undefined` when the operand tests no such member, or the union stays whole.
 */
function discriminant(
  operand: AST.Expression,
  source: ReferencePath,
  holds: boolean,
  render: RenderContext,
  rootOnly = false,
): TestEffect | undefined {
  let tested: AST.Expression = operand;
  // Whether a member's kinds can pass the test.
  let passes = (kinds: Kinds) => (holds ? mayBeTruthy(kinds) : mayBeFalsy(kinds));
  let nullishSafe = holds;
  if (operand.type === "BinaryExpression" && EQUALITY.has(operand.operator)) {
    const sides = [
      [operand.left, operand.right],
      [operand.right, operand.left],
    ] as const;
    const pair = sides.find(
      ([, other]) => literalOf(other as AST.Expression, render) !== NOT_LITERAL,
    );
    if (!pair || pair[0].type === "PrivateIdentifier") return undefined;
    const value = literalOf(pair[1] as AST.Expression, render) as Literal;
    const loose = operand.operator === "==" || operand.operator === "!=";
    const equal = (operand.operator === "===" || operand.operator === "==") === holds;
    tested = withoutParentheses(pair[0]);
    passes = (kinds) => (equal ? mayEqual(kinds, value, loose) : !onlyEqual(kinds, value, loose));
    nullishSafe = equal && value !== null && value !== undefined;
  }
  const path = referencePath(tested, render);
  if (!path || path.root !== source.root || !path.names.length) return undefined;
  const prefix = path.names.slice(0, -1);
  const key = path.names.at(-1)!;
  if (rootOnly && prefix.length) return undefined;
  // The union itself (`plan` of `plan.kind`), or a member of it the test does not read.
  const own = prefix.length === source.names.length;
  if (
    prefix.length > source.names.length ||
    prefix.some((name, index) => source.names[index] !== name) ||
    (!own && source.names[prefix.length] === key)
  ) {
    return undefined;
  }
  const parent = declaredKinds({ root: source.root, names: prefix }, render);
  const shapes = parent?.objects;
  if (!parent || !shapes || shapes.length < 2 || !isDiscriminant(shapes, key)) return undefined;
  // A test that may hold where the parent is absent says nothing of its members.
  if (!nullishSafe && (has(parent, "null") || has(parent, "undefined"))) return undefined;
  const kept = shapes.filter((shape) => {
    const member = shape.members().get(key);
    if (!member) return true;
    return passes(member.optional ? union(member.kinds(), UNDEFINED) : member.kinds());
  });
  if (kept.length === shapes.length) return undefined;
  // The union narrowed to the shapes that remain: never nullish, and narrowed for closures.
  if (own) return "present";
  let kinds: Kinds = { primitives: new Set(["object"]), objects: kept };
  for (const name of source.names.slice(prefix.length)) kinds = memberOf(kinds, name);
  const nullish = has(kinds, "null") || has(kinds, "undefined") || has(kinds, "unknown");
  return nullish ? "none" : "present";
}

type Literal = string | number | boolean | null | undefined;

/** Whether a value of these kinds may equal a literal (`==` when `loose`). */
function mayEqual(kinds: Kinds, value: Literal, loose: boolean): boolean {
  if (has(kinds, "unknown")) return true;
  if (value === null || value === undefined) {
    return (
      has(kinds, value === null ? "null" : "undefined") ||
      (loose && (has(kinds, "null") || has(kinds, "undefined")))
    );
  }
  if (typeof value === "string")
    return has(kinds, "string") && (!kinds.strings || kinds.strings.has(value));
  if (typeof value === "number")
    return has(kinds, "number") && (!kinds.numbers || kinds.numbers.has(value));
  return has(kinds, "boolean") && (!kinds.booleans || kinds.booleans.has(value));
}

/** Whether every value of these kinds equals a literal (`==` when `loose`). */
function onlyEqual(kinds: Kinds, value: Literal, loose: boolean): boolean {
  const primitives = [...kinds.primitives];
  if (value === null || value === undefined) {
    const nullish = loose ? ["null", "undefined"] : [value === null ? "null" : "undefined"];
    return primitives.length > 0 && primitives.every((primitive) => nullish.includes(primitive));
  }
  if (primitives.length !== 1) return false;
  const literals =
    typeof value === "string"
      ? kinds.strings
      : typeof value === "number"
        ? kinds.numbers
        : kinds.booleans;
  return primitives[0] === typeof value && literals?.size === 1 && literals.has(value as never);
}

/** Whether a value of these kinds may be truthy. */
function mayBeTruthy(kinds: Kinds): boolean {
  return [...kinds.primitives].some((primitive) => {
    if (primitive === "null" || primitive === "undefined") return false;
    if (primitive === "string")
      return !kinds.strings || [...kinds.strings].some((value) => value !== "");
    if (primitive === "number")
      return !kinds.numbers || [...kinds.numbers].some((value) => value !== 0);
    if (primitive === "boolean") return !kinds.booleans || kinds.booleans.has(true);
    return true;
  });
}

/** Whether a value of these kinds may be falsy. */
function mayBeFalsy(kinds: Kinds): boolean {
  return [...kinds.primitives].some((primitive) => {
    if (primitive === "string") return !kinds.strings || kinds.strings.has("");
    if (primitive === "number") return !kinds.numbers || kinds.numbers.has(0);
    if (primitive === "boolean") return !kinds.booleans || kinds.booleans.has(false);
    return (
      primitive === "null" ||
      primitive === "undefined" ||
      primitive === "bigint" ||
      primitive === "unknown"
    );
  });
}

/** A reference's kinds as its props or its list declare them, or `undefined` when unknown. */
function declaredKinds(path: ReferencePath, render: RenderContext): Kinds | undefined {
  let names = path.names;
  let kinds: Kinds | undefined;
  if (path.root === render.propsObject?.declaration) {
    kinds = names[0] === undefined ? undefined : render.props.get(names[0])?.kinds;
    names = names.slice(1);
  } else {
    kinds =
      render.propsByDeclaration.get(path.root)?.kinds ?? render.loopVariables.get(path.root)?.kinds;
  }
  for (const name of names) kinds = kinds && memberOf(kinds, name);
  return kinds;
}
