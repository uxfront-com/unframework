// What the Qwik target needs to know about a value's type. Value kinds are the analyser's own
// (ADR-0037) and do not reach the IR, so the target reads what it needs from an expression's
// syntax and from its props' declared types, and answers "not certainly" whenever it cannot
// tell: its callers then write the form that type-checks for any value.
import { bindingOf, parseExpression } from "@unframework/codegen";
import type {
  BindingKind,
  BindingReference,
  Expression,
  UfComponent,
  UfModule,
} from "@unframework/ir";

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

/**
 * Methods that return a string on every receiver an expression can have that declares them
 * (strings, numbers, arrays): `join` on arrays, `toFixed` on numbers.
 */
const STRING_METHODS: ReadonlySet<string> = new Set([
  "charAt",
  "join",
  "normalize",
  "padEnd",
  "padStart",
  "repeat",
  "replace",
  "replaceAll",
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

/** Type names that are primitives, and the kind of value each stands for. */
const PRIMITIVE_TYPES: ReadonlyMap<string, DeclaredKind> = new Map<string, DeclaredKind>([
  ["boolean", "boolean"],
  ["false", "boolean"],
  ["null", "null"],
  ["number", "number"],
  ["string", "string"],
  ["true", "boolean"],
  ["undefined", "undefined"],
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
  const propKinds = propReads(expression, component, module);
  const primitive = (node: Node): boolean => {
    const kinds = propKinds(node);
    if (kinds) return !kinds.has("other");
    switch (node.type) {
      case "Literal":
        // Not a regular expression (an object) or a BigInt (not M1 syntax).
        return !("regex" in node) && !("bigint" in node);
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
        return (
          !node.computed && node.property.type === "Identifier" && node.property.name === "length"
        );
      case "ChainExpression":
        return primitive(node.expression);
      case "CallExpression":
        return primitiveCall(node.callee);
      default:
        return false;
    }
  };
  return primitive(parseExpression(expression.code));
}

/**
 * Whether an expression's value is certainly a string or `undefined`: what Qwik's JSX types
 * take as a `<title>`'s child. Read from the syntax (string and template literals, `String(…)`,
 * calls of methods that return strings, conditionals and logical operators over such values)
 * and from the declared type of a prop read as a whole, with `undefined` when it may be absent.
 * Anything else is not certain.
 */
export function isTextValue(
  expression: Expression,
  component: UfComponent,
  module: UfModule,
): boolean {
  const propKinds = propReads(expression, component, module);
  const textual = (node: Node): boolean => {
    const kinds = propKinds(node);
    if (kinds) return [...kinds].every((kind) => kind === "string" || kind === "undefined");
    switch (node.type) {
      case "Literal":
        return typeof node.value === "string";
      case "TemplateLiteral":
        return true;
      case "Identifier":
        return node.name === "undefined";
      case "ConditionalExpression":
        return textual(node.consequent) && textual(node.alternate);
      case "LogicalExpression":
        return textual(node.left) && textual(node.right);
      case "CallExpression": {
        const { callee } = node;
        if (callee.type === "Identifier") return callee.name === "String";
        return (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          STRING_METHODS.has(callee.property.name)
        );
      }
      default:
        return false;
    }
  };
  return textual(parseExpression(expression.code));
}

/**
 * The kinds a prop read as a whole (`label`, `props.label`) may have: its declared type's, with
 * `undefined` when the consumer may leave it out and it has no default. `undefined` for any
 * other expression.
 */
export function propReadKinds(
  expression: Expression,
  component: UfComponent,
  module: UfModule,
): ReadonlySet<DeclaredKind> | undefined {
  return propReads(expression, component, module)(parseExpression(expression.code));
}

/**
 * The kinds of the prop each node of an expression reads as a whole, found by the node's
 * offsets in the expression's code: see {@link propReadKinds}.
 */
function propReads(
  expression: Expression,
  component: UfComponent,
  module: UfModule,
): (node: Node) => Set<DeclaredKind> | undefined {
  const references = new Map<string, BindingReference>();
  for (const reference of expression.refs) {
    if (reference.kind !== "Binding") continue;
    const start = reference.span.start - expression.span.start;
    references.set(`${start}:${reference.span.end - expression.span.start}`, reference);
  }
  return (node) => {
    const reference = references.get(`${node.start}:${node.end}`);
    if (!reference || !isProp(bindingOf(component, reference.binding).kind)) return undefined;
    const prop = component.props.find((candidate) => candidate.binding === reference.binding);
    if (!prop) return undefined;
    const kinds = declaredKinds(prop.type.code, module);
    if (prop.optional && prop.default === undefined) kinds.add("undefined");
    return kinds;
  };
}

/** Whether a binding is a prop, whose declared type tells its kinds; nothing else's does here. */
function isProp(kind: BindingKind): boolean {
  switch (kind) {
    case "prop":
      return true;
    case "loopVar":
    case "state":
    case "derived":
    case "templateRef":
    case "localConst":
    case "localFn":
    case "localVar":
    case "emit":
      return false;
    default:
      return kind satisfies never;
  }
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

/** A kind of value a declared type admits; `other` for anything but a primitive. */
export type DeclaredKind = "string" | "number" | "boolean" | "null" | "undefined" | "other";

/**
 * The kinds of value a type, as the source writes it, admits: `string`, `number`, `boolean`,
 * `null`, `undefined` and literal types, through unions, grouping and local type aliases
 * (`type Tone = "info" | "warn"`). Any other name or syntax (an array, an object, an interface)
 * adds `other`.
 */
export function declaredKinds(
  code: string,
  module: UfModule,
  seen: ReadonlySet<string> = new Set(),
): Set<DeclaredKind> {
  const kinds = new Set<DeclaredKind>();
  for (const [token] of code.matchAll(TYPE_TOKEN)) {
    // Space, comments, unions and grouping.
    if (/^(?:\s|\/[/*])/.test(token) || /^[|()]$/.test(token)) continue;
    const primitive = PRIMITIVE_TYPES.get(token);
    if (/^["']/.test(token)) kinds.add("string");
    else if (/^-?\d/.test(token)) kinds.add("number");
    else if (!/^[A-Za-z_$]/.test(token)) kinds.add("other");
    else if (primitive) kinds.add(primitive);
    else for (const kind of aliasKinds(token, module, seen)) kinds.add(kind);
  }
  return kinds;
}

/** The kinds of a local type alias (`type Tone = "info" | "warn"`), or `other`. */
function aliasKinds(name: string, module: UfModule, seen: ReadonlySet<string>): Set<DeclaredKind> {
  if (seen.has(name)) return new Set(["other"]);
  const alias = module.types.find((declaration) => declaration.name === name);
  const right = alias && /^type\s+[A-Za-z_$][\w$]*\s*=([\s\S]*?);?\s*$/.exec(alias.code)?.[1];
  if (right === undefined) return new Set(["other"]);
  return declaredKinds(right, module, new Set([...seen, name]));
}
