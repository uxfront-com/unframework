// The type of a setup `let` the class assigns in `ngOnInit` (`Plan.seeded`): a field without an
// initialiser has no value to infer its type from, so it is declared with one. The source's
// annotation when it has one; otherwise the type TypeScript gives the `let`, where the initial
// value's text makes it certain: literals widened, operators by their operands (`step * 2`,
// `note ?? "none"`, `a ? "x" : "y"`), `.length`, the string, number and array methods whose
// result the receiver fixes (`title.trim()`), the pure globals' (`Math.max(…)`), and reads of a
// prop or of a member whose own type is known so. Otherwise none, and the class types the field
// by a method that computes the initial value (./members.ts). There is no type oracle before M5
// (plan §9).
import { parseExpression } from "@unframework/codegen";
import type { BindingId, Code, TypeDeclaration } from "@unframework/ir";

import { bindingById } from "./plan.ts";
import type { Plan } from "./plan.ts";
import { arrayElement, withoutNullish, withoutUndefined } from "./types.ts";

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const BOOLEAN_OPERATORS = new Set([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  "<=",
  ">",
  ">=",
  "in",
  "instanceof",
]);

/** The arithmetic operators but `+`: a number of numbers, a bigint of bigints. */
const ARITHMETIC = new Set(["-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>"]);

/** The string methods whose result is the type named, on a string. */
const STRING_METHODS: ReadonlyMap<string, string> = new Map([
  ...[
    "trim",
    "trimStart",
    "trimEnd",
    "toUpperCase",
    "toLowerCase",
    "toLocaleUpperCase",
    "toLocaleLowerCase",
    "slice",
    "substring",
    "padStart",
    "padEnd",
    "repeat",
    "replace",
    "replaceAll",
    "concat",
    "charAt",
    "normalize",
    "toString",
  ].map((name) => [name, "string"] as const),
  ...["indexOf", "lastIndexOf", "charCodeAt", "localeCompare", "search"].map(
    (name) => [name, "number"] as const,
  ),
  ...["includes", "startsWith", "endsWith"].map((name) => [name, "boolean"] as const),
  ["split", "string[]"],
]);

/** The number methods, all of which make a string. */
const NUMBER_METHODS = new Set([
  "toFixed",
  "toPrecision",
  "toExponential",
  "toString",
  "toLocaleString",
]);

/**
 * The array methods whose result the array's type fixes: by name, or, for `ARRAY`, a new array
 * of the receiver's element type.
 */
const ARRAY = "";
const ARRAY_METHODS: ReadonlyMap<string, string> = new Map([
  ["join", "string"],
  ["includes", "boolean"],
  ["some", "boolean"],
  ["every", "boolean"],
  ["indexOf", "number"],
  ["lastIndexOf", "number"],
  ["findIndex", "number"],
  ["slice", ARRAY],
  ["toSorted", ARRAY],
  ["toReversed", ARRAY],
  ["concat", ARRAY],
]);

/** The calls of the pure globals whose result has one type, by callee. */
const GLOBAL_CALLS: ReadonlyMap<string, string> = new Map([
  ...[
    "Number",
    "parseInt",
    "parseFloat",
    "Math.abs",
    "Math.ceil",
    "Math.floor",
    "Math.max",
    "Math.min",
    "Math.pow",
    "Math.round",
    "Math.sign",
    "Math.sqrt",
    "Math.trunc",
    "Math.log",
    "Math.hypot",
  ].map((name) => [name, "number"] as const),
  ...["String", "JSON.stringify"].map((name) => [name, "string"] as const),
  ...[
    "Boolean",
    "Array.isArray",
    "Number.isInteger",
    "Number.isFinite",
    "Number.isNaN",
    "Number.isSafeInteger",
  ].map((name) => [name, "boolean"] as const),
  ["Object.keys", "string[]"],
]);

/**
 * The type a `let` that starts with this value has, as TypeScript infers it (literals widened),
 * when its text makes it certain; otherwise `undefined`.
 */
