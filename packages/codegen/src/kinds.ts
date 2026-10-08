// Whether a state holds a primitive (ADR-0046). A state is replaced whole (ADR-0008), so a target
// whose reactive state proxies an object deeply (Svelte's `$state`, Vue's `ref`) declares any other
// state shallow (`$state.raw`, `shallowRef`): its value is then the source's own, the same object
// and not a proxy of it, which `===`, `includes` and `structuredClone` read as the source does,
// and which a payload hands a listener as it is. A primitive keeps the everyday form. Without a
// type oracle, a state is primitive only where its type argument or its initial value says so
// (a call says so by its function's declared return type, a built-in by what it returns, a
// `computed` by its getter's value); anything else takes the shallow form, which is right for
// either, but reads as no developer of the framework would write a number or a string.
import type {
  Binding,
  Code,
  DerivedItem,
  FunctionCode,
  FunctionItem,
  StateItem,
  UfComponent,
  UfModule,
} from "@unframework/ir";

import { parseExpression, parseStatementsSource } from "./parse.ts";

/** A node of oxc's AST, as far as these checks read it. */
interface Node {
  type: string;
  [key: string]: unknown;
}

const PRIMITIVE_TYPES: ReadonlySet<string> = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSBigIntKeyword",
  "TSNullKeyword",
  "TSUndefinedKeyword",
  "TSLiteralType",
  "TSTemplateLiteralType",
]);

/** The pure globals (`PURE_GLOBALS`) that are a primitive. */
const PRIMITIVE_GLOBALS: ReadonlySet<string> = new Set(["NaN", "Infinity"]);

/** The pure globals that are a function returning a primitive. */
const PRIMITIVE_FUNCTIONS: ReadonlySet<string> = new Set([
  "Number",
  "String",
  "Boolean",
  "Symbol",
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURIComponent",
  "decodeURIComponent",
  "encodeURI",
  "decodeURI",
]);

/**
 * The members of pure globals whose value, or whose call's value, is a primitive: every member of
 * `Math` is a number or a function returning one; `null` stands for "every member".
 */
const PRIMITIVE_GLOBAL_MEMBERS: ReadonlyMap<string, ReadonlySet<string> | null> = new Map([
  ["Math", null],
  [
    "Number",
    new Set([
      "isFinite",
      "isInteger",
      "isNaN",
      "isSafeInteger",
      "parseFloat",
      "parseInt",
      "EPSILON",
      "MAX_SAFE_INTEGER",
      "MAX_VALUE",
      "MIN_SAFE_INTEGER",
      "MIN_VALUE",
      "NaN",
      "NEGATIVE_INFINITY",
      "POSITIVE_INFINITY",
    ]),
  ],
  ["String", new Set(["fromCharCode", "fromCodePoint", "raw"])],
  ["JSON", new Set(["stringify"])],
  ["Array", new Set(["isArray"])],
  ["Object", new Set(["is"])],
]);

/**
 * Methods that return a primitive on every built-in that has them, whatever the receiver: the
 * string and number methods (`trim`, `toFixed`), and the array, `Map` and `Set` methods that
 * answer a question about their receiver (`join`, `includes`, `indexOf`, `some`, `has`).
 */
const PRIMITIVE_METHODS: ReadonlySet<string> = new Set([
  "toString",
  "toLocaleString",
  "toFixed",
  "toPrecision",
  "toExponential",
  "toUpperCase",
  "toLowerCase",
  "toLocaleUpperCase",
  "toLocaleLowerCase",
  "trim",
  "trimStart",
  "trimEnd",
  "padStart",
  "padEnd",
  "repeat",
  "replace",
  "replaceAll",
  "substring",
  "substr",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "normalize",
  "localeCompare",
  "startsWith",
  "endsWith",
  "search",
  "includes",
  "indexOf",
  "lastIndexOf",
  "join",
  "some",
  "every",
  "findIndex",
  "findLastIndex",
  "has",
]);

/**
 * Methods that return a primitive on a primitive receiver only: an array's `slice`, `at` and
 * `concat` return an array or an element.
 */
const PRIMITIVE_RECEIVER_METHODS: ReadonlySet<string> = new Set(["slice", "at", "concat"]);

/** Whether a state's value is a primitive, as far as its type argument or initial value tell. */
export function isPrimitiveState(
  item: StateItem,
  component: UfComponent,
  module: UfModule,
): boolean {
  const kinds = new Kinds(component, module);
  if (item.type) return kinds.type(item.type.code);
  if (!item.initial) return true;
  return kinds.code(item.initial);
}

class Kinds {
  readonly #component: UfComponent;
  readonly #module: UfModule;
  /** The declarations and bindings being read, against cycles. */
  readonly #reading = new Set<string>();

  constructor(component: UfComponent, module: UfModule) {
    this.#component = component;
    this.#module = module;
  }

