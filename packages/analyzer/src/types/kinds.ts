// The value-kind model (ADR-0035, design §1.6): what kinds of value an expression can have, read
// syntactically from the props' types and the expression itself. It exists for the checks that
// depend on a value's kind (UF3016, UF3018, UF3023, spreads), never reaches the IR, and stays
// approximate until M5's type oracle: what it cannot type is `unknown`, which every check
// accepts.

import type { Span } from "@unframework/ir";

/** A kind of JavaScript value, with arrays and functions apart from other objects. */
export type Primitive =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "undefined"
  | "bigint"
  | "symbol"
  | "object"
  | "array"
  | "function"
  | "unknown";

/** A member of an object kind: declared by a type, or written in an object literal. */
export interface Member {
  /** The member's kinds, read lazily: types may refer to themselves. */
  readonly kinds: () => Kinds;
  /** Whether the member may be absent (`label?: string`), which adds `undefined`. */
  readonly optional: boolean;
  /** Where its key is written: a spread's keys point at their members. */
  readonly key: Span;
}

/** An object kind: its members, in member order. */
export interface ObjectShape {
  readonly members: () => ReadonlyMap<string, Member>;
  /** Whether a type declares it (a prop's or an item's type), so its keys are known. */
  readonly declared: boolean;
}

/**
 * A set of kinds. Literal values are kept for a primitive when every value of it is a literal
 * (`"sm" | "md"`), as are the shapes of objects and the elements of arrays.
 */
export interface Kinds {
  readonly primitives: ReadonlySet<Primitive>;
  readonly strings?: ReadonlySet<string>;
  readonly numbers?: ReadonlySet<number>;
  readonly booleans?: ReadonlySet<boolean>;
  readonly objects?: readonly ObjectShape[];
  readonly elements?: readonly (() => Kinds)[];
}

/** Kinds of the given primitives, without literals. */
export function kinds(...primitives: Primitive[]): Kinds {
  return { primitives: new Set(primitives) };
}

export const UNKNOWN: Kinds = kinds("unknown");
export const STRING: Kinds = kinds("string");
export const NUMBER: Kinds = kinds("number");
export const BOOLEAN: Kinds = kinds("boolean");
export const NULL: Kinds = kinds("null");
export const UNDEFINED: Kinds = kinds("undefined");
export const FUNCTION: Kinds = kinds("function");
export const NOTHING: Kinds = kinds();

/** A string literal's kinds. */
export function stringLiteral(value: string): Kinds {
  return { primitives: new Set(["string"]), strings: new Set([value]) };
}

/** A number literal's kinds. */
export function numberLiteral(value: number): Kinds {
  return { primitives: new Set(["number"]), numbers: new Set([value]) };
}

/** A boolean literal's kinds. */
export function booleanLiteral(value: boolean): Kinds {
  return { primitives: new Set(["boolean"]), booleans: new Set([value]) };
}

/** An array whose elements have the given kinds. */
export function arrayOf(element: () => Kinds): Kinds {
  return { primitives: new Set(["array"]), elements: [element] };
}

/** An object of the given shape. */
export function objectOf(shape: ObjectShape): Kinds {
  return { primitives: new Set(["object"]), objects: [shape] };
}

/** The kinds any of the given kinds may have. */
export function union(...all: Kinds[]): Kinds {
  const primitives = new Set<Primitive>();
  for (const item of all) for (const primitive of item.primitives) primitives.add(primitive);
  const result: {
    primitives: Set<Primitive>;
    strings?: Set<string>;
    numbers?: Set<number>;
    booleans?: Set<boolean>;
    objects?: ObjectShape[];
    elements?: (() => Kinds)[];
  } = { primitives };
  const literals = <T>(primitive: Primitive, pick: (item: Kinds) => ReadonlySet<T> | undefined) => {
    if (!primitives.has(primitive)) return undefined;
    const values = new Set<T>();
    for (const item of all) {
      if (!item.primitives.has(primitive)) continue;
      const own = pick(item);
      if (!own) return undefined;
      for (const value of own) values.add(value);
    }
    return values;
  };
  const strings = literals("string", (item) => item.strings);
  const numbers = literals("number", (item) => item.numbers);
  const booleans = literals("boolean", (item) => item.booleans);
  if (strings) result.strings = strings;
  if (numbers) result.numbers = numbers;
  if (booleans) result.booleans = booleans;
  // A shape or an element that two of them share is one.
  const objects = [...new Set(all.flatMap((item) => item.objects ?? []))];
  const elements = [...new Set(all.flatMap((item) => item.elements ?? []))];
  if (objects.length) result.objects = objects;
  if (elements.length) result.elements = elements;
  return result;
}