export function valueType(
  code: Code,
  plan: Plan,
  declarations: readonly TypeDeclaration[],
  seen: ReadonlySet<BindingId> = new Set(),
): string | undefined {
  const text = (node: Node) => code.code.slice(node.start, node.end);
  const typeOf = (node: Node): string | undefined => {
    switch (node.type) {
      case "ParenthesizedExpression":
        return typeOf(node.expression as Node);
      case "Literal":
        switch (typeof node.value) {
          case "string":
            return "string";
          case "number":
            return "number";
          case "boolean":
            return "boolean";
          case "bigint":
            return "bigint";
          default:
            return node.bigint === undefined ? undefined : "bigint";
        }
      case "TemplateLiteral":
        return "string";
      case "UnaryExpression":
        switch (node.operator) {
          case "!":
          case "delete":
            return "boolean";
          case "typeof":
            return "string";
          case "+":
            return "number";
          case "-":
          case "~":
            // `-1`, `-step`: the operand's own number (or bigint).
            return numeric(typeOf(node.argument as Node));
          default:
            return undefined;
        }
      case "BinaryExpression": {
        const operator = node.operator as string;
        if (BOOLEAN_OPERATORS.has(operator)) return "boolean";
        const left = typeOf(node.left as Node);
        const right = typeOf(node.right as Node);
        if (operator === "+") {
          if (left === "string" || right === "string") return "string";
          return left === right ? numeric(left) : undefined;
        }
        if (operator === ">>>") return left === "number" && right === "number" ? left : undefined;
        return ARITHMETIC.has(operator) && left === right ? numeric(left) : undefined;
      }
      case "LogicalExpression": {
        const left = typeOf(node.left as Node);
        const right = typeOf(node.right as Node);
        if (left === undefined || right === undefined) return undefined;
        const present = withoutNullish(left, declarations);
        switch (node.operator) {
          case "??":
            return union(present, right);
          case "||":
            // Only where no falsy value has a type of its own (`false`, which `boolean` holds).
            return ["string", "number", "bigint"].includes(present)
              ? union(present, right)
              : undefined;
          default:
            return undefined;
        }
      }
      case "ConditionalExpression": {
        const consequent = typeOf(node.consequent as Node);
        const alternate = typeOf(node.alternate as Node);
        return consequent === undefined || alternate === undefined
          ? undefined
          : union(consequent, alternate);
      }
      case "TSAsExpression":
      case "TSTypeAssertion": {
        const annotation = node.typeAnnotation as Node;
        return annotation.type === "TSTypeReference" && text(annotation) === "const"
          ? undefined
          : text(annotation);
      }
      case "TSSatisfiesExpression":
        return typeOf(node.expression as Node);
      case "TSNonNullExpression": {
        const type = typeOf(node.expression as Node);
        return type === undefined ? undefined : withoutNullish(type, declarations);
      }
      case "ArrayExpression": {
        // `[...items]`, `[a, b]`: an array of the one type its elements have.
        const elements = (node.elements as (Node | null)[]).map((element) =>
          element === null
            ? undefined
            : element.type === "SpreadElement"
              ? spreadElement(typeOf(element.argument as Node))
              : typeOf(element),
        );
        const [first] = elements;
        return first !== undefined && elements.every((element) => element === first)
          ? `${grouped(first)}[]`
          : undefined;
      }
      case "CallExpression":
        return callType(node);
      case "Identifier":
      case "MemberExpression": {
        // A read the analyser resolved, as a whole: `start`, `count.value`, `props.label`.
        const start = code.span.start + node.start;
        const end = code.span.start + node.end;
        const reference = code.refs.find(
          (each) => each.span.start === start && each.span.end === end,
        );
        if (reference?.kind === "Binding") {
          return bindingType(reference.binding, plan, declarations, seen);
        }
        if (node.type !== "MemberExpression" || node.optional) return undefined;
        const receiver = typeOf(node.object as Node);
        if (receiver === undefined) return undefined;
        const property = node.property as Node;
        if (!node.computed) {
          // `.length` of a string or an array.
          return property.name === "length" &&
            (receiver === "string" || arrayElement(receiver) !== undefined)
            ? "number"
            : undefined;
        }
        // An array's element (`items[0]`): `undefined` too, as `noUncheckedIndexedAccess` says.
        const element = arrayElement(receiver);
        return element !== undefined && typeOf(property) === "number"
          ? `${grouped(element)} | undefined`
          : undefined;
      }
      default:
        return undefined;
    }
  };
  /** A call's type: a method of a string, a number or an array, or a pure global's. */
  const callType = (node: Node): string | undefined => {
    if (node.optional) return undefined;
    const callee = node.callee as Node;
    const global = GLOBAL_CALLS.get(text(callee));
    if (global !== undefined) {
      const start = code.span.start + callee.start;
      // A global read as such, not a binding of its name (the analyser rejects one).
      return code.refs.some(
        (reference) => reference.kind === "Global" && reference.span.start === start,
      )
        ? global
        : undefined;
    }
    if (callee.type !== "MemberExpression" || callee.computed || callee.optional) return undefined;
    const receiver = typeOf(callee.object as Node);
    const method = (callee.property as Node).name as string;
    if (receiver === "string") return STRING_METHODS.get(method);
    if (receiver === "number") return NUMBER_METHODS.has(method) ? "string" : undefined;
    const element = receiver === undefined ? undefined : arrayElement(receiver);
    if (element === undefined) return undefined;
    const result = ARRAY_METHODS.get(method);
    return result === ARRAY ? `${grouped(element)}[]` : result;
  };
  return typeOf(parseExpression(code.code) as unknown as Node);
}