  /** Whether a type annotation names only primitives. */
  type(code: string): boolean {
    let statements;
    try {
      ({ statements } = parseStatementsSource(`let value: ${code};`));
    } catch {
      return false;
    }
    const [statement] = statements;
    const declarator =
      statement?.type === "VariableDeclaration" ? statement.declarations[0] : undefined;
    const annotation = declarator?.id.typeAnnotation?.typeAnnotation;
    return annotation !== undefined && this.#typeNode(annotation as unknown as Node);
  }

  #typeNode(node: Node): boolean {
    if (PRIMITIVE_TYPES.has(node.type)) return true;
    switch (node.type) {
      case "TSUnionType":
        return (node["types"] as Node[]).every((each) => this.#typeNode(each));
      case "TSParenthesizedType":
        return this.#typeNode(node["typeAnnotation"] as Node);
      case "TSTypeReference": {
        const name = node["typeName"] as Node;
        if (name.type !== "Identifier" || node["typeArguments"]) return false;
        return this.#alias(name["name"] as string);
      }
      default:
        return false;
    }
  }

  /** Whether a local `type` alias names only primitives: an interface is an object. */
  #alias(name: string): boolean {
    const declaration = this.#module.types.find((each) => each.name === name);
    if (!declaration || this.#reading.has(name)) return false;
    const alias = /^type\s+[A-Za-z_$][\w$]*\s*=\s*([\s\S]*?);?\s*$/.exec(declaration.code);
    if (!alias) return false;
    this.#reading.add(name);
    try {
      return this.type(alias[1]!);
    } finally {
      this.#reading.delete(name);
    }
  }

  /** Whether code's value is a primitive. */
  code(code: Code): boolean {
    let expression: Node;
    try {
      expression = parseExpression(code.code) as unknown as Node;
    } catch {
      return false;
    }
    return this.#expression(expression, code);
  }

