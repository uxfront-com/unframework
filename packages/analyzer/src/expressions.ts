// Template expressions (ADR-0035): the subset of JavaScript every target reads alike, with every
// identifier resolved by the module's scopes and recorded as a reference, and the kinds of value
// each part can have (design §1.6). One walk checks the syntax, resolves the names, reads the
// kinds and reports in source order; nothing it rejects reaches the IR.

import type { Fix } from "@unframework/diagnostics";
import {
  ALLOWED_GLOBALS,
  createBindingReference,
  createExpression,
  createGlobalReference,
  isIdentifier,
} from "@unframework/ir";
import type { Expression, Reference, Span } from "@unframework/ir";
import type { AST } from "@unframework/parser";

import type { Reporter } from "./context.ts";
import { readLiteral } from "./literals.ts";
import type { RenderContext } from "./render.ts";
import {
  arrayOf,
  BOOLEAN,
  booleanLiteral,
  elementsOf,
  FUNCTION,
  kinds,
  mayBeNullish,
  memberOf,
  NOTHING,
  NULL,
  NUMBER,
  numberLiteral,
  objectOf,
  STRING,
  stringLiteral,
  UNDEFINED,
  union,
  UNKNOWN,
  without,
} from "./types/kinds.ts";
import type { Kinds, Member } from "./types/kinds.ts";
import { globalCall, globalMember, globalValue, methodResult } from "./types/methods.ts";

/** An expression the analyser checked: its IR, the kinds of its value, and whether it was clean. */
export interface CheckedExpression {
  expression: Expression;
  kinds: Kinds;
  /** Whether checking it reported nothing: a fix may remove it without hiding a diagnostic. */
  clean: boolean;
}

/** Globals that make the rendering depend on time, chance or the machine (UF3019), and how. */
const NONDETERMINISTIC_GLOBALS: ReadonlyMap<string, string> = new Map([
  ["Date", "`Date` reads the clock"],
  ["Intl", "`Intl` formats by the machine's locale"],
  ["crypto", "`crypto` reads chance"],
  ["performance", "`performance` reads the clock"],
  ["globalThis", "`globalThis` reads the machine's own globals"],
]);

/** Methods that read the machine's locale, whatever their receiver (UF3019). */
const LOCALE_METHODS: ReadonlySet<string> = new Set([
  "localeCompare",
  "toLocaleDateString",
  "toLocaleLowerCase",
  "toLocaleString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
]);

/**
 * Methods that change their receiver, whatever it is (UF3021), with the method that returns a
 * changed copy instead, where one exists (ES2023).
 */
const MUTATING_METHODS: ReadonlyMap<string, string | undefined> = new Map([
  ["copyWithin", undefined],
  ["fill", undefined],
  ["pop", undefined],
  ["push", undefined],
  ["reverse", "toReversed"],
  ["shift", undefined],
  ["sort", "toSorted"],
  ["splice", "toSpliced"],
  ["unshift", undefined],
]);

/** `Object`'s functions that change their argument (UF3021). */
const MUTATING_OBJECT_FUNCTIONS: ReadonlySet<string> = new Set([
  "assign",
  "defineProperties",
  "defineProperty",
  "freeze",
  "preventExtensions",
  "seal",
  "setPrototypeOf",
]);

/**
 * Comments that tell a linter or the type checker to look away (`eslint-disable`,
 * `@ts-ignore`): the outputs copy an expression's comments, and their checks (L4, L5) must judge
 * the output as written.
 */
const DIRECTIVE =
  /^\s*(?:(?:eslint|oxlint)(?:-|\s|$)|globals?\s|@ts-(?:ignore|expect-error|nocheck)\b)/;

const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);
const COMPARISON = new Set(["==", "!=", "===", "!==", "<", "<=", ">", ">="]);

/**
 * Checks an expression the IR copies, and lowers it: its code, its references in source order,
 * the kinds of its value, and whether it was clean.
 */
export function checkExpression(node: AST.Expression, context: RenderContext): CheckedExpression {
  const { reporter, source } = context;
  const mark = reporter.diagnostics.length;
  const walk = new Walk(context);
  const result = walk.value(node, "value", false);
  checkDirectives(span(node), context.comments, reporter);
  // In source order: the walk reports some problems once what follows them is read.
  reporter.diagnostics.push(
    ...reporter.diagnostics.splice(mark).toSorted((a, b) => a.span.start - b.span.start),
  );
  const refs = walk.refs.toSorted((a, b) => a.span.start - b.span.start);
  return {
    expression: createExpression(source.slice(node.start, node.end), span(node), refs),
    kinds: result,
    clean: reporter.diagnostics.length === mark,
  };
}