/** The kinds without the given primitives (and their literals, shapes or elements). */
export function without(value: Kinds, ...removed: Primitive[]): Kinds {
  const primitives = new Set([...value.primitives].filter((item) => !removed.includes(item)));
  return {
    primitives,
    ...(primitives.has("string") && value.strings ? { strings: value.strings } : {}),
    ...(primitives.has("number") && value.numbers ? { numbers: value.numbers } : {}),
    ...(primitives.has("boolean") && value.booleans ? { booleans: value.booleans } : {}),
    ...(primitives.has("object") && value.objects ? { objects: value.objects } : {}),
    ...(primitives.has("array") && value.elements ? { elements: value.elements } : {}),
  };
}

/** Whether the value may have the kind. */
export function has(value: Kinds, primitive: Primitive): boolean {
  return value.primitives.has(primitive);
}

/** Whether the value may be `null` or `undefined`, or is of a kind the model cannot tell. */
export function mayBeNullish(value: Kinds): boolean {
  return has(value, "null") || has(value, "undefined") || has(value, "unknown");
}

/**
 * The primitives of a value that lie outside `allowed`: none when it fits. `unknown` is always
 * allowed: the model trusts what it cannot type (ADR-0035).
 */
export function outside(value: Kinds, allowed: readonly Primitive[]): Primitive[] {
  return [...value.primitives].filter(
    (primitive) => primitive !== "unknown" && !allowed.includes(primitive),
  );
}

/** The kinds of an array's elements; `unknown` for anything else that may be iterated. */
export function elementsOf(value: Kinds): Kinds {
  const elements = (value.elements ?? []).map((element) => element());
  if (has(value, "unknown") || (has(value, "array") && !elements.length)) {
    elements.push(UNKNOWN);
  }
  return elements.length ? union(...elements) : UNKNOWN;
}

/**
 * The kinds of a member read from a value (`value.name`): through its object shapes, with
 * `undefined` for an optional member; `length` of a string or an array. A value the model
 * cannot type, or a member it does not know, gives `unknown`.
 */
export function memberOf(value: Kinds, name: string): Kinds {
  const found: Kinds[] = [];
  let unknown = has(value, "unknown") || has(value, "function") || has(value, "symbol");
  if (name === "length" && (has(value, "string") || has(value, "array"))) found.push(NUMBER);
  else if (has(value, "string") || has(value, "array") || has(value, "number")) unknown = true;
  for (const shape of value.objects ?? []) {
    const member = shape.members().get(name);
    if (!member) {
      unknown = true;
      continue;
    }
    found.push(member.optional ? union(member.kinds(), UNDEFINED) : member.kinds());
  }
  if (has(value, "object") && !value.objects?.length) unknown = true;
  if (unknown) found.push(UNKNOWN);
  return found.length ? union(...found) : UNKNOWN;
}

/** The one object shape a declared type gives a value, if it has exactly one. */
export function declaredShapeOf(value: Kinds): ObjectShape | undefined {
  const shapes = value.objects ?? [];
  const others = outside(value, ["object", "null", "undefined"]);
  if (has(value, "unknown") || others.length || shapes.length !== 1) return undefined;
  return shapes[0]!.declared ? shapes[0] : undefined;
}

const NAMES: Readonly<Record<Primitive, string>> = {
  string: "a string",
  number: "a number",
  boolean: "a boolean",
  null: "`null`",
  undefined: "`undefined`",
  bigint: "a BigInt",
  symbol: "a symbol",
  object: "an object",
  array: "an array",
  function: "a function",
  unknown: "a value of unknown kind",
};

/** `a string`, `a string or a number`: the primitives, for a message. */
export function describe(primitives: readonly Primitive[]): string {
  const names = primitives.map((primitive) => NAMES[primitive]);
  return names.length < 2
    ? (names[0] ?? "nothing")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}
