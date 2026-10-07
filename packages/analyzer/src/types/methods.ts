// What the standard methods and the allowed globals return (ADR-0035), by name: enough for
// the common template expressions (`label.trim()`, `price.toFixed(2)`, `tags.join(", ")`,
// `Math.max(a, b)`) to keep a kind the checks can read. Anything not listed is `unknown`.

import {
  arrayOf,
  BOOLEAN,
  elementsOf,
  has,
  kinds,
  NUMBER,
  STRING,
  UNDEFINED,
  union,
  UNKNOWN,
} from "./kinds.ts";
import type { Kinds } from "./kinds.ts";

const STRING_METHODS: ReadonlyMap<string, Kinds> = new Map([
  ...[
    "at",
    "charAt",
    "concat",
    "normalize",
    "padEnd",
    "padStart",
    "repeat",
    "replace",
    "replaceAll",
    "slice",
    "substring",
    "toLowerCase",
    "toString",
    "toUpperCase",
    "trim",
    "trimEnd",
    "trimStart",
    "valueOf",
  ].map((name) => [name, name === "at" ? union(STRING, UNDEFINED) : STRING] as const),
  ...["charCodeAt", "codePointAt", "indexOf", "lastIndexOf", "search"].map(
    (name) => [name, name === "codePointAt" ? union(NUMBER, UNDEFINED) : NUMBER] as const,
  ),
  ...["endsWith", "includes", "startsWith"].map((name) => [name, BOOLEAN] as const),
  ["split", arrayOf(() => STRING)],
]);

const NUMBER_METHODS: ReadonlyMap<string, Kinds> = new Map([
  ["toExponential", STRING],
  ["toFixed", STRING],
  ["toPrecision", STRING],
  ["toString", STRING],
  ["valueOf", NUMBER],
]);

/** The kinds an array method returns, from the array's own kinds. */
function arrayMethod(name: string, array: Kinds): Kinds | undefined {
  const element = () => elementsOf(array);
  switch (name) {
    // The mutating methods (UF3021) read as the copying ones their fix writes.
    case "concat":
    case "copyWithin":
    case "fill":
    case "filter":
    case "reverse":
    case "slice":
    case "sort":
    case "splice":
    case "toReversed":
    case "toSorted":
    case "toSpliced":
    case "with":
      return arrayOf(element);
    case "at":
    case "find":
    case "findLast":
    case "pop":
    case "shift":
      return union(element(), UNDEFINED);
    case "push":
    case "unshift":
      return NUMBER;
    case "every":
    case "includes":
    case "some":
      return BOOLEAN;
    case "findIndex":
    case "findLastIndex":
    case "indexOf":
    case "lastIndexOf":
      return NUMBER;
    case "join":
    case "toString":
      return STRING;
    case "flat":
    case "flatMap":
    case "map":
      return arrayOf(() => UNKNOWN);
    default:
      return undefined;
  }
}

/** The kinds a method call returns, from its receiver's kinds and its name. */
export function methodResult(receiver: Kinds, name: string): Kinds {
  const results: Kinds[] = [];
  let unknown = has(receiver, "unknown") || has(receiver, "object");
  const pick = (table: ReadonlyMap<string, Kinds>) => {
    const result = table.get(name);
    if (result) results.push(result);
    else unknown = true;
  };
  if (has(receiver, "string")) pick(STRING_METHODS);
  if (has(receiver, "number")) pick(NUMBER_METHODS);
  if (has(receiver, "array")) {
    const result = arrayMethod(name, receiver);
    if (result) results.push(result);
    else unknown = true;
  }
  if (unknown || !results.length) results.push(UNKNOWN);
  return union(...results);
}

/** The kinds the allowed global functions return when called. */
const GLOBAL_CALLS: ReadonlyMap<string, Kinds> = new Map([
  ["Boolean", BOOLEAN],
  ["Number", NUMBER],
  ["String", STRING],
  ["decodeURI", STRING],
  ["decodeURIComponent", STRING],
  ["encodeURI", STRING],
  ["encodeURIComponent", STRING],
  ["isFinite", BOOLEAN],
  ["isNaN", BOOLEAN],
  ["parseFloat", NUMBER],
  ["parseInt", NUMBER],
]);

/** The kinds of the allowed globals as values. */
const GLOBAL_VALUES: ReadonlyMap<string, Kinds> = new Map([
  ["undefined", UNDEFINED],
  ["NaN", NUMBER],
  ["Infinity", NUMBER],
  ["Math", kinds("object")],
  ["JSON", kinds("object")],
]);

/** The kinds of the allowed globals' members, as values or as the result of a call. */
const GLOBAL_MEMBERS: ReadonlyMap<string, Kinds> = new Map([
  ...["E", "LN10", "LN2", "LOG10E", "LOG2E", "PI", "SQRT1_2", "SQRT2"].map(
    (name) => [`Math.${name}`, NUMBER] as const,
  ),
  ...[
    "EPSILON",
    "MAX_SAFE_INTEGER",
    "MAX_VALUE",
    "MIN_SAFE_INTEGER",
    "MIN_VALUE",
    "NEGATIVE_INFINITY",
    "POSITIVE_INFINITY",
    "NaN",
  ].map((name) => [`Number.${name}`, NUMBER] as const),
  ...["isFinite", "isInteger", "isNaN", "isSafeInteger"].map(
    (name) => [`Number.${name}()`, BOOLEAN] as const,
  ),
  ["Number.parseFloat()", NUMBER],
  ["Number.parseInt()", NUMBER],
  ["String.fromCharCode()", STRING],
  ["String.fromCodePoint()", STRING],
  ["Array.isArray()", BOOLEAN],
  ["Array.from()", arrayOf(() => UNKNOWN)],
  ["Array.of()", arrayOf(() => UNKNOWN)],
  ["Object.keys()", arrayOf(() => STRING)],
  ["Object.values()", arrayOf(() => UNKNOWN)],
  ["Object.entries()", arrayOf(() => UNKNOWN)],
  ["JSON.stringify()", STRING],
]);

/** The kinds of an allowed global read as a value. */
export function globalValue(name: string): Kinds {
  return GLOBAL_VALUES.get(name) ?? kinds("function");
}

/** The kinds an allowed global function returns when called (`String(x)`). */
export function globalCall(name: string): Kinds {
  return GLOBAL_CALLS.get(name) ?? UNKNOWN;
}

/**
 * The kinds of a member of an allowed global (`Math.PI`), or of calling it (`Math.max()`,
 * written with `call`): every `Math` function returns a number.
 */
export function globalMember(global: string, member: string, call: boolean): Kinds {
  if (global === "Math" && call) return NUMBER;
  return GLOBAL_MEMBERS.get(`${global}.${member}${call ? "()" : ""}`) ?? UNKNOWN;
}