/** Reports the lint and type-check directives among the comments in a span the IR copies. */
export function checkDirectives(
  at: Span,
  comments: readonly AST.Comment[],
  reporter: Reporter,
): void {
  for (const comment of comments) {
    if (comment.start < at.start || comment.end > at.end || !DIRECTIVE.test(comment.value)) {
      continue;
    }
    reporter.unsupported(
      comment,
      "Lint and type-check directives are not supported in code the outputs copy: each output's lint and type check judge it as written.",
      {
        help: "Remove the comment, and fix what it silenced.",
        fixes: [
          {
            title: "Remove the comment",
            confidence: "safe",
            edits: [{ span: { start: comment.start, end: comment.end }, text: "" }],
          },
        ],
      },
    );
  }
}

/** Where a node is written. */
export function span(node: { start: number; end: number }): Span {
  return { start: node.start, end: node.end };
}

/** A parameter of an arrow function in the expression, while its body is walked. */
interface Local {
  kinds: Kinds;
  read: boolean;
}

/** Where a value sits: an arrow function is only a call's argument. */
type Position = "value" | "argument";

/** One walk of one expression. */
class Walk {
  readonly refs: Reference[] = [];
  readonly #context: RenderContext;
  /** The arrow parameters in scope, by the identifier that declares each. */
  readonly #locals = new Map<object, Local>();

  constructor(context: RenderContext) {
    this.#context = context;
  }

