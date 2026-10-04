// What the Qwik target needs to know about a value's type. Value kinds are the analyser's own
// (design §1.6) and do not reach the IR, so the target reads what it needs from an expression's
// syntax and from its props' declared types, and answers "not certainly" whenever it cannot
// tell: its callers then write the form that type-checks for any value.
import { bindingOf, parseExpression } from "@unframework/codegen";
import type { BindingReference, Expression, UfComponent, UfModule } from "@unframework/ir";

type Node = ReturnType<typeof parseExpression>;

/** The globals whose calls always return a primitive (`String(x)`, `Math.max(a, b)`). */
const PRIMITIVE_FUNCTIONS: ReadonlySet<string> = new Set([
  "Boolean",
  "Number",
  "String",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
]);

/** Namespaces whose functions all return primitives (`Math.round`, `Number.isInteger`). */
const PRIMITIVE_NAMESPACES: ReadonlySet<string> = new Set(["JSON", "Math", "Number"]);

/**
 * Methods that return a primitive on every receiver an expression can have (strings, arrays,
 * numbers; props hold no functions in M1): `includes` and `indexOf` on strings and arrays alike.
 */
const PRIMITIVE_METHODS: ReadonlySet<string> = new Set([
  "charAt",
  "charCodeAt",
  "codePointAt",
  "endsWith",
  "every",
  "findIndex",
  "findLastIndex",
  "includes",
  "indexOf",
  "join",
  "lastIndexOf",
  "normalize",
  "padEnd",
  "padStart",
  "repeat",
  "replace",
  "replaceAll",
  "search",
  "some",
  "startsWith",
  "substring",
  "toExponential",
  "toFixed",
  "toLowerCase",
  "toPrecision",
  "toString",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
]);

/** Type names that are primitives. */
const PRIMITIVE_TYPES: ReadonlySet<string> = new Set([
  "boolean",
  "false",
  "null",
  "number",
  "string",
  "true",
  "undefined",
]);

/**
 * Whether an expression's value is certainly a boolean, a number, a string, `null` or
 * `undefined`: what Qwik's `class` object takes as a toggle's condition (`ClassList`), where an
 * array or an object fails type-checking (L4). Read from the syntax (comparisons, `!`,
 * arithmetic, literals, `.length`, calls that return primitives) and from the declared type of
 * a prop read as a whole (`active`, `props.active`). Anything else, a loop item's member among
 * them, is not certain.
 */
export function isPrimitiveValue(
  expression: Expression,
  component: UfComponent,
  module: UfModule,
): boolean {
  const references = new Map<string, BindingReference>();
  for (const reference of expression.refs) {
    if (reference.kind !== "Binding") continue;
    const start = reference.span.start - expression.span.start;
    references.set(`${start}:${reference.span.end - expression.span.start}`, reference);
  }
  /** The declared type of the prop a node reads as a whole, if it is one. */
  const propType = (node: Node): string | undefined => {
    const reference = references.get(`${node.start}:${node.end}`);
    if (!reference) return undefined;
    if (bindingOf(component, reference.binding).kind !== "prop") return undefined;
    return component.props.find((prop) => prop.binding === reference.binding)?.type.code;
  };
  const primitive = (node: Node): boolean => {
    const type = propType(node);
    if (type !== undefined) return isPrimitiveType(type, module);
    switch (node.type) {
      case "Literal":
        // Not a regular expression (an object) or a BigInt (not M1 syntax).
        return (node as { regex?: unknown; bigint?: unknown }).regex === undefined &&
          (node as { bigint?: unknown }).bigint === undefined;
      case "TemplateLiteral":
      case "UnaryExpression":
      case "BinaryExpression":
        return true;
      case "LogicalExpression":
        return primitive(node.left) && primitive(node.right);
      case "ConditionalExpression":
        return primitive(node.consequent) && primitive(node.alternate);
      case "Identifier":
        return node.name === "undefined" || node.name === "NaN" || node.name === "Infinity";
      case "MemberExpression":
        return !node.computed && node.property.type === "Identifier" && node.property.name === "length";
      case "ChainExpression":
        return primitive(node.expression as Node);
      case "CallExpression":
        return primitiveCall(node.callee as Node);
      default:
        return false;
    }
  };
  return primitive(parseExpression(expression.code));
}

/** Whether a call of `callee` returns a primitive whatever its arguments. */
function primitiveCall(callee: Node): boolean {
  if (callee.type === "Identifier") return PRIMITIVE_FUNCTIONS.has(callee.name);
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.property.type !== "Identifier") return false;
  const { object } = callee;
  if (object.type === "Identifier" && PRIMITIVE_NAMESPACES.has(object.name)) return true;
  return PRIMITIVE_METHODS.has(callee.property.name);
}

/** A token of a type: space, a comment, a literal, a name, a union or grouping, or anything. */
const TYPE_TOKEN =
  /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|-?\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_$][\w$]*|[|()]|[\s\S]/gy;

/**
 * Whether a type, as the source writes it, holds only primitives: `string`, `number`,
 * `boolean`, `null`, `undefined`, literal types and unions of them, also through local type
 * aliases (`type Tone = "info" | "warn"`). Arrays, objects, interfaces and anything else are
 * not.
 */
export function isPrimitiveType(
  code: string,
  module: UfModule,
  seen: ReadonlySet<string> = new Set(),
): boolean {
  for (const [token] of code.matchAll(TYPE_TOKEN)) {
    // Space, comments, literal types, unions and grouping.
    if (/^(?:\s|\/[/*]|["']|-?\d)/.test(token) || /^[|()]$/.test(token)) continue;
    if (!/^[A-Za-z_$]/.test(token)) return false;
    if (PRIMITIVE_TYPES.has(token) || primitiveAlias(token, module, seen)) continue;
    return false;
  }
  return true;
}

/** Whether a name is a local type alias of primitives (`type Tone = "info" | "warn"`). */
function primitiveAlias(name: string, module: UfModule, seen: ReadonlySet<string>): boolean {
  if (seen.has(name)) return false;
  const alias = module.types.find((declaration) => declaration.name === name);
  const right = alias && /^type\s+[A-Za-z_$][\w$]*\s*=([\s\S]*?);?\s*$/.exec(alias.code)?.[1];
  return right !== undefined && isPrimitiveType(right, module, new Set([...seen, name]));
}