  #expression(node: Node, code: Code): boolean {
    switch (node.type) {
      case "Literal":
        return !("regex" in node && node["regex"]);
      case "TemplateLiteral":
        return true;
      case "UnaryExpression":
      case "UpdateExpression":
        // `-x`, `!x`, `typeof x`, `void x`, `delete x.y`, `x++`.
        return true;
      case "BinaryExpression":
        // Arithmetic, a comparison, `in`, `instanceof`: every binary operator gives a primitive.
        return true;
      case "LogicalExpression":
        return (
          this.#expression(node["left"] as Node, code) &&
          this.#expression(node["right"] as Node, code)
        );
      case "ConditionalExpression":
        return (
          this.#expression(node["consequent"] as Node, code) &&
          this.#expression(node["alternate"] as Node, code)
        );
      case "TSAsExpression":
      case "TSSatisfiesExpression": {
        const type = code.code.slice(...span(node["typeAnnotation"] as Node));
        return type === "const"
          ? this.#expression(node["expression"] as Node, code)
          : this.type(type);
      }
      case "ParenthesizedExpression":
      case "TSNonNullExpression":
      case "ChainExpression":
        return this.#expression(node["expression"] as Node, code);
      case "SequenceExpression":
        return this.#expression((node["expressions"] as Node[]).at(-1)!, code);
      case "Identifier":
      case "MemberExpression":
        return this.#reference(node, code);
      case "CallExpression":
        return this.#call(node, code);
      default:
        return false;
    }
  }

  /**
   * A call whose value is a primitive: of a setup function whose declared return type is
   * primitive (`(): string`), of a pure global that returns one (`Number(x)`, `Math.round(x)`),
   * or of a method that returns one (`label.trim()`, `items.join(", ")`, `price.toFixed(2)`).
   */
  #call(node: Node, code: Code): boolean {
    const callee = node["callee"] as Node;
    const binding = this.#bindingAt(callee, code);
    if (binding === undefined) {
      if (callee.type === "MemberExpression") return this.#method(callee, code);
      return PRIMITIVE_FUNCTIONS.has(this.#global(callee, code) ?? "");
    }
    if (binding.kind !== "localFn") return false;
    const item = this.#component.setup.find(
      (each): each is FunctionItem => each.kind === "Function" && each.binding === binding.id,
    );
    return item !== undefined && this.#returns(item.function);
  }

  /** A method call's callee (`label.trim`, `Math.round`): whether the call gives a primitive. */
  #method(callee: Node, code: Code): boolean {
    const name = memberName(callee);
    if (name === undefined) return false;
    const object = callee["object"] as Node;
    if (this.#globalMember(object, name, code)) return true;
    if (PRIMITIVE_METHODS.has(name)) return true;
    return PRIMITIVE_RECEIVER_METHODS.has(name) && this.#expression(object, code);
  }

  /**
   * A member read that is no binding's: an array's or a string's `.length`, or a primitive
   * member of a pure global (`Math.PI`, `Number.MAX_SAFE_INTEGER`).
   */
  #member(node: Node, code: Code): boolean {
    const name = memberName(node);
    if (name === undefined) return false;
    return name === "length" || this.#globalMember(node["object"] as Node, name, code);
  }

  /** Whether `object.name` is a primitive member of a pure global, or a function returning one. */
  #globalMember(object: Node, name: string, code: Code): boolean {
    const members = PRIMITIVE_GLOBAL_MEMBERS.get(this.#global(object, code) ?? "");
    return members === null || (members?.has(name) ?? false);
  }

  /** The name of the global an identifier reads, if it reads one. */
  #global(node: Node, code: Code): string | undefined {
    if (node.type !== "Identifier") return undefined;
    const [start, end] = span(node);
    const reference = code.refs.find(
      (each) =>
        each.kind === "Global" &&
        each.span.start - code.span.start === start &&
        each.span.end - code.span.start === end,
    );
    return reference?.kind === "Global" ? reference.name : undefined;
  }

  /**
   * Whether a function that runs synchronously returns a primitive: by its declared return type,
   * or, for a getter (`computed`), by the value its expression body or each of its `return`
   * statements gives.
   */
  #returns(fn: FunctionCode, getter = false): boolean {
    if (fn.async) return false;
    if (fn.returnType) return this.type(fn.returnType.code);
    if (!getter) return false;
    if (fn.expression) return this.code(fn.body);
    let statements;
    try {
      ({ statements } = parseStatementsSource(fn.body.code));
    } catch {
      return false;
    }
    const returned: (Node | null)[] = [];
    collectReturns(statements as unknown as Node[], returned);
    return (
      returned.length > 0 &&
      returned.every((each) => each === null || this.#expression(each, fn.body))
    );
  }

  /**
   * A read: of a binding, a prop by its type, a constant or a state by its own value; of a
   * primitive global (`NaN`); or a member read that is no binding's (`items.value.length`).
   */
  #reference(node: Node, code: Code): boolean {
    if (node.type === "Identifier" && node["name"] === "undefined") return true;
    const binding = this.#bindingAt(node, code);
    if (binding !== undefined) return this.#binding(binding);
    if (node.type === "MemberExpression") return this.#member(node, code);
    return PRIMITIVE_GLOBALS.has(this.#global(node, code) ?? "");
  }

  /** The binding code reads at a node's span. */
  #bindingAt(node: Node, code: Code): Binding | undefined {
    const [start, end] = span(node);
    const reference = code.refs.find(
      (each) =>
        each.kind === "Binding" &&
        each.span.start - code.span.start === start &&
        each.span.end - code.span.start === end,
    );
    if (reference?.kind !== "Binding") return undefined;
    return this.#component.bindings.find(({ id }) => id === reference.binding);
  }

  #binding(binding: Binding): boolean {
    if (this.#reading.has(binding.id)) return false;
    this.#reading.add(binding.id);
    try {
      switch (binding.kind) {
        case "prop": {
          const prop = this.#component.props.find((each) => each.binding === binding.id);
          return prop !== undefined && this.type(prop.type.code);
        }
        case "state": {
          const item = this.#component.setup.find(
            (each): each is StateItem => each.kind === "State" && each.binding === binding.id,
          );
          if (!item) return false;
          if (item.type) return this.type(item.type.code);
          return item.initial === undefined || this.code(item.initial);
        }
        case "localConst": {
          const item = this.#component.setup.find(
            (each) => (each.kind === "Const" || each.kind === "Id") && each.binding === binding.id,
          );
          if (item?.kind === "Id") return true;
          if (item?.kind !== "Const") return false;
          return item.type ? this.type(item.type.code) : this.code(item.value);
        }
        case "derived": {
          const item = this.#component.setup.find(
            (each): each is DerivedItem => each.kind === "Derived" && each.binding === binding.id,
          );
          if (!item) return false;
          return item.type ? this.type(item.type.code) : this.#returns(item.getter, true);
        }
        case "loopVar":
        case "templateRef":
        case "localFn":
        case "localVar":
        case "emit":
        // Composition's bindings (ADR-0055) are taken to hold any value until M3's lanes read
        // their types.
        case "model":
        case "slots":
        case "slotScope":
        case "context":
        case "component":
          return false;
        default:
          return unreachable(binding.kind);
      }
    } finally {
      this.#reading.delete(binding.id);
    }
  }
}

/** A member expression's property name, when it is written `object.name` (or `object?.name`). */
function memberName(node: Node): string | undefined {
  if (node["computed"]) return undefined;
  const property = node["property"] as Node;
  return property.type === "Identifier" ? (property["name"] as string) : undefined;
}

/**
 * The value of each `return` statement of a function's body, outside the functions it holds
 * (`null` for a `return` without one).
 */
function collectReturns(root: unknown, returned: (Node | null)[]): void {
  if (Array.isArray(root)) {
    for (const each of root) collectReturns(each, returned);
    return;
  }
  if (typeof root !== "object" || root === null || typeof (root as Node).type !== "string") return;
  const node = root as Node;
  if (FUNCTION_TYPES.has(node.type)) return;
  if (node.type === "ReturnStatement") {
    returned.push((node["argument"] as Node | null) ?? null);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== "type" && typeof value === "object") collectReturns(value, returned);
  }
}

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/** A node's span as a `slice` range. */
function span(node: Node): [number, number] {
  return [node["start"] as number, node["end"] as number];
}

function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