  value(node: AST.Expression, position: Position, shorthand: boolean): Kinds {
    switch (node.type) {
      case "Literal":
        return this.#literal(node);
      case "TemplateLiteral":
        return this.#template(node);
      case "Identifier":
        return this.#identifier(node, shorthand);
      case "MemberExpression":
        return this.#member(node);
      case "ChainExpression":
        return this.value(node.expression, position, false);
      case "CallExpression":
        return this.#call(node);
      case "ArrayExpression":
        return this.#array(node);
      case "ObjectExpression":
        return this.#object(node);
      case "ArrowFunctionExpression":
        return this.#arrow(node, position, []);
      case "UnaryExpression":
        return this.#unary(node);
      case "BinaryExpression":
        return this.#binary(node);
      case "LogicalExpression":
        return this.#logical(node);
      case "ConditionalExpression":
        this.value(node.test, "value", false);
        return union(
          this.value(node.consequent, "value", false),
          this.value(node.alternate, "value", false),
        );
      case "ParenthesizedExpression":
        return this.value(node.expression, position, shorthand);
      case "NewExpression":
        this.#unsupported(
          node,
          "`new` is not supported in template expressions yet: Angular's templates cannot construct objects.",
        );
        this.value(node.callee, "value", false);
        this.#arguments(node.arguments, []);
        return UNKNOWN;
      case "TaggedTemplateExpression":
        this.#unsupported(node, "Tagged templates are not supported in template expressions yet.");
        return UNKNOWN;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "TSInstantiationExpression": {
        const syntax =
          node.type === "TSAsExpression"
            ? "`as`"
            : node.type === "TSSatisfiesExpression"
              ? "`satisfies`"
              : node.type === "TSNonNullExpression"
                ? "the non-null assertion `!`"
                : node.type === "TSTypeAssertion"
                  ? "the type assertion `<T>x`"
                  : "type arguments";
        this.#unsupported(
          node,
          `TypeScript's ${syntax} is not supported in template expressions yet: Angular's templates have no TypeScript syntax.`,
        );
        return this.value(node.expression, position, false);
      }
      case "JSXElement":
      case "JSXFragment":
        this.#context.reporter.report(
          "UF3012",
          node,
          "JSX cannot be a value: only a child, a branch of a conditional child or the element a list's `.map` renders.",
          {
            help: "Write the JSX as a child, or extract a component (composition lands in M3).",
          },
        );
        return UNKNOWN;
      case "AssignmentExpression":
        return this.#impure(node, "An assignment changes state");
      case "UpdateExpression":
        return this.#impure(node, `\`${node.operator}\` changes state`);
      case "SequenceExpression":
        return this.#impure(node, "The comma operator exists for its operands' side effects");
      case "AwaitExpression":
        return this.#impure(node, "`await` waits for a promise, and rendering is synchronous");
      case "YieldExpression":
        return this.#impure(node, "`yield` suspends a generator, and rendering is synchronous");
      case "ThisExpression":
        return this.#impure(node, "`this` is not the component on every target");
      case "Super":
        return this.#impure(node, "`super` is not the component's on every target");
      case "ImportExpression":
        return this.#impure(node, "`import()` loads a module");
      case "MetaProperty":
        return this.#impure(node, `\`${node.meta.name}.${node.property.name}\` reads the module`);
      case "FunctionExpression":
        return this.#impure(
          node,
          "A function expression defines code that rendering cannot analyse; an arrow function is a call's argument",
        );
      case "ClassExpression":
        return this.#impure(node, "A class expression defines code that rendering cannot analyse");
      default:
        this.#unsupported(node, "This expression is not supported in templates yet.");
        return UNKNOWN;
    }
  }

  #literal(node: AST.Expression & { type: "Literal" }): Kinds {
    const { reporter, source } = this.#context;
    if ("regex" in node && node.regex) return kinds("object");
    if ("bigint" in node && node.bigint !== undefined) {
      this.#unsupported(
        node,
        "BigInt literals are not supported in template expressions yet: Angular's templates have none.",
      );
      return kinds("bigint");
    }
    const { value } = node;
    if (value === null) return NULL;
    if (typeof value === "boolean") return booleanLiteral(value);
    if (typeof value === "number") {
      const raw = source.slice(node.start, node.end);
      if (/^0[xXoObB]/.test(raw)) {
        const decimal = String(value);
        reporter.unsupported(
          node,
          `\`${raw}\` is written \`${decimal}\`: Angular's template expressions read only decimal numbers.`,
          {
            help: "Write the number in decimal.",
            fixes: [
              {
                title: `Write \`${decimal}\``,
                confidence: "safe",
                edits: [{ span: span(node), text: decimal }],
              },
            ],
          },
        );
      }
      return numberLiteral(value);
    }
    if (typeof value === "string") {
      this.#codePointEscapes(source.slice(node.start + 1, node.end - 1), node.start + 1, false);
      return stringLiteral(value);
    }
    return UNKNOWN;
  }

  #template(node: AST.TemplateLiteral): Kinds {
    for (const [index, quasi] of node.quasis.entries()) {
      this.#codePointEscapes(quasi.value.raw, quasi.start + 1, true);
      const expression = node.expressions[index];
      if (expression) this.value(expression, "value", false);
    }
    return node.expressions.length
      ? STRING
      : stringLiteral(node.quasis.map((quasi) => quasi.value.cooked ?? "").join(""));
  }

  /** Reports each `\u{…}` escape, which Angular's lexer cannot read, with its rewrite. */
  #codePointEscapes(raw: string, offset: number, template: boolean): void {
    for (const escape of readLiteral(raw, offset, template).codePointEscapes) {
      const written = this.#context.source.slice(escape.start, escape.end);
      this.#context.reporter.unsupported(
        escape,
        `The escape \`${written}\` is written \`${escape.replacement}\`: Angular's template expressions read only four-digit \`\\u\` escapes.`,
        {
          help: "Write the character as `\\uXXXX` escapes, one per UTF-16 unit.",
          fixes: [
            {
              title: `Write \`${escape.replacement}\``,
              confidence: "safe",
              edits: [{ span: { start: escape.start, end: escape.end }, text: escape.replacement }],
            },
          ],
        },
      );
    }
  }

  #identifier(node: AST.IdentifierReference, shorthand: boolean): Kinds {
    const context = this.#context;
    const { reporter, scopes } = context;
    if (!this.#asciiName(node)) return UNKNOWN;
    const { name } = node;
    const resolution = scopes.resolve(node);
    switch (resolution.kind) {
      case "global": {
        if (ALLOWED_GLOBALS.has(name)) {
          this.refs.push(createGlobalReference(name, span(node)));
          return globalValue(name);
        }
        const reason = NONDETERMINISTIC_GLOBALS.get(name);
        if (reason) {
          reporter.report(
            "UF3019",
            node,
            `${reason}, so the server's render and the browser's would differ.`,
            { help: "Pass the value in as a prop, computed where it is decided." },
          );
          return UNKNOWN;
        }
        this.#unresolved(node);
        return UNKNOWN;
      }
      case "parameter": {
        if (resolution.function === context.component) {
          if (context.propsObject?.declaration === resolution.declaration) {
            this.#wholeProps(node);
            return UNKNOWN;
          }
          const prop = context.propsByDeclaration.get(resolution.declaration);
          if (prop?.id === undefined) return UNKNOWN;
          this.refs.push(createBindingReference(prop.id, span(node), shorthand));
          return prop.kinds;
        }
        const loop = context.loopVariables.get(resolution.declaration);
        if (loop) {
          this.refs.push(createBindingReference(loop.id, span(node), shorthand));
          return loop.kinds;
        }
        const local = this.#locals.get(resolution.declaration);
        if (local) {
          local.read = true;
          return local.kinds;
        }
        return UNKNOWN;
      }
      case "setup":
        reporter.unsupported(
          node,
          `\`${name}\` is declared outside the template, by the component's setup code or an import: reading it lands in M2.`,
        );
        return UNKNOWN;
      default:
        this.#unresolved(node);
        return UNKNOWN;
    }
  }

  /** Whether an identifier is written in ASCII as its name, which Angular's lexer reads. */
  #asciiName(node: { name: string; start: number; end: number }): boolean {
    const { source } = this.#context;
    if (isIdentifier(node.name) && source.slice(node.start, node.end) === node.name) return true;
    this.#unsupported(
      node,
      `\`${source.slice(node.start, node.end)}\` is not written in ASCII letters, digits, \`_\` and \`$\`: Angular's expression lexer reads no other.`,
    );
    return false;
  }

  #unresolved(node: AST.IdentifierReference): void {
    const context = this.#context;
    const known = [...context.props.keys(), ...context.enclosing.map((variable) => variable.name)];
    const near = known.find((name) => closeTo(name, node.name));
    context.reporter.report(
      "UF3020",
      node,
      `\`${node.name}\` is not a prop, a list's item or index, or a global a template expression can read.`,
      {
        help: near
          ? `Did you mean \`${near}\`?`
          : "Declare it as a prop, or check its spelling. Templates read props, list items and indexes, and pure globals such as `Math` and `String`.",
      },
    );
  }

  /** A use of the object form's parameter other than reading a member (UF2001). */
  #wholeProps(node: { start: number; end: number }): void {
    const name = this.#context.propsObject!.name;
    this.#context.reporter.report(
      "UF2001",
      node,
      `\`${name}\` can only be read through its members, such as \`${name}.label\`: the targets declare each prop on its own.`,
      { help: "Read each prop as a member, or destructure the props in the parameter." },
    );
  }

  #member(node: AST.MemberExpression): Kinds {
    const context = this.#context;
    const { object } = node;
    // The object form: `props.label` is a prop, read as one reference.
    if (object.type === "Identifier" && this.#isPropsObject(object)) {
      const prop =
        !node.computed && node.property.type === "Identifier"
          ? context.props.get(node.property.name)
          : undefined;
      if (!prop?.id) {
        this.#wholeProps(node);
        if (node.computed) this.value(node.property, "value", false);
        return UNKNOWN;
      }
      if (node.optional) this.#optional(object, node.property.start, NOTHING, ".");
      this.refs.push(createBindingReference(prop.id, span(node)));
      return prop.kinds;
    }
    const receiver = this.value(object, "value", false);
    const name = this.#memberName(node);
    this.#random(node, name);
    if (node.optional) {
      this.#optional(object, node.property.start, receiver, node.computed ? "" : ".");
    }
    let result: Kinds;
    if (object.type === "Identifier" && this.#isGlobal(object) && name !== undefined) {
      result = globalMember(object.name, name, false);
    } else if (node.computed) {
      result =
        name !== undefined && receiver.objects?.length
          ? memberOf(receiver, name)
          : union(
              ...(receiver.primitives.has("array") ? [elementsOf(receiver)] : []),
              ...(receiver.primitives.has("string") ? [STRING] : []),
              ...([...receiver.primitives].some(
                (primitive) => primitive !== "array" && primitive !== "string",
              )
                ? [UNKNOWN]
                : []),
              UNDEFINED,
            );
    } else {
      result = name === undefined ? UNKNOWN : memberOf(receiver, name);
    }
    return node.optional && mayBeNullish(receiver) ? union(result, UNDEFINED) : result;
  }

  /** `Math.random`, by dot, bracket or optional access, reads chance (UF3019). */
  #random(node: AST.MemberExpression, name: string | undefined): void {
    const { object } = node;
    if (
      name === "random" &&
      object.type === "Identifier" &&
      object.name === "Math" &&
      this.#isGlobal(object)
    ) {
      this.#context.reporter.report(
        "UF3019",
        node,
        "`Math.random` reads chance, so the server's render and the browser's would differ.",
        { help: "Pass the value in as a prop, computed where it is decided." },
      );
    }
  }

  /** A member's name: a static one, or a computed string or number literal; checks it. */
  #memberName(node: AST.MemberExpression): string | undefined {
    const { property } = node;
    if (node.computed) {
      this.value(property as AST.Expression, "value", false);
      if (property.type === "Literal" && typeof property.value === "string") return property.value;
      return undefined;
    }
    if (property.type !== "Identifier") {
      this.#unsupported(property, "Private members are not supported in template expressions.");
      return undefined;
    }
    return this.#asciiName(property) ? property.name : undefined;
  }

  #isPropsObject(node: AST.IdentifierReference): boolean {
    const resolution = this.#context.scopes.resolve(node);
    return (
      resolution.kind === "parameter" &&
      resolution.declaration === this.#context.propsObject?.declaration
    );
  }

  #isGlobal(node: AST.IdentifierReference): boolean {
    return this.#context.scopes.resolve(node).kind === "global" && ALLOWED_GLOBALS.has(node.name);
  }

  /**
   * Checks the `?.` after `operand`, before `next`: an operand that can never be nullish makes it
   * do nothing, which Angular rejects (UF3023). The fix writes `replacement` for it.
   */
  #optional(
    operand: { start: number; end: number },
    next: number,
    kindsOf: Kinds,
    replacement: string,
  ): void {
    if (mayBeNullish(kindsOf)) return;
    const token = findToken(this.#context.source, operand.end, next, "?.");
    if (!token) return;
    this.#context.reporter.report(
      "UF3023",
      { start: token.start, end: token.start + 2 },
      "`?.` reads from a value that is never null or undefined, so it does nothing.",
      {
        help: "Remove the `?`, or make the prop optional if it can be absent.",
        fixes: [
          {
            title: replacement ? "Write `.`" : "Remove `?.`",
            confidence: "safe",
            edits: [{ span: { start: token.start, end: token.start + 2 }, text: replacement }],
          },
        ],
      },
    );
  }

  #call(node: AST.CallExpression): Kinds {
    if (node.typeArguments) {
      this.#unsupported(
        node.typeArguments,
        "Type arguments on a call are not supported in template expressions yet: Angular's templates have no TypeScript syntax.",
      );
    }
    const { callee } = node;
    let result: Kinds = UNKNOWN;
    let parameters: Kinds[] = [];
    let calleeKinds: Kinds = UNKNOWN;
    if (callee.type === "MemberExpression") {
      const receiver = this.#receiverOf(callee);
      const name = callee.computed
        ? callee.property.type === "Literal" && typeof callee.property.value === "string"
          ? callee.property.value
          : undefined
        : callee.property.type === "Identifier"
          ? callee.property.name
          : undefined;
      this.#random(callee, name);
      if (name !== undefined) this.#checkMethod(callee, name);
      const global =
        callee.object.type === "Identifier" && this.#isGlobal(callee.object)
          ? callee.object.name
          : undefined;
      result =
        global !== undefined && name !== undefined
          ? globalMember(global, name, true)
          : name !== undefined
            ? methodResult(receiver, name)
            : UNKNOWN;
      if (name !== undefined && receiver.primitives.has("array")) {
        parameters = callbackParameters(name, elementsOf(receiver));
      }
      calleeKinds = FUNCTION;
    } else {
      calleeKinds = this.value(callee, "value", false);
      if (callee.type === "Identifier" && this.#isGlobal(callee)) {
        if (callee.name === "Array") {
          this.#unsupported(
            callee,
            "`Array(…)` is not supported in template expressions: it creates an array with holes, which the targets iterate differently.",
            "Write an array literal, or `Array.from({ length: n }, (_, index) => …)`.",
          );
        }
        result = globalCall(callee.name);
      }
    }
    if (node.optional) {
      const next = node.arguments[0]?.start ?? node.end - 1;
      this.#optional(callee, next, calleeKinds, "");
    }
    this.#arguments(node.arguments, parameters);
    if (node.optional && mayBeNullish(calleeKinds)) result = union(result, UNDEFINED);
    return result;
  }

  /** Walks a method call's callee up to its receiver, which it returns the kinds of. */
  #receiverOf(callee: AST.MemberExpression): Kinds {
    const receiver = this.value(callee.object, "value", false);
    if (callee.computed) this.value(callee.property, "value", false);
    else if (callee.property.type === "Identifier") this.#asciiName(callee.property);
    if (callee.optional) {
      this.#optional(callee.object, callee.property.start, receiver, callee.computed ? "" : ".");
    }
    return receiver;
  }

  /** The checks of a method's name: mutation (UF3021) and locale (UF3019). */
  #checkMethod(callee: AST.MemberExpression, name: string): void {
    const { reporter } = this.#context;
    const { property } = callee;
    if (MUTATING_METHODS.has(name)) {
      const copy = MUTATING_METHODS.get(name);
      const fixes: Fix[] = copy
        ? [
            {
              title: `Write \`${copy}\``,
              confidence: "safe",
              edits: [
                {
                  span: span(property),
                  text: property.type === "Literal" ? JSON.stringify(copy) : copy,
                },
              ],
            },
          ]
        : [];
      reporter.report(
        "UF3021",
        property,
        `\`${name}\` changes the array it is called on, which may be a prop: rendering must not change anything.`,
        {
          help: copy
            ? `\`${copy}\` returns a changed copy instead.`
            : "Compute the result without changing the array (`slice`, `concat`, `toSpliced`).",
          fixes,
        },
      );
    } else if (
      MUTATING_OBJECT_FUNCTIONS.has(name) &&
      callee.object.type === "Identifier" &&
      callee.object.name === "Object" &&
      this.#isGlobal(callee.object)
    ) {
      reporter.report(
        "UF3021",
        property,
        `\`Object.${name}\` changes the object it is given, which may be a prop: rendering must not change anything.`,
        { help: "Build a new object instead: `{ ...a, ...b }`." },
      );
    }
    if (LOCALE_METHODS.has(name)) {
      reporter.report(
        "UF3019",
        property,
        `\`${name}\` formats by the machine's locale, so the server's render and the browser's would differ.`,
        {
          help: "Format the value where the locale is decided, and pass it in as a prop.",
        },
      );
    }
  }

  #arguments(items: readonly AST.Argument[], parameters: readonly Kinds[]): void {
    for (const item of items) {
      if (item.type === "SpreadElement") this.value(item.argument, "value", false);
      else if (item.type === "ArrowFunctionExpression") this.#arrow(item, "argument", parameters);
      else this.value(item, "argument", false);
    }
  }

  #array(node: AST.ArrayExpression): Kinds {
    const elements: Kinds[] = [];
    let hole = false;
    for (const element of node.elements) {
      if (element === null) {
        hole = true;
      } else if (element.type === "SpreadElement") {
        elements.push(elementsOf(this.value(element.argument, "value", false)));
      } else {
        elements.push(this.value(element, "value", false));
      }
    }
    if (hole) {
      this.#unsupported(
        node,
        "Arrays with holes (`[a, , b]`) are not supported in template expressions: Angular's templates reject them, and the targets iterate holes differently.",
        "Write `undefined` where the hole is.",
      );
    }
    const element = elements.length ? union(...elements) : NOTHING;
    return arrayOf(() => element);
  }

  #object(node: AST.ObjectExpression): Kinds {
    const members = new Map<string, Member>();
    let spread = false;
    for (const property of node.properties) {
      if (property.type === "SpreadElement") {
        spread = true;
        this.value(property.argument, "value", false);
        continue;
      }
      if (property.method || property.kind !== "init") {
        this.#unsupported(
          property,
          "Methods, getters and setters in object literals are not supported in template expressions: Angular's templates reject them.",
        );
        continue;
      }
      if (property.computed) {
        this.#unsupported(
          property.key,
          "Computed keys in object literals are not supported in template expressions: Angular's templates reject them.",
        );
        this.value(property.key as AST.Expression, "value", false);
        this.value(property.value, "value", false);
        continue;
      }
      const { key } = property;
      let name: string | undefined;
      if (key.type === "Identifier") {
        if (!property.shorthand) name = this.#asciiName(key) ? key.name : undefined;
        else name = key.name;
      } else if (key.type === "Literal" && typeof key.value === "string") {
        name = key.value;
      } else {
        this.#unsupported(
          key,
          "Object keys other than names and strings are not supported in template expressions.",
        );
      }
      const value = this.value(property.value, "value", property.shorthand);
      if (name !== undefined) {
        members.set(name, { kinds: () => value, optional: false, key: span(key) });
      }
    }
    return objectOf({ declared: false, members: () => (spread ? new Map() : members) });
  }

  #arrow(
    node: AST.ArrowFunctionExpression,
    position: Position,
    parameters: readonly Kinds[],
  ): Kinds {
    const context = this.#context;
    const { reporter } = context;
    if (position !== "argument") {
      return this.#impure(
        node,
        "An arrow function renders nothing alike on every target: it can only be a call's argument, such as `items.filter((item) => item.on)`",
      );
    }
    const angular = "Angular's templates accept only `(a, b) => expression`.";
    if (node.async) {
      this.#unsupported(node, "Async arrow functions are not supported in template expressions.");
    }
    if (node.typeParameters || node.returnType) {
      this.#unsupported(
        node.typeParameters ?? node.returnType!,
        `Type annotations on an arrow function are not supported in template expressions yet: ${angular}`,
      );
    }
    const declared: { node: AST.BindingIdentifier; local: Local }[] = [];
    for (const [index, parameter] of node.params.entries()) {
      if (parameter.type !== "Identifier" || parameter.typeAnnotation || parameter.optional) {
        this.#unsupported(
          parameter,
          `Arrow function parameters other than plain names are not supported in template expressions yet: ${angular}`,
        );
        continue;
      }
      const local: Local = { kinds: parameters[index] ?? UNKNOWN, read: false };
      this.#locals.set(parameter, local);
      declared.push({ node: parameter, local });
    }
    const mark = reporter.diagnostics.length;
    const { body } = node;
    if (body.type === "BlockStatement") {
      const statements = body.body.filter((statement) => statement.type !== "EmptyStatement");
      const only = statements.length === 1 ? statements[0] : undefined;
      const returned =
        only?.type === "ReturnStatement" && only.argument ? only.argument : undefined;
      // The fix removes the block around the returned expression, which keeps its own fixes,
      // where no comment would go with it.
      const around = returned
        ? [
            { start: body.start, end: returned.start },
            { start: returned.end, end: body.end },
          ]
        : [];
      const fixable =
        returned !== undefined &&
        !context.comments.some((comment) =>
          around.some((range) => comment.start >= range.start && comment.end <= range.end),
        );
      const object = returned?.type === "ObjectExpression";
      reporter.unsupported(
        body,
        `Arrow functions with a block body are not supported in template expressions yet: ${angular}`,
        fixable
          ? {
              help: "Write the returned expression as the body.",
              fixes: [
                {
                  title: "Write the returned expression as the body",
                  confidence: "safe",
                  edits: around.map((range, index) => ({
                    span: range,
                    text: object ? (index ? ")" : "(") : "",
                  })),
                },
              ],
            }
          : { help: "Write the returned expression as the body: `(item) => item.on`." },
      );
      if (returned) this.value(returned, "value", false);
      // A block the walk does not read may read every parameter.
      else for (const { local } of declared) local.read = true;
    } else {
      this.value(body, "value", false);
    }
    // The parameters' own diagnostics come before the body's, in source order.
    const inBody = reporter.diagnostics.splice(mark);
    this.#parameters(node, declared);
    reporter.diagnostics.push(...inBody);
    for (const { node: parameter } of declared) this.#locals.delete(parameter);
    return FUNCTION;
  }

  /**
   * Checks an arrow function's parameters once its body is walked: the trailing ones it never
   * reads fail the outputs' `no-unused-vars` (which reads only the parameters after the last one
   * read), and one that shadows a name the targets rewrite would capture the rewrite (UF3024).
   */
  #parameters(
    node: AST.ArrowFunctionExpression,
    declared: readonly { node: AST.BindingIdentifier; local: Local }[],
  ): void {
    const context = this.#context;
    const { reporter, source } = context;
    const all = node.params;
    let lastRead = -1;
    for (const [index, parameter] of all.entries()) {
      const entry = declared.find((item) => item.node === parameter);
      if (!entry || entry.local.read) lastRead = index;
    }
    const parenthesised = source[node.start] === "(";
    for (const [index, parameter] of all.entries()) {
      const entry = declared.find((item) => item.node === parameter);
      if (!entry) continue;
      const { name } = entry.node;
      if (index > lastRead) {
        const previous = all[index - 1];
        const removal = parenthesised
          ? { start: previous ? previous.end : parameter.start, end: parameter.end }
          : { start: parameter.start, end: parameter.end };
        reporter.report(
          "UF3024",
          parameter,
          `The parameter \`${name}\` is never read: the outputs' lint rejects a parameter that nothing after it reads.`,
          {
            help: "Remove it.",
            fixes: [
              {
                title: `Remove \`${name}\``,
                confidence: "safe",
                edits: [{ span: removal, text: parenthesised ? "" : "()" }],
              },
            ],
          },
        );
        continue;
      }
      shadowing(entry.node, context);
    }
  }

  #unary(node: AST.UnaryExpression): Kinds {
    switch (node.operator) {
      case "!":
        this.value(node.argument, "value", false);
        return BOOLEAN;
      case "-":
      case "+":
        this.value(node.argument, "value", false);
        return NUMBER;
      case "typeof": {
        // Angular's lexer reads a `/` right after `typeof` as a division, not a regex.
        const { argument } = node;
        const between = this.#context.source.slice(node.start + "typeof".length, argument.start);
        if (this.#context.source[argument.start] === "/" && !between.includes("(")) {
          this.#context.reporter.unsupported(
            argument,
            "A regular expression right after `typeof` is not supported: Angular's lexer reads its `/` as a division.",
            {
              help: "Wrap it in parentheses.",
              fixes: [
                {
                  title: "Wrap it in parentheses",
                  confidence: "safe",
                  edits: [
                    { span: { start: argument.start, end: argument.start }, text: "(" },
                    { span: { start: argument.end, end: argument.end }, text: ")" },
                  ],
                },
              ],
            },
          );
        }
        this.value(argument, "value", false);
        return STRING;
      }
      case "~":
        this.#unsupported(node, "Bitwise operators are not supported in template expressions yet.");
        this.value(node.argument, "value", false);
        return NUMBER;
      case "void":
        return this.#impure(node, "`void` exists for its operand's side effects");
      default:
        return this.#impure(node, "`delete` changes an object");
    }
  }

  #binary(node: AST.BinaryExpression | AST.PrivateInExpression): Kinds {
    const { operator } = node;
    if (node.left.type === "PrivateIdentifier") {
      this.#unsupported(node, "`#x in obj` is not supported in template expressions.");
      return BOOLEAN;
    }
    if (operator === "in" || operator === "instanceof") {
      this.#unsupported(node, `\`${operator}\` is not supported in template expressions yet.`);
      this.value(node.left, "value", false);
      this.value(node.right, "value", false);
      return BOOLEAN;
    }
    const left = this.value(node.left, "value", false);
    const right = this.value(node.right, "value", false);
    if (COMPARISON.has(operator)) return BOOLEAN;
    if (!ARITHMETIC.has(operator)) {
      this.#unsupported(
        node,
        operator === "|"
          ? "The bitwise operator `|` is not supported in template expressions: Angular reads `|` as a pipe."
          : "Bitwise operators are not supported in template expressions yet.",
      );
      return NUMBER;
    }
    if (operator !== "+") return NUMBER;
    if (left.primitives.has("string") || right.primitives.has("string")) {
      return left.primitives.has("unknown") || right.primitives.has("unknown")
        ? union(STRING, UNKNOWN)
        : STRING;
    }
    return left.primitives.has("unknown") || right.primitives.has("unknown") ? UNKNOWN : NUMBER;
  }

  #logical(node: AST.LogicalExpression): Kinds {
    const left = this.value(node.left, "value", false);
    if (node.operator === "??") {
      const { reporter, source } = this.#context;
      const mark = reporter.diagnostics.length;
      const right = this.value(node.right, "value", false);
      if (mayBeNullish(left)) return union(without(left, "null", "undefined"), right);
      const token = findToken(source, node.left.end, node.right.start, "??");
      if (token) {
        // The fix removes `??` and its right side, which must hold nothing reported, and no
        // comment, which may be reported once the walk ends.
        const clean =
          reporter.diagnostics.length === mark &&
          !this.#context.comments.some(
            (comment) => comment.start >= token.after && comment.end <= node.end,
          );
        const after = reporter.diagnostics.splice(mark);
        reporter.report(
          "UF3023",
          { start: token.start, end: token.start + 2 },
          "The left side of `??` is never null or undefined, so its right side never renders.",
          {
            help: "Remove `??` and its right side, or make the prop optional if it can be absent.",
            ...(clean
              ? {
                  fixes: [
                    {
                      title: "Remove `??` and its right side",
                      confidence: "safe" as const,
                      edits: [{ span: { start: token.after, end: node.end }, text: "" }],
                    },
                  ],
                }
              : {}),
          },
        );
        reporter.diagnostics.push(...after);
      }
      // Never nullish, the left side is the value: the right side is never read.
      return left;
    }
    const right = this.value(node.right, "value", false);
    if (node.operator === "||") return union(without(left, "null", "undefined"), right);
    // `a && b` is `a` when `a` is falsy: objects, arrays and functions never are.
    return union(without(left, "object", "array", "function", "symbol"), right);
  }

  /** Reports an expression that changes something (UF3021), without walking into it. */
  #impure(node: { start: number; end: number }, why: string): Kinds {
    this.#context.reporter.report(
      "UF3021",
      node,
      `${why}: a template expression must not change anything, and renders the same however often it runs.`,
      { help: "Compute the value without side effects, from the props." },
    );
    return UNKNOWN;
  }

  #unsupported(node: { start: number; end: number }, message: string, help?: string): void {
    this.#context.reporter.unsupported(node, message, help ? { help } : {});
  }
}