/** `number` or `bigint` as it is, or none. */
function numeric(type: string | undefined): string | undefined {
  return type === "number" || type === "bigint" ? type : undefined;
}

/** The type of what a spread of a value of this type adds to an array: its element's. */
function spreadElement(type: string | undefined): string | undefined {
  return type === undefined ? undefined : arrayElement(type);
}

/** Two types as one: the same type once, or their union. */
function union(first: string, second: string): string {
  return same(first, second) ? first : `${parenthesised(first)} | ${parenthesised(second)}`;
}

/** Whether two types are written alike, whitespace apart. */
function same(first: string, second: string): boolean {
  return first.replace(/\s+/g, "") === second.replace(/\s+/g, "");
}

/** A type in parentheses where `[]` would bind into it (a union, a function or a conditional). */
function grouped(type: string): string {
  return /[|&]|=>|\bextends\b|^\s*new\b|^\s*keyof\b|^\s*readonly\b/.test(type) ? `(${type})` : type;
}

/** The type of a binding's value, when its declaration makes it certain. */
function bindingType(
  id: BindingId,
  plan: Plan,
  declarations: readonly TypeDeclaration[],
  seen: ReadonlySet<BindingId>,
): string | undefined {
  if (seen.has(id)) return undefined;
  const next = new Set([...seen, id]);
  const binding = bindingById(plan, id);
  const { component } = plan;
  if (binding.kind === "prop") {
    const prop = component.props.find((each) => each.binding === id);
    if (prop === undefined) return undefined;
    if (!prop.optional) return prop.type.code;
    // The input's value: a default leaves `undefined` out (./members.ts `inputMember`).
    return prop.default === undefined
      ? `${parenthesised(prop.type.code)} | undefined`
      : withoutUndefined(prop.type.code, declarations);
  }
  const item = component.setup.find((each) => "binding" in each && each.binding === id);
  switch (item?.kind) {
    case "State":
      if (item.type) {
        return item.initial ? item.type.code : `${parenthesised(item.type.code)} | undefined`;
      }
      return item.initial && valueType(item.initial, plan, declarations, next);
    case "Derived":
      if (item.type) return item.type.code;
      return item.getter.expression
        ? valueType(item.getter.body, plan, declarations, next)
        : undefined;
    case "Const":
      return item.type?.code ?? valueType(item.value, plan, declarations, next);
    case "Variable":
      return item.type?.code ?? (item.initial && valueType(item.initial, plan, declarations, next));
    case "Id":
      return "string";
    default:
      return undefined;
  }
}

/** A type in parentheses where `| undefined` would bind into it (a function or conditional type). */
export function parenthesised(type: string): string {
  return /=>|\bextends\b|^\s*new\b/.test(type) ? `(${type})` : type;
}