/**
 * The kinds an array method passes its callback, from the array's element kinds: the item and
 * its index, both items of a comparator, or the accumulator and the item of a reduction.
 */
function callbackParameters(method: string, element: Kinds): Kinds[] {
  switch (method) {
    case "every":
    case "filter":
    case "find":
    case "findIndex":
    case "findLast":
    case "findLastIndex":
    case "flatMap":
    case "forEach":
    case "map":
    case "some":
      return [element, NUMBER];
    case "sort":
    case "toSorted":
      return [element, element];
    case "reduce":
    case "reduceRight":
      return [UNKNOWN, element, NUMBER];
    default:
      return [];
  }
}

/**
 * Reports a parameter of a list or an arrow function whose name would capture a target's rewrite
 * (UF3024): a prop's (Solid reads it as `props.label`, Angular as `label()`), the object form's
 * parameter's, a loop variable's around it, an allowed global's, `props` or `rawProps`, which
 * the outputs declare, or one starting with `$`, as the variables Angular's `@for` declares
 * (`$index`). Returns whether it does.
 */
export function shadowing(parameter: AST.BindingIdentifier, context: RenderContext): boolean {
  const { name } = parameter;
  let what: string | undefined;
  if (context.props.has(name)) what = `the prop \`${name}\``;
  else if (context.propsObject?.name === name) what = `the props parameter \`${name}\``;
  else if (context.enclosing.some((variable) => variable.name === name)) {
    what = `the list variable \`${name}\` around it`;
  } else if (ALLOWED_GLOBALS.has(name)) what = `the global \`${name}\``;
  else if (name === "props" || name === "rawProps")
    what = `\`${name}\`, which some outputs declare`;
  // Angular's `@for` declares `$index`, `$count`, `$first`, `$last`, `$even` and `$odd`.
  else if (name.startsWith("$"))
    what = "the names starting with `$` that Angular's `@for` declares";
  if (!what) return false;
  context.reporter.report(
    "UF3024",
    parameter,
    `The parameter \`${name}\` shadows ${what}: the targets that rewrite names would read the parameter instead.`,
    { help: "Rename the parameter." },
  );
  return true;
}

/**
 * The token between `from` and `to`, where only whitespace, comments and the closing brackets of
 * a parenthesised operand separate it from `from`: its start, and where the operand's text ends
 * (after its closing brackets), which a fix removes from.
 */
export function findToken(
  source: string,
  from: number,
  to: number,
  token: string,
): { start: number; after: number } | undefined {
  let after = from;
  for (let index = from; index < to;) {
    if (source.startsWith(token, index)) return { start: index, after };
    const character = source[index]!;
    if (character === ")") {
      after = ++index;
    } else if (/\s/.test(character)) {
      index++;
    } else if (source.startsWith("//", index)) {
      const end = source.indexOf("\n", index);
      index = end === -1 ? to : end;
    } else if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? to : end + 2;
    } else {
      return undefined;
    }
  }
  return undefined;
}

/** Whether two names are one edit apart, as a misspelling is: `lable` for `label`. */
function closeTo(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differ = indices(a).filter((index) => a[index] !== b[index]);
    const [first, second] = differ;
    return (
      differ.length === 1 ||
      (differ.length === 2 &&
        second === first! + 1 &&
        a[first!] === b[second] &&
        a[second] === b[first!])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return indices(long).some((index) => long.slice(0, index) + long.slice(index + 1) === short);
}

/** The indices of a string's UTF-16 units. */
function indices(text: string): number[] {
  return Array.from({ length: text.length }, (_, index) => index);
}
