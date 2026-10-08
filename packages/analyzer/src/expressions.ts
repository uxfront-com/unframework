// Expressions and the code the setup runs (ADR-0035, ADR-0045): every identifier resolved by the
// module's scopes and recorded as a reference, with the kinds of value each part can have
// (ADR-0035). One walk checks the syntax, resolves the names, reads the kinds and reports in
// source order; nothing it rejects reaches the IR. It walks in one of three modes, the context
// the code runs in (ADR-0045):
//
// - render: a template expression, the subset every target reads alike, Angular's template
//   language included: pure, deterministic and free of TypeScript syntax;
// - pure: a getter or an initial value, which every target writes as script or class code: any
//   expression or statement client code may write, but no write, emit, `await` or `nextTick`;
// - client: a handler, a watcher's callback, `watchEffect`, a lifecycle hook or a setup
//   function: statements, writes of state as statements of their own, emits and `nextTick`.

import type { Fix } from "@unframework/diagnostics";
import {
  ALLOWED_GLOBALS,
  ANGULAR_KEYWORDS,
  angularRespellsRegex,
  CLIENT_GLOBALS,
  createApiReference,
  createBindingReference,
  createCode,
  createEmitReference,
  createEventControl,
  createEventReference,
  createExpression,
  createFunctionCode,
  createGlobalReference,
  createSlotReference,
  createNarrowedPath,
  createParameter,
  createParameterPattern,
  createTypeText,
  createWriteReference,
  DOM_EVENTS,
  EVENT_METHODS,
  extendsEventInterface,
  isIdentifier,
  isMemberPath,
  PORTABLE_EVENT_INTERFACES,
  PORTABLE_EVENT_MEMBERS,
  PURE_GLOBALS,
  WINDOW_MEMBER_GLOBALS,
} from "@unframework/ir";
import type {
  Code,
  CodeReference,
  EventControl,
  Expression,
  FunctionCode,
  FunctionRole,
  NarrowedPath,
  Parameter,
  Reference,
  Span,
} from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import {
  arrowBodySpan,
  eventControlsOf,
  functionSpan,
  literalKinds,
  patternDefaults,
  patternNames,
  returnedKinds,
  skipTrivia,
  widened,
} from "./code.ts";
import type { Reporter } from "./context.ts";
import { readLiteral } from "./literals.ts";
import {
  ancestorsOf,
  angularChecks,
  memberName as pathKey,
  narrowedKinds,
  narrowingAt,
  pathFacts,
  readsAsText,
  referencePath,
  usedLoosely,
} from "./narrowing.ts";
import type { Narrowing, PathFact, ReferencePath, Unfollowed } from "./narrowing.ts";
import {
  assignedValues,
  callProvenance,
  CLONE,
  copiesItems,
  either,
  ELEMENT,
  EVENT,
  FRESH,
  GLOBAL,
  globalCallProvenance,
  joined,
  LOGICAL_ASSIGNMENTS,
  loopSources,
  memberProvenance,
  memberValues,
  mutable,
  NONE,
  other,
  returnsReceiver,
  shared,
} from "./origins.ts";
import type { Provenance } from "./origins.ts";
import { isStatic } from "./props.ts";
import type { EventParameter, PropBinding, RenderContext, SetupBinding } from "./render.ts";
import { setupBindingOf } from "./render.ts";
import {
  arrayOf,
  BOOLEAN,
  booleanLiteral,
  elementsOf,
  falsyPart,
  FUNCTION,
  has,
  kinds,
  mayBeNullish,
  memberOf,
  NOTHING,
  NULL,
  NUMBER,
  numberLiteral,
  objectOf,
  outside,
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
  /**
   * Whether a `?.` in it may end the optional chain it is part of, which then gives `undefined`:
   * the kinds of an expression that is the start of a longer chain (a list's source in
   * `items?.slice(0, 2).map(…)`) do not hold that `undefined` themselves.
   */
  shortCircuits: boolean;
}

/** Code the setup evaluates, checked: its IR, the kinds of its value, and whether it was clean. */
export interface CheckedCode {
  code: Code;
  kinds: Kinds;
  /** The kinds TypeScript infers where it widens the value (`ref(0)` holds a `number`). */
  widened: Kinds;
  /** The kinds a `const` of the value has: its literals kept, its literals' members widened. */
  literal: Kinds;
  clean: boolean;
}

/** The context code runs in (ADR-0045): a template, a getter or an initial value, or the client. */
export type Mode = "render" | "pure" | "client";

/** The globals each context may read (ADR-0035, ADR-0045). */
const GLOBALS: Readonly<Record<Mode, ReadonlySet<string>>> = {
  render: ALLOWED_GLOBALS,
  pure: PURE_GLOBALS,
  client: CLIENT_GLOBALS,
};

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

/** Bitwise and shift assignments, which a write of state does not take (ADR-0045). */
const BITWISE_ASSIGNMENTS: ReadonlySet<string> = new Set(["&=", "|=", "^=", "<<=", ">>=", ">>>="]);

/**
 * Comments that tell a linter or the type checker to look away (`eslint-disable`,
 * `@ts-ignore`): the outputs copy an expression's comments, and their checks (L4, L5) must judge
 * the output as written.
 */
const DIRECTIVE =
  /^\s*(?:(?:eslint|oxlint)(?:-|\s|$)|globals?\s|@ts-(?:ignore|expect-error|nocheck)\b)/;

const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);
const COMPARISON = new Set(["==", "!=", "===", "!==", "<", "<=", ">", ">="]);
const EQUALITY = new Set(["==", "!=", "===", "!=="]);

/**
 * Checks an expression the IR copies, and lowers it: its code, its references in source order,
 * the kinds of its value, and whether it was clean.
 */
export function checkExpression(node: AST.Expression, context: RenderContext): CheckedExpression {
  const { reporter, source } = context;
  const mark = reporter.diagnostics.length;
  const walk = new Walk(context, "render");
  const result = walk.value(node, "value", false);
  checkDirectives(span(node), context.comments, reporter);
  inSourceOrder(reporter, mark);
  const refs = sortReferences(walk.refs) as Reference[];
  return {
    expression: createExpression(source.slice(node.start, node.end), span(node), refs),
    kinds: result,
    clean: reporter.diagnostics.length === mark,
    shortCircuits: walk.shortCircuits,
  };
}

/**
 * Checks a value the setup evaluates (ADR-0045): the initial value of a `ref`, a `const` or a
 * `let`, which is pure code. Its statement's comments are the caller's to check.
 */
export function checkCode(node: AST.Expression, context: RenderContext): CheckedCode {
  const { reporter, source } = context;
  const mark = reporter.diagnostics.length;
  const walk = new Walk(context, "pure");
  const result = walk.value(node, "value", false);
  inSourceOrder(reporter, mark);
  return {
    code: createCode(source.slice(node.start, node.end), span(node), sortReferences(walk.refs)),
    kinds: result,
    widened: widened(node, walk.knownOf),
    literal: literalKinds(node, walk.knownOf),
    clean: reporter.diagnostics.length === mark,
  };
}

/** What a function the source writes is for, and what it is passed. */
export interface FunctionOptions {
  role: FunctionRole;
  /** The parameter that receives an event, with its DOM interface (ADR-0047). */
  event?: EventParameter;
  /** Whether the function is a setup item, whose expression body is its result. */
  item?: boolean;
}

/** A function the source writes, lowered: its IR, and the kinds it returns. */
export interface LoweredFunction {
  function: FunctionCode;
  /** What a call of it gives: its annotated return type's kinds, else its returns'. */
  returns: Kinds;
  clean: boolean;
  /** What in its client code reads chance or the machine's locale (UF3019), if anything. */
  nondeterministic: string | undefined;
}

/**
 * Checks and lowers a function the source writes (ADR-0045): a getter (pure), or a setup function,
 * a watcher's callback, an effect, a lifecycle hook or a handler (client code). The comments of
 * the code that holds it are the caller's to check: a setup statement's, or a handler's.
 */
export function lowerFunction(
  fn: AST.Function | AST.ArrowFunctionExpression,
  context: RenderContext,
  options: FunctionOptions,
): LoweredFunction {
  const { reporter } = context;
  const mark = reporter.diagnostics.length;
  const walk = new Walk(context, options.role === "getter" ? "pure" : "client");
  const lowered = walk.function(fn, options);
  inSourceOrder(reporter, mark);
  return {
    ...lowered,
    clean: reporter.diagnostics.length === mark,
    nondeterministic: walk.nondeterministic,
  };
}

/** Puts the diagnostics reported since `mark` in source order: a walk reports some late. */
function inSourceOrder(reporter: Reporter, mark: number): void {
  reporter.diagnostics.push(
    ...reporter.diagnostics.splice(mark).toSorted((a, b) => a.span.start - b.span.start),
  );
}

/**
 * References in source order: a write or an emit before the references of its value or its
 * arguments, which it starts before or with (ADR-0045).
 */
function sortReferences(refs: readonly CodeReference[]): CodeReference[] {
  return refs.toSorted((a, b) => a.span.start - b.span.start || b.span.end - a.span.end);
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

/** A name local to the code being walked: an arrow's parameter, or a `const` or `let` in it. */
interface Local {
  kinds: Kinds;
  read: boolean;
}

/** Methods that change a `Map`, a `Set` or a `WeakMap`/`WeakSet` they are called on (UF2004). */
const COLLECTION_METHODS: ReadonlySet<string> = new Set(["add", "clear", "delete", "set"]);

/** The array methods whose callback's first parameter is each item of the array. */
const ITERATING_METHODS: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "some",
]);

/**
 * The members of an element through which code changes its structure or its text, which every
 * framework renders from state (UF3028): eslint-plugin-svelte 3.23's `no-dom-manipulating`.
 */
const DOM_MANIPULATING_METHODS: ReadonlySet<string> = new Set([
  "after",
  "append",
  "appendChild",
  "before",
  "insertAdjacentElement",
  "insertAdjacentHTML",
  "insertAdjacentText",
  "insertBefore",
  "normalize",
  "prepend",
  "remove",
  "removeChild",
  "replaceChild",
  "replaceChildren",
  "replaceWith",
]);
const DOM_MANIPULATING_PROPERTIES: ReadonlySet<string> = new Set([
  "innerHTML",
  "innerText",
  "outerHTML",
  "outerText",
  "textContent",
]);

/**
 * The parts of an element whose changes some framework undoes and another keeps, by the methods
 * that change them (UF3028): its classes, its style and its `data-*` attributes.
 */
const PART_METHODS: Readonly<Record<"classList" | "style" | "dataset", ReadonlySet<string>>> = {
  classList: new Set(["add", "remove", "replace", "toggle"]),
  style: new Set(["removeProperty", "setProperty"]),
  dataset: new Set(),
};

/** The methods that change an element's attributes (UF3028). */
const ATTRIBUTE_METHODS: ReadonlySet<string> = new Set([
  "removeAttribute",
  "removeAttributeNS",
  "removeAttributeNode",
  "setAttribute",
  "setAttributeNS",
  "setAttributeNode",
  "setAttributeNodeNS",
  "toggleAttribute",
]);

/**
 * The calls whose callback runs later, never while the call runs: a local function that touches
 * state may be called inside it (UF2024), since nothing waits for the callback's result.
 */
const DEFERRING_GLOBALS: ReadonlySet<string> = new Set([
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "setInterval",
  "setTimeout",
]);
/** The constructors whose callback runs later, on what they observe (UF2024, UF2027). */
const DEFERRING_CONSTRUCTORS: ReadonlySet<string> = new Set([
  "IntersectionObserver",
  "MutationObserver",
  "PerformanceObserver",
  "ReportingObserver",
  "ResizeObserver",
]);
const DEFERRING_METHODS: ReadonlySet<string> = new Set([
  "addEventListener",
  "catch",
  "finally",
  "then",
]);

/**
 * The calls that do nothing with the value their callback returns (UF2011): an arrow given to one
 * whose expression body is a write gets a block body without changing what the code does.
 */
const DISCARDING_GLOBALS: ReadonlySet<string> = new Set([
  "queueMicrotask",
  "requestAnimationFrame",
  "requestIdleCallback",
  "setInterval",
  "setTimeout",
]);
const DISCARDING_METHODS: ReadonlySet<string> = new Set(["addEventListener", "forEach"]);
/**
 * The calls that never run the function they are given, only compare it or forget it: a local
 * function that touches state may be passed to them (UF2024), as `addEventListener`'s partner.
 */
const NON_CALLING_GLOBALS: ReadonlySet<string> = new Set([
  "cancelAnimationFrame",
  "cancelIdleCallback",
  "clearInterval",
  "clearTimeout",
]);
const NON_CALLING_METHODS: ReadonlySet<string> = new Set(["removeEventListener"]);

/** When a call runs the functions it is given (UF2024). */
type Runs = "now" | "later" | "never";

/** The global functions that take any value, `null` and `undefined` included (UF3031). */
const ANY_GLOBALS: ReadonlySet<string> = new Set(["Boolean", "Number", "String"]);
const ANY_GLOBAL_METHODS: ReadonlyMap<string, ReadonlySet<string> | undefined> = new Map([
  ["Array", new Set(["isArray"])],
  ["JSON", new Set(["stringify"])],
  ["Object", new Set(["is"])],
  ["console", undefined],
]);

/**
 * Where a value sits. In a template an arrow function is only a call's argument. In client code
 * a write and an emit are statements of their own: the whole expression of an expression
 * statement, or the whole expression body of a function whose value is discarded (a handler, a
 * watcher's callback, an effect, a lifecycle hook, an `onCleanup` callback); a setup function's
 * expression body is its result. An arrow passed to another call (`nested`) may have an emit as
 * its body, but not a write, whose value `map` or `then` would use (UF2011).
 */
type Position = "value" | "argument" | "statement" | "discarded" | "returned" | "nested";

/** What a write's target is. */
type Target = (
  | { kind: "binding"; binding: SetupBinding }
  | { kind: "local" }
  | { kind: "member" }
  | { kind: "invalid" }
) & {
  /** A destructuring pattern's member targets, each of which it writes (UF2004). */
  members?: AST.MemberExpression[];
};

/** How many parameters each function's role takes, and what it is passed. */
const ROLE_PARAMETERS: Readonly<
  Record<FunctionRole, { max: number; plain: boolean; what: string }>
> = {
  getter: { max: 0, plain: true, what: "a getter takes none" },
  lifecycle: { max: 0, plain: true, what: "a lifecycle hook takes none" },
  watchEffect: { max: 1, plain: true, what: "`watchEffect` passes `onCleanup` alone" },
  watch: {
    max: 3,
    plain: true,
    what: "a watcher passes the value, the previous value and `onCleanup`",
  },
  handler: { max: 1, plain: true, what: "a handler is passed the event alone" },
  function: { max: Number.POSITIVE_INFINITY, plain: false, what: "" },
};

/** One walk of one expression, or of one function the source writes. */
class Walk {
  readonly refs: CodeReference[] = [];
  /** Whether a `?.` of the chain being walked may end it, so the chain may be `undefined`. */
  shortCircuits = false;
  /** The kinds the walk read for each expression it walked. */
  readonly #known = new WeakMap<object, Kinds>();
  /** The reports of narrowed reads a `+` decides: none where it concatenates a string. */
  readonly #concatenations = new Map<object, (() => void)[]>();
  /** The reads reported as narrowed apart (`#readApart`), whose members say nothing new. */
  readonly #apart = new WeakSet<object>();
  readonly #context: RenderContext;
  readonly #mode: Mode;
  /** The names local to the code being walked, by the identifier that declares each. */
  readonly #locals = new Map<object, Local>();
  /** Where an arrow's expression body is written, its parentheses included, by its node. */
  readonly #bodies = new WeakMap<object, Span>();
  /**
   * The arrows passed to a call that does nothing with their value, and their expression bodies,
   * by node (UF2011): a watcher's `onCleanup` and `nextTick` (`callback`), whose callback may be
   * a write, and the calls whose fix gives a write a block body safely (`discarded`): the timers,
   * `queueMicrotask`, `requestAnimationFrame`, `addEventListener` and `forEach`.
   */
  readonly #arrowUses = new WeakMap<object, "callback" | "discarded">();
  /** The expressions the function being lowered returns, outside the functions in it. */
  #returns: AST.Expression[] | undefined;
  /**
   * The event parameter of the function being lowered, what its `Event` references read: its
   * interface, and the events it receives (UF3032 judges its members by them).
   */
  #event: { declaration: object; interface: string; events: readonly string[] } | undefined;
  /** The event parameter's reads passed whole to a local function's event parameter (UF3032). */
  readonly #wholeEvents = new WeakSet<object>();
  /** The `onCleanup` parameter of a watcher's callback or an effect, whose callback runs later. */
  #onCleanup: object | undefined;
  /**
   * How many arrow functions that run at once and are not `async` (an array method's callback)
   * lie around the walk, inside the nearest one that runs later or is `async`.
   */
  #synchronous = 0;
  /**
   * The member expressions whose object the walk is reading, outermost first: the member paths
   * off a read of a prop or a ref's value (`draft.value.email`), which narrowing judges.
   */
  readonly #memberChain: AST.MemberExpression[] = [];
  /** The statements and paths whose narrowed reads are reported once (UF3031). */
  readonly #narrowingReported = new Set<string>();
  /** The locals UF3031's fixes declare, by the block they declare them in. */
  readonly #fixLocals = new Map<object, Set<string>>();
  /** The stand-ins of names in `visiting` while their members are read (`#membersOf`). */
  readonly #memberTokens = new WeakMap<object, object>();
  /**
   * The first construct of client code that reads chance or the machine's locale, which its
   * summary does not list (`Math.random`, `toLocaleString`): UF3019 where render calls it.
   */
  nondeterministic: string | undefined;

  constructor(context: RenderContext, mode: Mode) {
    this.#context = context;
    this.#mode = mode;
  }

  /** The kinds the walk read for a node: `unknown` for one it did not walk. */
  readonly knownOf = (node: AST.Node): Kinds => this.#known.get(node) ?? UNKNOWN;

  value(node: AST.Expression, position: Position, shorthand: boolean): Kinds {
    const result = this.#value(node, position, shorthand);
    this.#known.set(node, result);
    return result;
  }

  #value(node: AST.Expression, position: Position, shorthand: boolean): Kinds {
    const render = this.#mode === "render";
    switch (node.type) {
      case "Literal":
        return this.#literal(node);
      case "TemplateLiteral":
        return this.#template(node);
      case "Identifier":
        return this.#identifier(node, shorthand, position);
      case "MemberExpression":
        return this.#member(node);
      case "ChainExpression": {
        // A `?.` anywhere along the chain ends it as `undefined`, whatever follows it.
        const outer = this.shortCircuits;
        this.shortCircuits = false;
        const chain = this.value(node.expression, position, false);
        const result = this.shortCircuits ? union(chain, UNDEFINED) : chain;
        this.shortCircuits = outer;
        return result;
      }
      case "CallExpression":
        return this.#call(node, position);
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
        if (render) {
          this.#unsupported(
            node,
            "`new` is not supported in template expressions yet: Angular's templates cannot construct objects.",
          );
        }
        this.value(node.callee, "value", false);
        this.#arguments(node.arguments, [], this.#constructs(node.callee));
        return render ? UNKNOWN : kinds("object");
      case "TaggedTemplateExpression":
        this.#unsupported(
          node,
          render
            ? "Tagged templates are not supported in template expressions yet."
            : "Tagged templates are not supported in setup code yet.",
        );
        this.#skip(node);
        return UNKNOWN;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "TSInstantiationExpression": {
        if (render) {
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
        // Setup code is script or class code on every target, which TypeScript checks.
        const inner = this.value(node.expression, position, false);
        if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
          return this.#context.types.kindsOf(node.typeAnnotation);
        }
        return node.type === "TSNonNullExpression" ? without(inner, "null", "undefined") : inner;
      }
      case "JSXElement":
      case "JSXFragment":
        this.#context.reporter.report(
          "UF3012",
          node,
          "JSX cannot be a value: only a child, a branch of a conditional child or the element a list's `.map` renders.",
          {
            help: "Write the JSX as a child, pass it in a slot, or extract a component.",
          },
        );
        this.#skip(node);
        return UNKNOWN;
      case "AssignmentExpression":
        if (render) return this.#impure(node, "An assignment changes state");
        return this.#assignment(node, position);
      case "UpdateExpression":
        if (render) return this.#impure(node, `\`${node.operator}\` changes state`);
        return this.#update(node, position);
      case "SequenceExpression": {
        if (render) {
          return this.#impure(node, "The comma operator exists for its operands' side effects");
        }
        let last: Kinds = UNKNOWN;
        for (const expression of node.expressions) last = this.value(expression, "value", false);
        return last;
      }
      case "AwaitExpression":
        if (render) {
          return this.#impure(node, "`await` waits for a promise, and rendering is synchronous");
        }
        this.value(node.argument, "value", false);
        return UNKNOWN;
      case "YieldExpression":
        if (render) {
          return this.#impure(node, "`yield` suspends a generator, and rendering is synchronous");
        }
        return this.#rejected(node, "Generators are not supported in setup code.");
      case "ThisExpression":
        if (render) return this.#impure(node, "`this` is not the component on every target");
        return this.#rejected(
          node,
          "`this` is not supported in setup code: it is not the component on every target.",
        );
      case "Super":
        if (render) return this.#impure(node, "`super` is not the component's on every target");
        return this.#rejected(node, "`super` is not supported in setup code.");
      case "ImportExpression":
        if (render) return this.#impure(node, "`import()` loads a module");
        return this.#rejected(
          node,
          "Dynamic imports are not supported yet: imports of modules land in M5.",
        );
      case "MetaProperty":
        if (render) {
          return this.#impure(node, `\`${node.meta.name}.${node.property.name}\` reads the module`);
        }
        return this.#rejected(
          node,
          `\`${node.meta.name}.${node.property.name}\` is not supported in setup code.`,
        );
      case "FunctionExpression":
        if (render) {
          return this.#impure(
            node,
            "A function expression defines code that rendering cannot analyse; an arrow function is a call's argument",
          );
        }
        return this.#rejected(
          node,
          "Function expressions are not supported in setup code: write an arrow function, since Angular's output makes functions methods, which a function expression would rebind `this` in.",
        );
      case "ClassExpression":
        if (render) {
          return this.#impure(
            node,
            "A class expression defines code that rendering cannot analyse",
          );
        }
        return this.#rejected(node, "Classes are not supported in setup code.");
      default:
        this.#unsupported(
          node,
          render
            ? "This expression is not supported in templates yet."
            : "This expression is not supported in setup code yet.",
        );
        this.#skip(node);
        return UNKNOWN;
    }
  }

  /** Reports a construct of setup code outside the subset (UF1002), without walking into it. */
  #rejected(node: { start: number; end: number }, message: string): Kinds {
    this.#unsupported(node, message);
    this.#skip(node);
    return UNKNOWN;
  }

  /**
   * Marks as read every parameter that a part the walk reports without reading names (JSX, an
   * impure or an unsupported expression), so that only a parameter nothing reads is reported as
   * unread (UF3024), whose fix removes it.
   */
  #skip(node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) this.#skip(item);
      return;
    }
    const type = (node as { type?: string }).type ?? "";
    // A tag names what it reads too (`<Tag />`, `<item.Tag />`), which scope analysis resolves.
    if (type === "Identifier" || type === "JSXIdentifier") {
      const resolution = this.#context.scopes.resolve(node as AST.IdentifierReference);
      const local =
        resolution.kind === "parameter" || resolution.kind === "variable"
          ? this.#locals.get(resolution.declaration)
          : undefined;
      if (local) local.read = true;
    }
    for (const key of visitorKeys[type] ?? []) {
      this.#skip((node as Record<string, unknown>)[key]);
    }
  }

  #literal(node: AST.Expression & { type: "Literal" }): Kinds {
    const { reporter, source } = this.#context;
    const render = this.#mode === "render";
    if ("regex" in node && node.regex) {
      // Angular writes some characters of the expression as escapes, which its text then holds.
      const raw = source.slice(node.start, node.end);
      if (render && angularRespellsRegex(raw) && readsAsText(node, this.#context)) {
        this.#unsupported(
          node,
          "Reading the text of a regular expression that holds a quote, `;`, whitespace other than one space, a parenthesis in a class, `{{` or `<` is not supported yet: Angular's template writes those characters as escapes, which its `source` and string form would hold.",
          "Write the text as a string, or use the regular expression only through `.test()`, `.exec()` or a string method such as `replace`.",
        );
      }
      return kinds("object");
    }
    if ("bigint" in node && node.bigint !== undefined) {
      // Setup code may write one: React opts a component the React Compiler cannot compile out
      // of it (ADR-0046).
      if (render) {
        this.#unsupported(
          node,
          "BigInt literals are not supported in template expressions yet: Angular's templates have none.",
        );
      }
      return kinds("bigint");
    }
    const { value } = node;
    if (value === null) return NULL;
    if (typeof value === "boolean") return booleanLiteral(value);
    if (typeof value === "number") {
      const raw = source.slice(node.start, node.end);
      if (render && /^0[xXoObB]/.test(raw)) {
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
      if (render) {
        this.#codePointEscapes(source.slice(node.start + 1, node.end - 1), node.start + 1, false);
      }
      return stringLiteral(value);
    }
    return UNKNOWN;
  }

  #template(node: AST.TemplateLiteral): Kinds {
    for (const [index, quasi] of node.quasis.entries()) {
      if (this.#mode === "render") this.#codePointEscapes(quasi.value.raw, quasi.start + 1, true);
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

  #identifier(node: AST.IdentifierReference, shorthand: boolean, position: Position): Kinds {
    const context = this.#context;
    const render = this.#mode === "render";
    if (render && !this.#asciiName(node)) return UNKNOWN;
    const resolution = context.scopes.resolve(node);
    switch (resolution.kind) {
      case "global":
        return this.#global(node, shorthand);
      case "parameter": {
        if (resolution.function === context.component) {
          if (context.propsObject?.declaration === resolution.declaration) {
            this.#wholeProps(node);
            return UNKNOWN;
          }
          const prop = context.propsByDeclaration.get(resolution.declaration);
          if (prop?.id === undefined) return UNKNOWN;
          const narrowed = render ? [] : this.#narrowingRule(node, { kind: "prop", prop }, true);
          this.refs.push(createBindingReference(prop.id, span(node), shorthand, false, narrowed));
          return this.#narrowed(node, prop.kinds);
        }
        const loop = context.loopVariables.get(resolution.declaration);
        if (loop) {
          this.refs.push(createBindingReference(loop.id, span(node), shorthand));
          return this.#narrowed(node, loop.kinds);
        }
        // The event parameter read whole: only passed on to a local function's event parameter
        // (UF3032), never an `Event` reference.
        const local = this.#locals.get(resolution.declaration);
        if (local) {
          local.read = true;
          if (this.#event?.declaration === resolution.declaration && !this.#wholeEvents.has(node)) {
            this.#eventProblem(
              node,
              `\`${node.name}\` is the handler's event, used whole: a handler reads its event's members, or passes it on to a local function that takes the event.`,
            );
          }
          return this.#narrowed(node, local.kinds);
        }
        return UNKNOWN;
      }
      case "variable": {
        if (resolution.scope === context.component) {
          const binding = context.setup.bindings.get(resolution.declaration);
          // A declaration the setup rejected is reported where it is written.
          return binding ? this.#setupRead(node, binding, shorthand, position) : UNKNOWN;
        }
        if ((resolution.scope as AST.Node).type === "Program") {
          // A module-level function or class is a component or a helper, which no code reads.
          if (resolution.declares !== "variable") {
            this.#unresolved(node);
            return UNKNOWN;
          }
          this.#unsupported(
            node,
            `\`${node.name}\` is declared at the module's top level, which a component cannot read yet: module-level declarations land in M5.`,
          );
          return UNKNOWN;
        }
        const local = this.#locals.get(resolution.declaration);
        if (!local) return UNKNOWN;
        local.read = true;
        return local.kinds;
      }
      case "import":
        return this.#imported(node, resolution.declaration);
      default:
        if (!render && node.name === "arguments") {
          return this.#rejected(
            node,
            "`arguments` is not supported in setup code: write a rest parameter (`...values`).",
          );
        }
        this.#unresolved(node);
        return UNKNOWN;
    }
  }

  /**
   * A global: one the context may read, the clock and chance in a template (UF3019), a `window`
   * member client code reads through `window` (UF3020, with a safe fix), or none.
   */
  #global(node: AST.IdentifierReference, shorthand = false): Kinds {
    const { name } = node;
    if (GLOBALS[this.#mode].has(name)) {
      this.refs.push(createGlobalReference(name, span(node)));
      return ALLOWED_GLOBALS.has(name) ? globalValue(name) : UNKNOWN;
    }
    const reason = NONDETERMINISTIC_GLOBALS.get(name);
    if (reason && this.#mode !== "client") {
      this.#context.reporter.report(
        "UF3019",
        node,
        this.#mode === "render"
          ? `${reason}, so the server's render and the browser's would differ.`
          : `${reason}, and a getter or an initial value runs on the server too: the server's render and the browser's would differ.`,
        {
          help:
            this.#mode === "render"
              ? "Pass the value in as a prop, computed where it is decided."
              : "Pass the value in as a prop, or set it from client code (`onMounted`, a handler).",
        },
      );
      return UNKNOWN;
    }
    if (this.#mode === "pure" && (CLIENT_GLOBALS.has(name) || WINDOW_MEMBER_GLOBALS.has(name))) {
      this.#context.reporter.report(
        "UF3020",
        node,
        `\`${name}\` is a global only client code can read (a handler, a watcher's callback, \`watchEffect\`, a lifecycle hook or a function they call): a getter and an initial value run during the setup, on the server too.`,
        {
          help: "Read it in client code, and keep what it gives in a ref: `onMounted(() => { online.value = navigator.onLine; })`.",
        },
      );
      return UNKNOWN;
    }
    if (this.#mode === "client" && WINDOW_MEMBER_GLOBALS.has(name)) {
      // A name that reads like the component's own is `window`'s where nothing declares it: a
      // missing declaration or a typo would read the window silently.
      const text = shorthand ? `${name}: window.${name}` : `window.${name}`;
      this.#context.reporter.report(
        "UF3020",
        node,
        `\`${name}\` is not a prop, a setup binding, a list's item or index, or a global client code reads by its name alone: it is \`window\`'s member, which reads like a name of the component's own.`,
        {
          help: `Read it through \`window\` (\`window.${name}\`), or declare it in the component's setup.`,
          // It reads what the code reads now, which may not be what its author meant.
          fixes: [
            {
              title: `Read \`window.${name}\``,
              confidence: "likely",
              edits: [{ span: span(node), text }],
            },
          ],
        },
      );
      return UNKNOWN;
    }
    this.#unresolved(node);
    return UNKNOWN;
  }

  /**
   * A read of a setup binding by its name alone (ADR-0045): a ref's value is `x.value`
   * (UF3026); `emit` is only called (UF2017); a constant, a setup `let` and a local function are
   * references, which the rules judge where their context may not read them (ADR-0045).
   */
  #setupRead(
    node: AST.IdentifierReference,
    binding: SetupBinding,
    shorthand: boolean,
    position: Position,
  ): Kinds {
    const { reporter } = this.#context;
    const { name } = binding;
    switch (binding.kind) {
      case "state":
      case "derived":
      case "templateRef": {
        const text = shorthand ? `${name}: ${name}.value` : `${name}.value`;
        reporter.report(
          "UF3026",
          node,
          `\`${name}\` is a ref, whose value is \`${name}.value\`: the targets that keep a ref's value apart read nothing else.`,
          {
            help: `Read \`${name}.value\`: Vue's templates unwrap a ref, and the other targets do not.`,
            fixes: [
              {
                title: `Read \`${name}.value\``,
                confidence: "safe",
                edits: [{ span: span(node), text }],
              },
            ],
          },
        );
        // What the fix reads, so that the checks that follow say now what they would then.
        this.#refRules(node, binding, false);
        return binding.kinds;
      }
      case "emit":
        reporter.report(
          "UF2017",
          node,
          "`emit` is only called, with the name of an event the component declares: the targets write each emit as a call of their own.",
          { help: 'Call it: `emit("change", value)`.' },
        );
        return UNKNOWN;
      case "localVar":
        if (this.#nonReactive(node, binding)) return binding.kinds;
        this.refs.push(createBindingReference(binding.id, span(node), shorthand));
        return binding.kinds;
      case "localConst":
        this.refs.push(createBindingReference(binding.id, span(node), shorthand));
        return binding.kinds;
      case "localFn":
        if (this.#mode !== "client" || position !== "argument") {
          this.#functionValue(node, binding);
          return FUNCTION;
        }
        this.refs.push(createBindingReference(binding.id, span(node), shorthand));
        return FUNCTION;
      case "slots":
        this.#slotUse(node, `\`${name}\` is used whole`);
        return UNKNOWN;
      // Composition's bindings (ADR-0055) the analyser does not declare in the setup yet.
      case "model":
      case "slotScope":
      case "context":
      case "component":
        return UNKNOWN;
      default:
        return unreachable(binding.kind);
    }
  }

  /**
   * Reports a read of a setup `let` or a template ref where a value is read reactively (UF2010):
   * a template, a getter, an initial value and a watched source, whose reads the targets track,
   * read only what changes through a ref. Returns whether it reported.
   */
  #nonReactive(node: { start: number; end: number }, binding: SetupBinding): boolean {
    // `watchEffect` reads one only while it runs: the rules judge it once what runs later, in a
    // function it hands on (a timer's, `onCleanup`'s), is known (ADR-0048).
    const where =
      this.#mode === "render"
        ? "a template expression"
        : this.#mode === "pure"
          ? "a getter or an initial value"
          : undefined;
    if (where === undefined) return false;
    const { name } = binding;
    this.#context.reporter.report(
      "UF2010",
      node,
      binding.kind === "localVar"
        ? `\`${name}\` is a setup \`let\`, which is not reactive, read in ${where}: what reads it would never see it change.`
        : `\`${name}\` is a template ref, which is never a reactive dependency on every target, read in ${where}.`,
      {
        help:
          binding.kind === "localVar"
            ? "Hold a value a template, a getter or an effect reads in a `ref`."
            : this.#mode === "client"
              ? 'Read the element from `watch(sources, …, { flush: "post" })`, `onMounted` or a handler.'
              : "Read the element from client code (`onMounted`, a handler), and keep what it gives in a ref.",
      },
    );
    return true;
  }

  /**
   * Reports a local function used as a value where code only calls it (UF2022): a template, a
   * getter or an initial value calls a local function, and client code also passes one as a
   * call's argument (`setTimeout(tick, 100)`), which Angular's output wraps.
   */
  #functionValue(node: AST.IdentifierReference, binding: SetupBinding): void {
    const { name } = binding;
    this.#context.reporter.report(
      "UF2022",
      node,
      this.#mode === "client"
        ? `\`${name}\` is a local function used as a value: client code calls a local function, or passes it as a call's argument (\`setTimeout(${name}, 100)\`).`
        : `\`${name}\` is a local function used as a value in ${this.#mode === "render" ? "a template expression" : "a getter or an initial value"}, which only calls it: the targets write a local function their own way (a method, a QRL), which they cannot pass around there.`,
      {
        help:
          this.#mode === "client"
            ? `Call it, or wrap it in an arrow function: \`() => ${name}()\`.`
            : `Call it inside an arrow function passed to the call: \`items.map((item) => ${name}(item))\`.`,
      },
    );
  }

  /**
   * An imported name: an authoring API, recognised by binding (ADR-0006), is called at the top of
   * the component's body (UF2005) but `nextTick`, which client code calls anywhere; another
   * module's import is reported where it is imported, and read here as not supported yet.
   */
  #imported(node: AST.IdentifierReference, declaration: object): Kinds {
    const { authoring } = this.#context.setup;
    if (!authoring.has(declaration)) {
      this.#unsupported(
        node,
        `\`${node.name}\` is imported from another module, which a component cannot read yet: imports of modules land in M5.`,
      );
      return UNKNOWN;
    }
    const api = authoring.get(declaration);
    if (api === undefined) return UNKNOWN;
    if (api === "nextTick" && this.#mode === "client") {
      // Only a call reaches the targets (`#call` reads one, wrapped or not): each writes its
      // own call in place of `nextTick()`, which it cannot do for a function passed or stored.
      this.#context.reporter.report(
        "UF2025",
        node,
        `\`${node.name}\` is used as a value: \`await ${node.name}()\` is its one form, which each target replaces with its own call, and a function passed or stored is no call to replace.`,
        {
          help: `Call it where the code waits for the DOM: \`await ${node.name}()\` in an \`async\` function, or \`() => ${node.name}()\` where a function is passed.`,
        },
      );
      return FUNCTION;
    }
    this.#misplaced(node, api, false);
    return UNKNOWN;
  }

  /** An authoring API used where it may not be (UF2005). */
  #misplaced(node: AST.IdentifierReference, api: string, called: boolean): void {
    const { reporter } = this.#context;
    if (api === "nextTick") {
      reporter.report(
        "UF2005",
        node,
        "`nextTick` waits for the DOM to update, so only client code calls it: a handler, a watcher's callback, `watchEffect`, a lifecycle hook or a function they call.",
        { help: "Call it in a handler or a lifecycle hook, as `await nextTick()`." },
      );
      return;
    }
    reporter.report(
      "UF2005",
      node,
      called
        ? `\`${node.name}\` is called inside other code: the macros and reactive APIs are called once, at the top level of the component's body, where every target runs the setup once.`
        : `\`${node.name}\` is used as a value: the macros and reactive APIs are only called, at the top level of the component's body.`,
      {
        help: called
          ? "Move the call to the top level of the component's body, as a statement or a `const`'s value."
          : `Call it at the top level of the component's body, as in \`const count = ${node.name === "ref" ? "ref(0)" : `${node.name}(…)`};\`.`,
      },
    );
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
    const known = [
      ...context.props.keys(),
      ...[...context.setup.bindings.values()].map((binding) => binding.name),
      ...context.enclosing.map((variable) => variable.name),
    ];
    const near = known.find((name) => closeTo(name, node.name));
    const where =
      this.#mode === "render"
        ? "a template expression"
        : this.#mode === "pure"
          ? "a getter or an initial value"
          : "client code";
    context.reporter.report(
      "UF3020",
      node,
      `\`${node.name}\` is not a prop, a setup binding, a list's item or index, or a global ${where} can read.`,
      {
        help: near
          ? `Did you mean \`${near}\`?`
          : this.#mode === "render"
            ? "Declare it as a prop or in the component's setup, or check its spelling. Templates read props, the setup's bindings, list items and indexes, and pure globals such as `Math` and `String`."
            : "Declare it as a prop or in the component's setup, or check its spelling.",
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
    const render = this.#mode === "render";
    const { object } = node;
    if (object.type === "Identifier") {
      // The object form: `props.label` is a prop, read as one reference.
      if (this.#isPropsObject(object)) {
        const prop =
          !node.computed && node.property.type === "Identifier"
            ? context.props.get(node.property.name)
            : undefined;
        if (!prop?.id) {
          this.#wholeProps(node);
          if (node.computed) this.value(node.property, "value", false);
          return UNKNOWN;
        }
        // The reference spans the member, whose text the targets splice as `props.label`.
        if (object.start !== node.start) this.#parenthesisedProps(node, object);
        if (node.optional) this.#optional(object, node.property.start, NOTHING, ".");
        const narrowed = render ? [] : this.#narrowingRule(node, { kind: "prop", prop }, true);
        this.refs.push(createBindingReference(prop.id, span(node), false, false, narrowed));
        return this.#narrowed(node, prop.kinds);
      }
      const binding = setupBindingOf(object, context);
      if (binding && isRef(binding)) return this.#refValue(node, object, binding);
      if (binding?.kind === "slots") return this.#slotPresence(node, binding);
      if (this.#isEvent(object)) return this.#eventMember(node, false);
    }
    this.#memberChain.push(node);
    let receiver: Kinds;
    try {
      receiver = this.value(object, "value", false);
    } finally {
      this.#memberChain.pop();
    }
    const name = this.#memberName(node);
    this.#random(node, name);
    if (node.optional) {
      if (render) this.#optional(object, node.property.start, receiver, node.computed ? "" : ".");
      if (mayBeNullish(receiver)) this.shortCircuits = true;
    }
    if (render) this.#readAbsent(object, receiver);
    let result: Kinds;
    if (object.type === "Identifier" && this.#isGlobal(object) && name !== undefined) {
      result = globalMember(object.name, name, false);
    } else if (node.computed) {
      // An index adds `undefined` where the model knows the receiver is an array or a string, as
      // `noUncheckedIndexedAccess` does; a value it cannot type stays `unknown` (ADR-0035), as
      // an `Object.entries` entry's `entry[0]`, a string to TypeScript. A key of literal kinds
      // reads those members of an object, as TypeScript reads a union of known keys.
      const keys = this.knownOf(node.property);
      const literalKeys =
        name === undefined &&
        receiver.objects?.length &&
        keys.strings?.size &&
        [...keys.primitives].every((primitive) => primitive === "string")
          ? [...keys.strings]
          : undefined;
      result =
        name !== undefined && receiver.objects?.length
          ? memberOf(receiver, name)
          : literalKeys
            ? union(...literalKeys.map((key) => memberOf(receiver, key)))
            : [...receiver.primitives].every((primitive) => primitive === "unknown")
              ? UNKNOWN
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
    return this.#narrowed(
      node,
      node.optional && mayBeNullish(receiver) ? union(result, UNDEFINED) : result,
    );
  }

  /**
   * `slots.title`, whether the parent filled the slot (ADR-0054): a template reads it, as a
   * condition, and nothing else reads `slots` but a slot's call or its forwarding (UF3041).
   */
  #slotPresence(node: AST.MemberExpression, binding: SetupBinding): Kinds {
    const slot =
      !node.computed && node.property.type === "Identifier" ? node.property.name : undefined;
    const declared =
      slot !== undefined && this.#context.slots?.slots.some((each) => each.name === slot);
    if (this.#mode !== "render" || !declared || node.optional || node.object.start !== node.start) {
      this.#slotUse(
        node,
        this.#mode !== "render"
          ? `\`${binding.name}\` is read in setup code, which runs where no template is`
          : declared
            ? `\`${this.#context.source.slice(node.start, node.end)}\` is no plain read of a slot`
            : `\`${slot ?? "this"}\` is no slot of this component`,
      );
      if (node.computed) this.value(node.property, "value", false);
      return UNKNOWN;
    }
    this.refs.push(createSlotReference(slot!, span(node)));
    return union(FUNCTION, UNDEFINED);
  }

  /** A use of `slots` other than rendering, testing or forwarding a slot (UF3041). */
  #slotUse(node: { start: number; end: number }, what: string): void {
    this.#context.reporter.report(
      "UF3041",
      node,
      `${what}: a slot is rendered (\`{slots.title?.()}\`), tested in a template (\`slots.title ? … : …\`) or forwarded (\`{{ title: slots.title }}\`), and nothing else.`,
      { help: "Render, test or forward a slot `defineSlots` declares." },
    );
  }

  /**
   * A ref's value, `count.value` (ADR-0045): one reference spanning the member, as the object
   * form's `props.label` is, whose text each target splices as its own read (`count`, `count()`,
   * `this.count()`). A ref has no other member, and is never nullish.
   */
  #refValue(
    node: AST.MemberExpression,
    object: AST.IdentifierReference,
    binding: SetupBinding,
  ): Kinds {
    const { reporter, source } = this.#context;
    const { name } = binding;
    if (node.computed || node.property.type !== "Identifier" || node.property.name !== "value") {
      reporter.report(
        "UF3026",
        node,
        `\`${name}\` is a ref, which holds its value in \`${name}.value\` and has no other member.`,
        { help: `Read \`${name}.value\`, and the value's members through it.` },
      );
      if (node.computed) this.value(node.property, "value", false);
      return UNKNOWN;
    }
    if (object.start !== node.start) {
      const token = findToken(source, object.end, node.property.start, node.optional ? "?." : ".");
      reporter.report(
        "UF3026",
        { start: node.start, end: token?.start ?? object.end },
        `\`${name}\` is read without parentheses: its value is \`${name}.value\`, which the targets splice as one name.`,
        {
          help: "Remove the parentheses.",
          fixes: token
            ? [
                {
                  title: "Remove the parentheses",
                  confidence: "safe",
                  edits: [{ span: { start: node.start, end: token.start }, text: name }],
                },
              ]
            : [],
        },
      );
      return binding.kinds;
    }
    if (node.optional) {
      const token = findToken(source, object.end, node.property.start, "?.");
      if (token) {
        reporter.report(
          "UF3023",
          { start: token.start, end: token.start + 2 },
          "`?.` reads from a ref, which is never null or undefined, so it does nothing.",
          {
            help: "Write `.`: what may be absent is the ref's value, read as `x.value?.member`.",
            fixes: [
              {
                title: "Write `.`",
                confidence: "safe",
                edits: [{ span: { start: token.start, end: token.start + 2 }, text: "." }],
              },
            ],
          },
        );
      }
      return binding.kinds;
    }
    const narrowed = this.#refRules(node, binding, true);
    if (!narrowed) return binding.kinds;
    this.refs.push(createBindingReference(binding.id, span(node), false, false, narrowed));
    return this.#narrowed(node, binding.kinds);
  }

  /**
   * The rules of a read of a ref's value, `x.value` (or `x`, which UF3026 reports and fixes):
   * a template ref read where values are read reactively (UF2010), and the narrowing the read
   * relies on (UF3031, `#narrowingRule`). Returns the read's narrowed paths, or `undefined` where
   * the read is reported as non-reactive, which then holds no reference.
   */
  #refRules(
    node: AST.MemberExpression | AST.IdentifierReference,
    binding: SetupBinding,
    fixable: boolean,
  ): NarrowedPath[] | undefined {
    if (binding.kind === "templateRef" && this.#nonReactive(node, binding)) return undefined;
    return this.#narrowingRule(node, { kind: "ref", binding }, fixable);
  }

  /**
   * The narrowing a read of a ref's value, or of a prop outside the template, relies on
   * (ADR-0046): the read's and that of each member path off it written with `.` or a literal key
   * (`draft.value.email`, `contact.email`), each judged by `#pathRule`. Returns the paths the
   * read relies on a condition showing present, which the IR marks for the targets that read
   * them through a call or a mirror.
   */
  #narrowingRule(
    node: AST.MemberExpression | AST.IdentifierReference,
    subject: Narrowable,
    fixable: boolean,
  ): NarrowedPath[] {
    const context = this.#context;
    const root = referencePath(node, context);
    if (!root) return [];
    // The read, then each member read off it with no parentheses or `?.` between, as the walk
    // reads it, with its kinds.
    const paths: { node: AST.Expression; members: string[]; kinds: Kinds }[] = [
      {
        node,
        members: [],
        kinds: subject.kind === "ref" ? subject.binding.kinds : subject.prop.kinds,
      },
    ];
    for (let index = this.#memberChain.length - 1; index >= 0; index--) {
      const parent = this.#memberChain[index]!;
      const last = paths.at(-1)!;
      if (parent.object !== last.node || parent.optional) break;
      const key = pathKey(parent);
      if (key === undefined || !isMemberPath(context.source.slice(node.end, parent.end))) break;
      paths.push({
        node: parent,
        members: [...last.members, key],
        kinds: pathMember(last.kinds, key, parent.computed),
      });
    }
    if (!paths.some(({ kinds }) => narrowable(kinds))) return [];
    const ancestors = ancestorsOf(node, context.component);
    const narrowed: NarrowedPath[] = [];
    for (const [index, path] of paths.entries()) {
      if (ancestors.at(-1 - index) !== path.node) break;
      const scope = this.#pathRule(
        path.node,
        ancestors.slice(0, ancestors.length - index),
        { root: root.root, names: [...root.names, ...path.members] },
        path.kinds,
        subject,
        path.members,
        fixable,
      );
      if (scope)
        narrowed.push(createNarrowedPath({ start: node.start, end: path.node.end }, scope));
    }
    return narrowed;
  }

  /**
   * The rules of one path of a read (ADR-0046):
   * - a use that relies on a condition narrowing a union of kinds the path holds (`typeof`,
   *   `Array.isArray`, a literal, a discriminant) is UF3031, where the condition is code's: Solid
   *   and Angular read a ref's value through a call, Angular every input, which TypeScript does
   *   not narrow (a conditional child keeps its branch narrowed on every target);
   * - a path that may be `null` or `undefined`, which a condition around it shows present and the
   *   read uses as present (a member read through `.`, a call's argument that takes neither, a
   *   local's initial value), is narrowed where the source's TypeScript narrows it: with no
   *   function between them, in a closure for a destructured prop's own read (a parameter), and in
   *   a handler for the template's conditional around it. Returns that condition's scope.
   */
  #pathRule(
    node: AST.Expression,
    ancestors: readonly AST.Node[],
    path: ReferencePath,
    declared: Kinds,
    subject: Narrowable,
    members: readonly string[],
    fixable: boolean,
  ): NarrowedPath["scope"] | undefined {
    if (!narrowable(declared)) return undefined;
    const nullable = mayBeAbsent(declared);
    const present = nullable ? without(declared, "null", "undefined") : declared;
    const shapes = severalShapes(present);
    const several = !shapes && (isUnion(present) || literalUnion(present));
    const facts = pathFacts(node, path, declared, this.#context, this.knownOf);
    if ((shapes || several) && !facts.some((fact) => fact.child)) {
      const use = this.#refUse(ancestors, present, false, several);
      const narrowing = facts.filter((fact) => fact.kinds);
      // Any member of a union of kinds reads alike where no condition narrows it, and the value
      // flows whole into a local, a result or an assignment alike where none does.
      if (use && (narrowing.length || (shapes && !FLOWS.has(use)))) {
        this.#narrowedRead(node, subject, members, present, use, ancestors, narrowing, fixable);
      }
    }
    if (nullable && this.#refUse(ancestors, declared, true, false)) {
      // The template's own conditional children keep their branches narrowed on every target
      // (Solid's accessor callbacks, Angular's `@if`).
      const render = this.#mode === "render";
      const prop = path.names.length === 0 && this.#context.propsByDeclaration.has(path.root);
      const scope = facts.find(
        (fact) => fact.present && !(render && fact.child) && (fact.scope !== "closure" || prop),
      )?.scope;
      if (scope) return scope;
    }
    // A handler's read that relies on the template's conditional around it narrowing a union of
    // kinds (`{typeof value === "string" && <input onInput={() => use(value)} />}`), which a
    // target reading it again from a mirror must take from the render (ADR-0046).
    const template = facts.some((fact) => fact.kinds && fact.scope === "template");
    if (template && (shapes || several) && this.#refUse(ancestors, present, false, several)) {
      return "template";
    }
    return undefined;
  }

  /**
   * How a ref's value is used where it is read (ADR-0046, UF3031), climbing its ancestors:
   * `undefined` where the use reads alike whatever narrows the value (the receiver of `?.`, a test,
   * an equality, the left of `??`, a string's part, a value passed where `null` and `undefined`
   * are taken, or, for a union of kinds, where all of them are, a local or a result whose type
   * holds every kind), or what relies on its narrowing. The value flowing whole into a local, a
   * function's result, an assignment or, as a literal's member, a call (`FLOWS`) relies on it
   * only where a condition narrows it: the local then holds the narrowed type on Vue and the
   * unnarrowed one where a call reads it.
   */
  #refUse(
    ancestors: readonly AST.Node[],
    declared: Kinds,
    nullable: boolean,
    several: boolean,
  ): string | undefined {
    const { setup } = this.#context;
    // Whether the value is a member of an object or array literal, which then flows whole.
    let literal = false;
    for (let index = ancestors.length - 1; index > 0; index--) {
      const child = ancestors[index]!;
      const parent = ancestors[index - 1]!;
      if (literal && parent.type === "MemberExpression" && parent.object === child) return LITERAL;
      switch (parent.type) {
        case "ParenthesizedExpression":
        case "ChainExpression":
        case "AwaitExpression":
        case "ObjectExpression":
          continue;
        case "Property":
          if (parent.value !== child) return undefined;
          literal = true;
          continue;
        case "ArrayExpression":
          literal = true;
          continue;
        case "TSNonNullExpression":
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSTypeAssertion":
        case "TemplateLiteral":
        case "JSXExpressionContainer":
        case "ExpressionStatement":
        case "SequenceExpression":
        case "ThrowStatement":
        case "IfStatement":
        case "WhileStatement":
        case "DoWhileStatement":
        case "SwitchStatement":
        case "SwitchCase":
          return undefined;
        case "ForStatement":
          return parent.test === child ? undefined : "an expression that relies on it";
        case "ReturnStatement":
          return this.#returnsAll(ancestors.slice(0, index), declared, literal)
            ? undefined
            : RESULT;
        case "ArrowFunctionExpression":
          if (parent.body !== child) return "an expression that relies on it";
          return this.#returnsAll(ancestors.slice(0, index), declared, literal)
            ? undefined
            : RESULT;
        case "MemberExpression": {
          if (parent.object !== child) return "a computed member's key";
          if (parent.optional) return undefined;
          const name =
            !parent.computed && parent.property.type === "Identifier"
              ? parent.property.name
              : undefined;
          // A member every shape of a union declares reads alike in each, as does one every
          // kind has.
          if (
            !nullable &&
            name !== undefined &&
            (sharedMember(declared, name) ||
              (!outside(declared, ["object"]).length &&
                (declared.objects ?? []).every((shape) => shape.members().has(name))))
          ) {
            return undefined;
          }
          return "a member read through `.`";
        }
        case "CallExpression": {
          if (parent.callee === child) return parent.optional ? undefined : "a call";
          const index = parent.arguments.indexOf(child as AST.Argument);
          // A literal goes whole to a parameter whose type the model does not read, but to the
          // globals that take anything (`console.log`, `JSON.stringify`).
          if (literal) return this.#takesAnything(parent) ? undefined : LITERAL;
          return (
            several
              ? this.#takesAll(parent, index, declared)
              : this.#takesNullish(parent, index, setup)
          )
            ? undefined
            : "a call's argument";
        }
        case "NewExpression":
          return literal ? LITERAL : "a call's argument";
        case "LogicalExpression":
          if (parent.left === child) return undefined;
          continue;
        case "ConditionalExpression":
          if (parent.test === child) return undefined;
          continue;
        case "UnaryExpression":
          return parent.operator === "!" ||
            parent.operator === "typeof" ||
            parent.operator === "void"
            ? undefined
            : `the operand of \`${parent.operator}\``;
        case "BinaryExpression":
          if (EQUALITY.has(parent.operator)) return undefined;
          if (parent.operator === "instanceof" && parent.left === child) return undefined;
          if (parent.operator === "+") {
            const other = parent.left === child ? parent.right : parent.left;
            if (
              other.type === "TemplateLiteral" ||
              (other.type === "Literal" && typeof other.value === "string")
            ) {
              return undefined;
            }
          }
          return `an operand of \`${parent.operator}\``;
        case "VariableDeclarator": {
          if (parent.init !== child || parent.id.type !== "Identifier") return "a destructuring";
          // A literal's annotation types the literal, and so the member, as the author wrote it.
          const annotation = parent.id.typeAnnotation?.typeAnnotation;
          if (annotation && literal) return undefined;
          return annotation && fits(declared, this.#context.types.kindsOf(annotation))
            ? undefined
            : LOCAL;
        }
        case "AssignmentExpression": {
          if (parent.right !== child) return "an assignment's target";
          if (literal) return ASSIGNED;
          const target = this.#assignedKinds(parent.left);
          if (target) return fits(declared, target) ? undefined : ASSIGNED;
          return this.#assignsNullish(parent.left) ? undefined : ASSIGNED;
        }
        case "SpreadElement": {
          const holder = ancestors[index - 2];
          return holder?.type === "ObjectExpression" ? undefined : "a spread";
        }
        default:
          return literal ? LITERAL : "an expression that relies on it";
      }
    }
    return undefined;
  }

  /** Whether a call is of a global that takes any value whole (`console.log`, `String`). */
  #takesAnything(call: AST.CallExpression): boolean {
    const { callee } = call;
    const { scopes } = this.#context;
    if (callee.type === "Identifier") {
      return scopes.resolve(callee).kind === "global" && ANY_GLOBALS.has(callee.name);
    }
    if (
      callee.type !== "MemberExpression" ||
      callee.computed ||
      callee.object.type !== "Identifier" ||
      callee.property.type !== "Identifier" ||
      scopes.resolve(callee.object).kind !== "global" ||
      !ANY_GLOBAL_METHODS.has(callee.object.name)
    ) {
      return false;
    }
    const methods = ANY_GLOBAL_METHODS.get(callee.object.name);
    return !methods || methods.has(callee.property.name);
  }

  /**
   * Reports a use that relies on a ref's value's narrowing, or a prop's outside the template
   * (UF3031). Where the conditions that narrow it lie in the read's function, in statements of a
   * block, the likely fix reads it into a local before the first of them (the guard `if`, or the
   * outermost `if` or statement whose `?:` or `&&` narrows), which every target narrows, and
   * reads the local for the value from there; one report for each such statement and value.
   */
  #narrowedRead(
    node: AST.Expression,
    subject: Narrowable,
    members: readonly string[],
    present: Kinds,
    use: string,
    ancestors: readonly AST.Node[],
    facts: readonly PathFact[],
    fixable: boolean,
  ): void {
    const { reporter, source } = this.#context;
    const written =
      subject.kind === "ref" && !members.length
        ? `${subject.binding.name}.value`
        : source.slice(node.start, node.end);
    const anchor = narrowingAnchor(ancestors, facts, this.#context.component);
    const id = subject.kind === "ref" ? subject.binding.id : subject.prop.id;
    if (anchor) {
      const key = `${anchor.statement.start}:${id}:${members.join(".")}`;
      if (this.#narrowingReported.has(key)) return;
      this.#narrowingReported.add(key);
    }
    const kind = severalShapes(present)
      ? "which is one of several object shapes"
      : literalUnion(present)
        ? "which is one of several values"
        : "which is one of several kinds";
    const owner = subject.kind === "prop" ? "prop" : "ref's value";
    const what = members.length ? `member of the ${owner}, ${kind}` : `${owner}, ${kind}`;
    const local = this.#localName(subject, members);
    // An assignment before the read narrows it (`value.value = "a";`): the value written is what
    // a local keeps, so no read moves before it.
    const assigned = facts.some((fact) => fact.condition.type === "AssignmentExpression");
    const fix =
      fixable && anchor && !assigned
        ? this.#readIntoLocal(anchor, subject, members, written)
        : undefined;
    const why =
      subject.kind === "ref"
        ? `Solid and Angular read a ref's value through a call (\`${subject.binding.name}()\`), which TypeScript does not narrow.`
        : `Angular reads an input through a call (\`this.${subject.prop.name}()\`), which TypeScript does not narrow, and React and Solid read a prop as a property (\`props.${subject.prop.name}\`), whose narrowing TypeScript forgets in a nested function.`;
    const by = assigned ? "an assignment before it" : "a condition around it";
    reporter.report(
      "UF3031",
      node,
      `\`${written}\` is used as ${use}, which relies on ${by} narrowing the ${what}: ${why}`,
      {
        help: assigned
          ? `Keep the value in a local, write it from the local, and use the local, which every target narrows: \`const next = …; ${written} = next;\`.`
          : `Read it into a local before the condition that narrows it, and test the local, which every target narrows: \`const ${local[0]} = ${written};\`.`,
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
  }

  /**
   * The reads of a ref's value (`x.value`) or of a prop (`label`, `props.label`) in a tree, or of
   * a member path off it (`x.value.email`) where `members` names one.
   */
  #readsOf(root: AST.Node, subject: Narrowable, members: readonly string[]): AST.Expression[] {
    const { scopes, propsObject } = this.#context;
    const found: AST.Expression[] = [];
    if (members.length) {
      const names = [
        ...(subject.kind === "ref"
          ? ["value"]
          : this.#isObjectForm(subject)
            ? [subject.prop.name]
            : []),
        ...members,
      ];
      visitNodes(root, (child) => {
        if (
          child.type !== "MemberExpression" ||
          found.some((read) => read.end >= child.end && read.start <= child.start)
        )
          return;
        const path = referencePath(child, this.#context);
        if (
          path &&
          path.root === this.#rootOf(subject) &&
          path.names.length === names.length &&
          path.names.every((name, index) => name === names[index])
        ) {
          found.push(child);
        }
      });
      return found;
    }
    visitNodes(root, (child) => {
      if (subject.kind === "ref") {
        if (
          child.type === "MemberExpression" &&
          !child.computed &&
          !child.optional &&
          child.object.type === "Identifier" &&
          child.object.start === child.start &&
          child.property.type === "Identifier" &&
          child.property.name === "value"
        ) {
          const resolution = scopes.resolve(child.object);
          if (
            resolution.kind === "variable" &&
            resolution.declaration === subject.binding.declaration
          ) {
            found.push(child);
          }
        }
        return;
      }
      if (child.type === "Identifier") {
        const resolution = scopes.resolve(child as AST.IdentifierReference);
        if (
          resolution.kind === "parameter" &&
          this.#context.propsByDeclaration.get(resolution.declaration) === subject.prop
        ) {
          found.push(child as AST.IdentifierReference);
        }
      } else if (
        child.type === "MemberExpression" &&
        !child.computed &&
        child.object.type === "Identifier" &&
        child.object.start === child.start &&
        child.property.type === "Identifier" &&
        child.property.name === subject.prop.name
      ) {
        const resolution = scopes.resolve(child.object);
        if (
          resolution.kind === "parameter" &&
          resolution.declaration === propsObject?.declaration
        ) {
          found.push(child);
        }
      }
    });
    return found;
  }

  /** Whether a prop is read through the object form's parameter (`props.label`). */
  #isObjectForm(subject: Narrowable): boolean {
    return subject.kind === "prop" && !this.#context.propsByDeclaration.has(this.#rootOf(subject));
  }

  /** What declares the root of a value's reads: the ref, the destructured prop or `props`. */
  #rootOf(subject: Narrowable): object {
    if (subject.kind === "ref") return subject.binding.declaration;
    for (const [declaration, prop] of this.#context.propsByDeclaration) {
      if (prop === subject.prop) return declaration;
    }
    return this.#context.propsObject!.declaration;
  }

  /** The names the fix of UF3031 may give the local that holds a value, in order. */
  #localName(subject: Narrowable, members: readonly string[]): string[] {
    const last = members.at(-1);
    if (last !== undefined) {
      // The member's own name is taken where the path reads it.
      return isIdentifier(last) && !/^[0-9]/.test(last)
        ? [`current${last[0]!.toUpperCase()}${last.slice(1)}`, "current"]
        : ["item", "current"];
    }
    if (subject.kind === "ref") {
      return subject.binding.kind === "templateRef"
        ? ["el", "element"]
        : [`${subject.binding.name}Value`, "current"];
    }
    const { name } = subject.prop;
    return [`current${name[0]!.toUpperCase()}${name.slice(1)}`, "current"];
  }

  /**
   * The fix of UF3031 at a narrowing's anchor (`narrowingAnchor`): a `const` that reads the value
   * before its statement, and the local for every read of the value in its region. None where the
   * region writes the ref or awaits, after which the value may differ from the local's.
   */
  #readIntoLocal(
    anchor: NarrowingAnchor,
    subject: Narrowable,
    members: readonly string[],
    written: string,
  ): Fix | undefined {
    const { source, component } = this.#context;
    const root = this.#rootOf(subject);
    let changes = false;
    for (const statement of anchor.region) {
      visitNodes(statement, (child) => {
        if (child.type === "AwaitExpression" || (child.type === "ForOfStatement" && child.await)) {
          changes = true;
        }
        const target =
          child.type === "AssignmentExpression"
            ? child.left
            : child.type === "UpdateExpression"
              ? child.argument
              : undefined;
        // A write of the value, or of a member of it.
        if (
          target?.type === "MemberExpression" &&
          referencePath(target, this.#context)?.root === root
        ) {
          changes = true;
        }
      });
    }
    if (changes) return undefined;
    const text = source.slice(component.start, component.end);
    // A name another fix declares in the same block is taken too.
    const declared = this.#fixLocals.get(anchor.block) ?? new Set<string>();
    const taken = (candidate: string) =>
      declared.has(candidate) || new RegExp(`(?<![\\w$])${candidate}(?![\\w$])`).test(text);
    const local = this.#localName(subject, members).find((candidate) => !taken(candidate));
    if (!local) return undefined;
    declared.add(local);
    this.#fixLocals.set(anchor.block, declared);
    const { statement } = anchor;
    const lineStart = source.lastIndexOf("\n", statement.start - 1) + 1;
    const indent = /^[\t ]*/.exec(source.slice(lineStart, statement.start))![0];
    // A read in an object's shorthand (`{ label }`) keeps its key.
    const shorthand = new Set<object>();
    for (const each of anchor.region) {
      visitNodes(each, (child) => {
        if (child.type === "Property" && child.shorthand) shorthand.add(child.value);
      });
    }
    return {
      title: `Read \`${written}\` into \`${local}\` first`,
      confidence: "likely",
      edits: [
        {
          span: { start: statement.start, end: statement.start },
          text: `const ${local} = ${written};\n${indent}`,
        },
        ...anchor.region.flatMap((each) =>
          this.#readsOf(each, subject, members).map((read) => ({
            span: span(read),
            text: shorthand.has(read) ? `${source.slice(read.start, read.end)}: ${local}` : local,
          })),
        ),
      ],
    };
  }

  /**
   * Whether a function returns every kind of a value: where its return type is written and
   * holds them all (UF3031). `ancestors` ends at the `return` or the arrow's body's parent.
   */
  #returnsAll(ancestors: readonly AST.Node[], declared: Kinds, literal: boolean): boolean {
    const fn = ancestors.findLast(
      (node) =>
        node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "FunctionDeclaration",
    ) as AST.Function | AST.ArrowFunctionExpression | undefined;
    const annotation = fn?.returnType?.typeAnnotation;
    if (annotation === undefined) return false;
    // A literal's type is the written result type's, member and all.
    return literal || fits(declared, this.#context.types.kindsOf(annotation));
  }

  /**
   * The kinds an assignment's target holds, where it is a local, a setup `let` or a ref's value
   * (UF3031): `undefined` for any other target.
   */
  #assignedKinds(target: AST.AssignmentTarget): Kinds | undefined {
    if (target.type === "Identifier") {
      const binding = setupBindingOf(target, this.#context);
      if (binding) return binding.kinds;
      const resolution = this.#context.scopes.resolve(target);
      return resolution.kind === "variable" || resolution.kind === "parameter"
        ? this.#locals.get(resolution.declaration)?.kinds
        : undefined;
    }
    if (
      target.type === "MemberExpression" &&
      !target.computed &&
      target.object.type === "Identifier" &&
      target.property.type === "Identifier" &&
      target.property.name === "value"
    ) {
      const binding = setupBindingOf(target.object, this.#context);
      if (binding && isRef(binding)) return binding.kinds;
    }
    return undefined;
  }

  /**
   * Whether a call's argument at `index` takes every kind of a union, so that passing the value
   * needs no narrowing (UF3031): a local function's parameter whose type holds them all, and, for
   * a union of literals, any other call's (an emit's payload, a method's argument), which takes
   * the union's own type in practice.
   */
  #takesAll(call: AST.CallExpression, index: number, declared: Kinds): boolean {
    const { callee } = call;
    if (call.arguments.some((argument, at) => at <= index && argument.type === "SpreadElement")) {
      return false;
    }
    const literals = literalUnion(declared);
    if (callee.type === "Identifier") {
      const resolution = this.#context.scopes.resolve(callee);
      if (resolution.kind === "global") return ANY_GLOBALS.has(callee.name) || literals;
      const binding = setupBindingOf(callee, this.#context);
      if (binding?.kind === "localFn") {
        const parameter = binding.function?.params[index];
        if (!parameter) return false;
        if (parameter.type === "AssignmentPattern") return true;
        if (parameter.type !== "Identifier") return false;
        if (!parameter.typeAnnotation) return true;
        return fits(declared, this.#context.types.kindsOf(parameter.typeAnnotation.typeAnnotation));
      }
      return literals;
    }
    if (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.property.type === "Identifier" &&
      this.#context.scopes.resolve(callee.object).kind === "global" &&
      ANY_GLOBAL_METHODS.has(callee.object.name)
    ) {
      const methods = ANY_GLOBAL_METHODS.get(callee.object.name);
      if (!methods || methods.has(callee.property.name)) return true;
    }
    return literals;
  }

  /** Whether a call's argument at `index` may be `null` or `undefined` (UF3031). */
  #takesNullish(call: AST.CallExpression, index: number, setup: RenderContext["setup"]): boolean {
    const { callee } = call;
    if (call.arguments.some((argument, at) => at <= index && argument.type === "SpreadElement")) {
      return false;
    }
    if (callee.type === "Identifier") {
      const resolution = this.#context.scopes.resolve(callee);
      if (resolution.kind === "global") return ANY_GLOBALS.has(callee.name);
      const binding = setupBindingOf(callee, this.#context);
      if (binding?.kind === "emit") {
        const first = call.arguments[0];
        const name =
          first?.type === "Literal" && typeof first.value === "string" ? first.value : undefined;
        const payload = name === undefined ? undefined : setup.events?.get(name);
        return index > 0 && payload?.nullable[index - 1] === true;
      }
      if (binding?.kind === "localFn") {
        const parameter = binding.function?.params[index];
        if (!parameter) return false;
        if (parameter.type === "AssignmentPattern") return true;
        if (parameter.type !== "Identifier") return false;
        if (parameter.optional || !parameter.typeAnnotation) return true;
        const kindsOf = this.#context.types.kindsOf(parameter.typeAnnotation.typeAnnotation);
        return mayBeNullish(kindsOf);
      }
      return false;
    }
    if (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.property.type === "Identifier" &&
      this.#context.scopes.resolve(callee.object).kind === "global" &&
      ANY_GLOBAL_METHODS.has(callee.object.name)
    ) {
      const methods = ANY_GLOBAL_METHODS.get(callee.object.name);
      return !methods || methods.has(callee.property.name);
    }
    return false;
  }

  /** Whether an assignment's target may hold `null` or `undefined` (UF3031). */
  #assignsNullish(target: AST.AssignmentTarget): boolean {
    if (target.type === "Identifier") {
      const binding = setupBindingOf(target, this.#context);
      if (binding) return mayBeNullish(binding.kinds);
      const resolution = this.#context.scopes.resolve(target);
      const local =
        resolution.kind === "variable" || resolution.kind === "parameter"
          ? this.#locals.get(resolution.declaration)
          : undefined;
      return !local || mayBeNullish(local.kinds);
    }
    if (target.type === "MemberExpression" && target.object.type === "Identifier") {
      const binding = setupBindingOf(target.object, this.#context);
      if (binding && isRef(binding)) return mayBeNullish(binding.kinds);
    }
    return target.type === "MemberExpression";
  }

  /** Whether an identifier reads the event parameter of the function being lowered. */
  #isEvent(node: AST.IdentifierReference): boolean {
    if (!this.#event) return false;
    const resolution = this.#context.scopes.resolve(node);
    return resolution.kind === "parameter" && resolution.declaration === this.#event.declaration;
  }

  /**
   * A member of the event parameter, `event.key` or `event.preventDefault()` (ADR-0047): an
   * `Event` reference, which Qwik rewrites (`currentTarget` is its handler's second argument). A
   * member every target's event object carries is the rules' to check (UF3032), as is any other
   * use of the event.
   */
  #eventMember(node: AST.MemberExpression, call: boolean): Kinds {
    const { reporter, source } = this.#context;
    const event = this.#event!;
    const local = this.#locals.get(event.declaration);
    if (local) local.read = true;
    if (node.computed || node.property.type !== "Identifier") {
      if (node.computed) this.value(node.property, "value", false);
      this.#eventProblem(
        node,
        "A handler's event is read through its members by name: React's synthetic event and the DOM's share only some members, which the compiler checks by name.",
      );
      return UNKNOWN;
    }
    const member = node.property.name;
    // An event whose interface the parameter's does not take is a handler's own problem (UF3029).
    const received = event.events.filter((name) =>
      extendsEventInterface(DOM_EVENTS.get(name) ?? "Event", event.interface),
    );
    const lacking = [
      event.interface,
      ...received.map((name) => PORTABLE_EVENT_INTERFACES.get(name) ?? event.interface),
    ].find((name) => !PORTABLE_EVENT_MEMBERS.get(name)?.has(member));
    if (lacking !== undefined) {
      const events = received.map((name) => `\`${name}\``).join(", ");
      this.#eventProblem(
        node,
        `\`${source.slice(node.start, node.end)}\` is not a member every target's event has: React's synthetic ${lacking === "Event" ? "event" : lacking}${events ? ` for ${events}` : ""} lacks \`${member}\`, so React's output could not read it.`,
      );
      return UNKNOWN;
    }
    if (EVENT_METHODS.has(member) !== call) {
      this.#eventProblem(
        node,
        EVENT_METHODS.has(member)
          ? `\`${member}\` is a method of the event, which a handler only calls: \`${source.slice(node.start, node.end)}()\`.`
          : `\`${member}\` is no method of the event: a handler reads it.`,
      );
      return UNKNOWN;
    }
    if (node.optional) {
      const token = findToken(source, node.object.end, node.property.start, "?.");
      if (token) {
        reporter.report(
          "UF3023",
          { start: token.start, end: token.start + 2 },
          "`?.` reads from the event, which is never null or undefined, so it does nothing.",
          {
            help: "Write `.`.",
            fixes: [
              {
                title: "Write `.`",
                confidence: "safe",
                edits: [{ span: { start: token.start, end: token.start + 2 }, text: "." }],
              },
            ],
          },
        );
      }
      return UNKNOWN;
    }
    this.refs.push(createEventReference(node.property.name, span(node), call));
    return UNKNOWN;
  }

  /**
   * A reference's kinds where it is read, as the conditions around it narrow them on every
   * target (`./narrowing.ts`), as TypeScript does: without `null` and `undefined` where they show
   * it present, and with only the kinds a `typeof`, an `Array.isArray`, a literal or a
   * discriminant leaves. Where some target's checker does not narrow it (`#readApart`), a use
   * that relies on the narrowing is reported. Only a template's: setup code is script or class
   * code, which TypeScript checks as the source.
   */
  #narrowed(node: AST.Expression, kindsOf: Kinds): Kinds {
    if (this.#mode !== "render") return kindsOf;
    const nullable = has(kindsOf, "null") || has(kindsOf, "undefined");
    const several = isUnion(kindsOf);
    if (!nullable && !several && !hasLiterals(kindsOf)) return kindsOf;
    const context = this.#context;
    const path = referencePath(node, context);
    if (!path) return kindsOf;
    const narrowing: Narrowing =
      nullable || several ? narrowingAt(node, path, context) : { kind: "declared" };
    // A value a condition shows absent keeps its kinds: what reads it is reported for that
    // (`#readAbsent`, a spread's UF3004).
    if (narrowing.kind === "absent") return kindsOf;
    const narrowed = narrowedKinds(node, path, kindsOf, context);
    if (narrowing.kind === "unfollowed" && narrowing.reason !== "form") {
      this.#readApart(node, narrowing);
    } else if (narrowed.apart) {
      this.#readApart(node, { kind: "unfollowed", ...narrowed.apart });
    }
    return nullable && narrowing.kind === "present"
      ? without(narrowed.kinds, "null", "undefined")
      : narrowed.kinds;
  }

  /**
   * Reports `?.` or `??` on a reference that a condition around it tests where the targets'
   * checkers read it differently (UF1002): Angular's rejects the operator where it narrows the
   * reference (NG8107, NG8102), and some target's checker rejects the reference without it.
   */
  #narrowedApart(operand: AST.Expression | AST.Super, at: Span, operator: "?." | "??"): boolean {
    if (operand.type === "Super") return false;
    const context = this.#context;
    const path = referencePath(operand, context);
    if (!path || !angularChecks(path, context)) return false;
    const narrowing = narrowingAt(operand, path, context);
    // Angular forgets a member's narrowing in an arrow function, and never narrows a prop its
    // `track` reads: the operator passes it there.
    if (narrowing.kind !== "unfollowed") return false;
    if (narrowing.reason === "closure" || narrowing.reason === "key") return false;
    const { message, help } = narrowedApart(operator, narrowing.reason);
    context.reporter.report("UF1002", at, message, {
      help,
      related: [{ span: span(narrowing.condition), message: "The condition tests it here" }],
    });
    return true;
  }

  /**
   * Reports a use of a value that relies on a narrowing some target's checker does not see
   * (UF1002): in a list's callback or an arrow function, where TypeScript forgets a property's
   * narrowing (a member, the object form, and a prop an expression's conditional narrows,
   * which Solid copies with `props.x`), or in a list's key, which Angular's `track` reads from
   * the input again. Testing it, passing it to `?.` or `??`, comparing it for equality and
   * writing it into a string read alike (`usedLoosely`). Where the compiler does not follow the
   * condition, every target narrows as TypeScript does, and the source's own type check decides.
   */
  #readApart(node: AST.Expression, narrowing: Extract<Narrowing, { kind: "unfollowed" }>): void {
    if (narrowing.reason === "form") return;
    // A member of a value reported already says nothing new.
    let object: AST.Expression | AST.Super = node;
    while (object.type === "MemberExpression" || object.type === "ChainExpression") {
      object = object.type === "ChainExpression" ? object.expression : object.object;
      if (this.#apart.has(object)) {
        this.#apart.add(node);
        return;
      }
    }
    const context = this.#context;
    const use = usedLoosely(node, context);
    if (use === true) return;
    this.#apart.add(node);
    const path = referencePath(node, context)!;
    const { message, help } = readApart(narrowing.reason, angularChecks(path, context));
    const report = () =>
      context.reporter.report("UF1002", node, message, {
        help,
        related: [{ span: span(narrowing.condition), message: "The condition tests it here" }],
      });
    // A `+` concatenates where its other side is a string, which `#binary` knows once read.
    if (use === false) report();
    else this.#concatenations.set(use, [...(this.#concatenations.get(use) ?? []), report]);
  }

  /**
   * Reports a member read of a value that a condition around it shows to be absent (UF1002):
   * TypeScript types it `never` there, and the targets whose checkers keep the narrowing reject
   * the read, through `?.` too.
   */
  #readAbsent(object: AST.Expression | AST.Super, receiver: Kinds): void {
    if (object.type === "Super" || !receiver.objects?.length) return;
    const context = this.#context;
    const path = referencePath(object, context);
    if (!path) return;
    const narrowing = narrowingAt(object, path, context);
    if (narrowing.kind !== "absent") return;
    context.reporter.report(
      "UF1002",
      object,
      "Reading a member of a value that a condition around it shows to be absent is not supported: TypeScript types the value `never` there, and the targets' checkers reject the read.",
      {
        help: "Remove the read, which is always absent here, or test the value so that it is there.",
        related: [{ span: span(narrowing.condition), message: "The condition tests it here" }],
      },
    );
  }

  /** `(props).label`, which is written `props.label` (UF2001): the targets splice it as one name. */
  #parenthesisedProps(node: AST.MemberExpression, object: AST.IdentifierReference): void {
    const { source, reporter } = this.#context;
    const token = findToken(source, object.end, node.property.start, node.optional ? "?." : ".");
    reporter.report(
      "UF2001",
      { start: node.start, end: token?.start ?? object.end },
      `\`${object.name}\` is read without parentheses: a prop is \`${object.name}.${source.slice(node.property.start, node.property.end)}\`.`,
      {
        help: "Remove the parentheses.",
        fixes: token
          ? [
              {
                title: "Remove the parentheses",
                confidence: "safe",
                edits: [{ span: { start: node.start, end: token.start }, text: object.name }],
              },
            ]
          : [],
      },
    );
  }

  /**
   * `Math.random`, by dot, bracket or optional access, reads chance (UF3019): in a template, a
   * getter or an initial value, which the server runs too; client code notes it for the
   * templates and getters that call it.
   */
  #random(node: AST.MemberExpression, name: string | undefined): void {
    const { object } = node;
    if (
      name === "random" &&
      object.type === "Identifier" &&
      object.name === "Math" &&
      this.#isGlobal(object)
    ) {
      this.#nondeterminism(node, "`Math.random` reads chance");
    }
  }

  /** A method that reads the machine's locale (UF3019), in a getter, an initial value or client code. */
  #locale(property: AST.Node, name: string): void {
    if (this.#mode === "render" || !LOCALE_METHODS.has(name)) return;
    this.#nondeterminism(property, `\`${name}\` formats by the machine's locale`);
  }

  /** Reports what reads chance or the machine (UF3019), or notes it in client code. */
  #nondeterminism(node: { start: number; end: number }, reason: string): void {
    if (this.#mode === "client") {
      this.nondeterministic ??= reason;
      return;
    }
    this.#context.reporter.report(
      "UF3019",
      node,
      this.#mode === "render"
        ? `${reason}, so the server's render and the browser's would differ.`
        : `${reason}, and a getter or an initial value runs on the server too: the server's render and the browser's would differ.`,
      {
        help:
          this.#mode === "render"
            ? "Pass the value in as a prop, computed where it is decided."
            : "Pass the value in as a prop, or set it from client code (`onMounted`, a handler).",
      },
    );
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
      this.#unsupported(
        property,
        this.#mode === "render"
          ? "Private members are not supported in template expressions."
          : "Private members are not supported in setup code.",
      );
      return undefined;
    }
    if (this.#mode !== "render") return property.name;
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
    operand: AST.Expression | AST.Super,
    next: number,
    kindsOf: Kinds,
    replacement: string,
  ): void {
    const token = findToken(this.#context.source, operand.end, next, "?.");
    if (!token) return;
    if (mayBeNullish(kindsOf)) {
      this.#narrowedApart(operand, { start: token.start, end: token.start + 2 }, "?.");
      return;
    }
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

  #call(node: AST.CallExpression, position: Position): Kinds {
    const render = this.#mode === "render";
    const context = this.#context;
    if (node.typeArguments && render) {
      this.#unsupported(
        node.typeArguments,
        "Type arguments on a call are not supported in template expressions yet: Angular's templates have no TypeScript syntax.",
      );
    }
    const { callee } = node;
    const tick = this.#mode === "client" ? this.#tickCallee(node) : undefined;
    if (tick) {
      // Called through parentheses, an assertion or type arguments: UF2025, with the bare call.
      this.#wrappedTick(node, tick);
      this.refs.push(createApiReference("nextTick", span(tick)));
      // `await nextTick()` is the one form (UF2025, reported once everything is lowered): a
      // callback runs later, and its value is no one's, so its code is judged as such.
      if (node.arguments.length) {
        context.facts.tickCallbacks.push(node);
        for (const argument of node.arguments) {
          if (argument.type === "ArrowFunctionExpression") {
            this.#arrowUses.set(argument, "callback");
          }
        }
      }
      this.#arguments(node.arguments, [], "later");
      return kinds("object");
    }
    if (callee.type === "Identifier") {
      const resolution = context.scopes.resolve(callee);
      if (resolution.kind === "import" && context.setup.authoring.has(resolution.declaration)) {
        const api = context.setup.authoring.get(resolution.declaration);
        // A call the import reports, or a macro in the wrong place, whose arguments would say
        // nothing more.
        if (api !== undefined) this.#misplaced(callee, api, true);
        this.#skip(node.arguments);
        return UNKNOWN;
      }
      if (resolution.kind === "variable" && resolution.scope === context.component) {
        const binding = context.setup.bindings.get(resolution.declaration);
        if (binding?.kind === "emit") return this.#emit(node, binding, position);
        if (binding?.kind === "localFn") {
          if (node.optional) {
            const token = findToken(context.source, callee.end, node.end, "?.");
            if (token) {
              context.reporter.report(
                "UF3023",
                { start: token.start, end: token.start + 2 },
                `\`${binding.name}\` is a local function, which is never null or undefined, so \`?.\` does nothing.`,
                {
                  help: "Remove `?.`.",
                  fixes: [
                    {
                      title: "Remove `?.`",
                      confidence: "safe",
                      edits: [{ span: { start: token.start, end: token.start + 2 }, text: "" }],
                    },
                  ],
                },
              );
            }
          }
          this.refs.push(createBindingReference(binding.id, span(callee), false, true));
          if (this.#mode === "client" && this.#synchronous > 0) {
            context.facts.nestedCalls.push({ binding: binding.id, span: span(callee) });
          }
          this.#passEvent(node, binding);
          this.#arguments(node.arguments, [], "now", { name: binding.name, arrayMethod: false });
          return binding.kinds;
        }
      }
    }
    if (
      callee.type === "MemberExpression" &&
      callee.object.type === "Identifier" &&
      this.#isEvent(callee.object)
    ) {
      this.#known.set(callee, this.#eventMember(callee, !callee.computed));
      this.#arguments(node.arguments, []);
      return UNKNOWN;
    }
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
      if (name !== undefined) {
        if (render) this.#checkMethod(callee, name);
        else this.#mutatingCall(node, callee, name, position);
        this.#locale(callee.property, name);
      }
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
        if (callee.name === "Array" && render) {
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
      if (render) this.#optional(callee, next, calleeKinds, "");
      if (mayBeNullish(calleeKinds)) this.shortCircuits = true;
    }
    this.#noteArrowUses(node);
    this.#arguments(node.arguments, parameters, this.#runs(callee), {
      name: calleeName(callee),
      arrayMethod: parameters.length > 0,
    });
    if (node.optional && mayBeNullish(calleeKinds)) result = union(result, UNDEFINED);
    return result;
  }

  /**
   * The `nextTick` a call of client code calls, its identifier, where the callee is that import
   * itself or wrapped in parentheses, an assertion or type arguments (`(nextTick)()`), which
   * `#wrappedTick` reports.
   */
  #tickCallee(node: AST.CallExpression): AST.IdentifierReference | undefined {
    let inner: AST.Expression | AST.Super = node.callee;
    while (
      inner.type === "ParenthesizedExpression" ||
      inner.type === "TSAsExpression" ||
      inner.type === "TSSatisfiesExpression" ||
      inner.type === "TSNonNullExpression" ||
      inner.type === "TSTypeAssertion" ||
      inner.type === "TSInstantiationExpression"
    ) {
      inner = inner.expression;
    }
    if (inner.type !== "Identifier") return undefined;
    const resolution = this.#context.scopes.resolve(inner);
    return resolution.kind === "import" &&
      this.#context.setup.authoring.get(resolution.declaration) === "nextTick"
      ? inner
      : undefined;
  }

  /**
   * Reports a call of `nextTick` through parentheses, an assertion or type arguments (UF2025):
   * every target writes its own call in place of the bare `nextTick()`, which the IR's `Api`
   * reference spans. The safe fix writes it bare.
   */
  #wrappedTick(node: AST.CallExpression, tick: AST.IdentifierReference): void {
    const { source, reporter } = this.#context;
    // The parser keeps no node for parentheses: the call starts at the first one, and the closing
    // ones follow the callee.
    let end = node.typeArguments?.end ?? node.callee.end;
    for (let next = skipTrivia(source, end); source[next] === ")"; next = skipTrivia(source, end)) {
      end = next + 1;
    }
    const at = { start: node.start, end };
    if (at.start === tick.start && at.end === tick.end) return;
    // The fix would drop a comment written inside.
    const commented = this.#context.comments.some(
      (comment) => comment.start >= at.start && comment.end <= at.end,
    );
    reporter.report(
      "UF2025",
      at,
      `\`${source.slice(at.start, at.end)}\` calls \`${tick.name}\` through ${node.typeArguments ? "type arguments" : "parentheses or an assertion"}: \`await ${tick.name}()\` is its one form, which each target replaces with its own call.`,
      {
        help: `Call it bare: \`await ${tick.name}()\`.`,
        ...(commented
          ? {}
          : {
              fixes: [
                {
                  title: `Call \`${tick.name}\` bare`,
                  confidence: "safe" as const,
                  edits: [{ span: at, text: tick.name }],
                },
              ],
            }),
      },
    );
  }

  /** Notes the arrows a call is given that it does nothing with the value of (`#arrowUses`). */
  #noteArrowUses(node: AST.CallExpression): void {
    if (this.#mode !== "client") return;
    const { callee } = node;
    let use: "callback" | "discarded" | undefined;
    if (callee.type === "Identifier") {
      const resolution = this.#context.scopes.resolve(callee);
      if (resolution.kind === "parameter" && resolution.declaration === this.#onCleanup) {
        use = "callback";
      } else if (resolution.kind === "global" && DISCARDING_GLOBALS.has(callee.name)) {
        use = "discarded";
      }
    } else if (
      callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.property.type === "Identifier" &&
      DISCARDING_METHODS.has(callee.property.name)
    ) {
      use = "discarded";
    }
    if (!use) return;
    for (const argument of node.arguments) {
      if (argument.type === "ArrowFunctionExpression") this.#arrowUses.set(argument, use);
    }
  }

  /**
   * When a call runs the callbacks it is given (UF2024): later, never while it runs (the timers,
   * `queueMicrotask`, `requestAnimationFrame`, a promise's `then`, `catch` and `finally`,
   * `addEventListener` and a watcher's `onCleanup`); never (`removeEventListener`, and the
   * functions that clear a timer or cancel a frame); or, for any other call, perhaps at once.
   */
  #runs(callee: AST.Expression | AST.Super): Runs {
    if (callee.type === "Identifier") {
      const resolution = this.#context.scopes.resolve(callee);
      if (resolution.kind === "global") {
        if (DEFERRING_GLOBALS.has(callee.name)) return "later";
        return NON_CALLING_GLOBALS.has(callee.name) ? "never" : "now";
      }
      return resolution.kind === "parameter" && resolution.declaration === this.#onCleanup
        ? "later"
        : "now";
    }
    if (
      callee.type !== "MemberExpression" ||
      callee.computed ||
      callee.property.type !== "Identifier"
    ) {
      return "now";
    }
    const { name } = callee.property;
    // `window.setTimeout(…)` is the global itself.
    const global =
      callee.object.type === "Identifier" &&
      callee.object.name === "window" &&
      this.#context.scopes.resolve(callee.object).kind === "global";
    if (DEFERRING_METHODS.has(name) || (global && DEFERRING_GLOBALS.has(name))) return "later";
    return NON_CALLING_METHODS.has(name) || (global && NON_CALLING_GLOBALS.has(name))
      ? "never"
      : "now";
  }

  /**
   * When a constructor runs the callbacks it is given: an observer's (`new ResizeObserver(…)`,
   * `new window.ResizeObserver(…)`) later, any other's perhaps at once.
   */
  #constructs(callee: AST.Expression): Runs {
    const global = (node: AST.Expression) =>
      node.type === "Identifier" && this.#context.scopes.resolve(node).kind === "global";
    if (callee.type === "Identifier") {
      return DEFERRING_CONSTRUCTORS.has(callee.name) && global(callee) ? "later" : "now";
    }
    return callee.type === "MemberExpression" &&
      !callee.computed &&
      callee.object.type === "Identifier" &&
      callee.object.name === "window" &&
      global(callee.object) &&
      callee.property.type === "Identifier" &&
      DEFERRING_CONSTRUCTORS.has(callee.property.name)
      ? "later"
      : "now";
  }

  /**
   * Notes the handler's event passed whole to a local function's event parameter (UF3032): the
   * only use of the event besides its members.
   */
  #passEvent(node: AST.CallExpression, binding: SetupBinding): void {
    const event = this.#event;
    const fn = binding.function;
    if (!event || !fn) return;
    const parameter = this.#context.setup.eventParameters.get(fn);
    const argument = parameter ? node.arguments[parameter.index] : undefined;
    if (argument?.type !== "Identifier") return;
    const resolution = this.#context.scopes.resolve(argument);
    if (resolution.kind === "parameter" && resolution.declaration === event.declaration) {
      this.#wholeEvents.add(argument);
    }
  }

  /**
   * A call of a method that changes its receiver (UF2004, ADR-0045): an array's, a `Map`'s or a
   * `Set`'s, or `Object.assign` and its kin, which change their first argument; or one that changes
   * an element the framework renders (UF3028): its structure or text, its classes, its style or
   * its attributes.
   */
  #mutatingCall(
    node: AST.CallExpression,
    callee: AST.MemberExpression,
    name: string,
    position: Position,
  ): void {
    const { object } = callee;
    if (object.type === "Super") return;
    if (
      MUTATING_OBJECT_FUNCTIONS.has(name) &&
      object.type === "Identifier" &&
      object.name === "Object" &&
      this.#context.scopes.resolve(object).kind === "global"
    ) {
      const [target] = node.arguments;
      if (target && target.type !== "SpreadElement") {
        this.#mutation(node, target, `\`Object.${name}\` changes`, position, undefined);
      }
      return;
    }
    const part = elementPart(object);
    if (part && PART_METHODS[part.part].has(name) && this.#rendered(part.owner)) {
      this.#renderedChange(node, `\`${part.part}.${name}()\``, part.part, part.owner);
      return;
    }
    // An element's `classList.add(…)` or `style.setProperty(…)` changes no collection state holds.
    if (part && PART_METHODS[part.part].has(name)) return;
    if (ATTRIBUTE_METHODS.has(name) && this.#rendered(object)) {
      // Only the `class` and `style` attributes are a binding's to patch (see `#renderedChange`).
      const [first] = node.arguments;
      const named =
        first?.type === "Literal" && typeof first.value === "string" ? first.value : undefined;
      for (const [attribute, owned] of [
        ["class", "classList"],
        ["style", "style"],
      ] as const) {
        if (named === undefined || named.toLowerCase() === attribute) {
          if (this.#renderedChange(node, `\`${name}()\``, owned, object)) break;
        }
      }
      return;
    }
    if (!part && DOM_MANIPULATING_METHODS.has(name) && this.#rendered(object)) {
      this.#domManipulation(node, name, true);
      return;
    }
    if (MUTATING_METHODS.has(name) || COLLECTION_METHODS.has(name)) {
      this.#mutation(node, object, `\`${name}\` changes`, position, { node, callee, name });
    }
  }

  /**
   * Reports a change of what `object` holds, in place (UF2004), unless it holds a value code may
   * change (ADR-0045): one the code just built itself, not what that value holds; a deep copy and
   * all it holds; the DOM; a global; or a name that only ever holds one of these (`./origins.ts`).
   * The likely fix replaces a ref's value whole where the result is not used.
   */
  #mutation(
    node: AST.Expression,
    object: AST.Expression,
    how: string,
    position: Position,
    call: { node: AST.CallExpression; callee: AST.MemberExpression; name: string } | undefined,
  ): void {
    const origin = this.#originOf(object, new Set());
    if (mutable(origin)) return;
    const { source, reporter } = this.#context;
    const text = source.slice(object.start, object.end);
    const fix = this.#replaceWhole(node, object, position, call);
    reporter.report(
      "UF2004",
      node,
      `${how} ${origin.what ?? `\`${text.length > 40 ? `${text.slice(0, 40)}…` : text}\``} in place: state is replaced whole (ADR-0008), and no target sees a change made in place.`,
      {
        help: origin.shared
          ? "Code may change in place an array or an object it builds itself, but not what it holds: a copy written with a spread, `slice` or `Array.from` shares its members with the value it copies. Copy what you change too, and write the copy whole (`items.value = items.value.map((item) => (item.id === id ? { ...item, done: true } : item))`), or copy deeply with `structuredClone(…)`."
          : "Build a new value and write it: `items.value = [...items.value, item]`, `user.value = { ...user.value, name }`, `toSorted`, `toSpliced`. Code may change in place an array or an object it builds itself (a literal, `new Map()`, a copy), but not what a shallow copy holds (`structuredClone(…)` copies deeply); an element, the event and a global; and a local or a setup `let` that only ever holds one of these.",
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
  }

  /** The likely fix of UF2004 on a ref's value: the same change, as a new value written whole. */
  #replaceWhole(
    node: AST.Expression,
    object: AST.Expression,
    position: Position,
    call: { node: AST.CallExpression; callee: AST.MemberExpression; name: string } | undefined,
  ): Fix | undefined {
    if (position !== "statement" && position !== "discarded") return undefined;
    if (object.type !== "MemberExpression" || object.object.type !== "Identifier") return undefined;
    const binding = setupBindingOf(object.object, this.#context);
    const { source } = this.#context;
    const written = `${binding?.name}.value`;
    if (binding?.kind !== "state" || source.slice(object.start, object.end) !== written) {
      return undefined;
    }
    const edits: Fix["edits"] = [];
    let title: string;
    if (call) {
      const { callee, name } = call;
      const args = call.node.arguments;
      if (call.node.optional || callee.optional || callee.computed) return undefined;
      if (name === "push" || name === "unshift") {
        if (!args.length) return undefined;
        const first = args[0]!;
        const last = args.at(-1)!;
        edits.push(
          {
            span: { start: object.end, end: first.start },
            text: name === "push" ? ` = [...${written}, ` : " = [",
          },
          {
            span: { start: last.end, end: call.node.end },
            text: name === "push" ? "]" : `, ...${written}]`,
          },
        );
        title =
          name === "push"
            ? `Write \`${written} = [...${written}, …]\``
            : `Write \`${written} = […, ...${written}]\``;
      } else {
        const copy = MUTATING_METHODS.get(name);
        if (!copy) return undefined;
        edits.push(
          { span: { start: object.end, end: object.end }, text: ` = ${written}` },
          { span: span(callee.property), text: copy },
        );
        title = `Write \`${written} = ${written}.${copy}(…)\``;
      }
    } else {
      if (node.type !== "AssignmentExpression" || node.operator !== "=") return undefined;
      const target = node.left;
      if (target.type !== "MemberExpression" || target.computed) return undefined;
      const key = target.property.type === "Identifier" ? target.property.name : undefined;
      if (
        key === undefined ||
        node.right.end !== node.end ||
        !new RegExp(`^\\s*\\.\\s*${key}\\s*=\\s*$`).test(source.slice(object.end, node.right.start))
      ) {
        return undefined;
      }
      const held = binding.kinds;
      if (key === "length" && has(held, "array") && !outside(held, ["array"]).length) {
        // An array's `length` cuts it short: a copy of its start, or none of it.
        const right = unwrapExpression(node.right);
        if (right.type === "SequenceExpression") return undefined;
        const empty = right.type === "Literal" && right.value === 0;
        edits.push({
          span: { start: object.end, end: node.end },
          text: empty
            ? " = []"
            : ` = ${written}.slice(0, ${source.slice(node.right.start, node.right.end)})`,
        });
        title = empty
          ? `Write \`${written} = []\``
          : `Write \`${written} = ${written}.slice(0, …)\``;
      } else if (
        // An object spread copies an object's own members: never an array's, a `Map`'s, a `Set`'s
        // or what the model cannot tell.
        has(held, "object") &&
        !has(held, "unknown") &&
        !outside(held, ["object", "null", "undefined"]).length &&
        held.objects?.length
      ) {
        edits.push(
          {
            span: { start: object.end, end: node.right.start },
            text: ` = { ...${written}, ${key}: `,
          },
          { span: { start: node.end, end: node.end }, text: " }" },
        );
        title = `Write \`${written} = { ...${written}, ${key}: … }\``;
      } else {
        return undefined;
      }
    }
    // An arrow's expression body that becomes a write is written in parentheses.
    const body = this.#bodies.get(node);
    if (body && source[body.start] !== "(") {
      edits.push(
        { span: { start: node.start, end: node.start }, text: "(" },
        { span: { start: node.end, end: node.end }, text: ")" },
      );
    }
    return { title, confidence: "likely", edits };
  }

  /** Reports a change of a rendered element's structure or text (UF3028). */
  #domManipulation(node: { start: number; end: number }, name: string, method: boolean): void {
    this.#context.reporter.report(
      "UF3028",
      node,
      `${method ? `\`${name}()\`` : `Setting \`${name}\``} changes the element's ${name.startsWith("insert") || method ? "structure" : "text"} behind its framework's back: every framework renders the element from state, and Vue's, React's and Svelte's would undo or trip over the change.`,
      {
        help: "Render it from state: keep what the element shows in a ref, and let the template render it.",
      },
    );
  }

  /**
   * Reports a change of a rendered element's classes or style where its template binds them
   * (UF3028), and returns whether it did: each target patches a bound `class` or `style` its own
   * way, so a change it did not make survives on some (Angular's class binding keeps a class it
   * did not add) and is undone on others (Qwik writes the whole bound `style` attribute). No
   * framework touches a class, a style or an attribute its template does not bind, and every
   * target compares an attribute it binds with its last value, not the DOM's, so a change there
   * (`dataset`, `setAttribute`) lasts alike everywhere and is not reported. An element the
   * analyser ties to template refs is judged by the elements they attach to, a listener's
   * `event.currentTarget` by the elements whose listeners pass that event, and its `event.target`
   * by those and what they hold; any other (a node reached from one, a document listener's
   * event, an iteration's) by every element of the template.
   */
  #renderedChange(
    node: { start: number; end: number },
    what: string,
    part: "classList" | "style" | "dataset",
    owner: AST.Expression | AST.Super,
  ): boolean {
    if (part === "dataset") return false;
    const attribute = part === "classList" ? "class" : "style";
    const elements = this.#elementsOf(owner, new Set());
    const binds = [...(elements ?? templateElements(this.#context))].some(
      (element) => element[attribute],
    );
    if (!binds) return false;
    const whose = elements
      ? `an element whose \`${attribute}\` the template binds`
      : `an element that may be one whose \`${attribute}\` the template binds`;
    const [changes, after, bind] =
      part === "classList"
        ? [
            "classes",
            "Angular keeps a class it did not add, while the others drop it",
            "`class={{ flash: flashing.value }}`",
          ]
        : [
            "style",
            "Qwik writes the whole `style` attribute again, dropping a property it did not set, while the others keep it",
            "`style={{ height: height.value }}`",
          ];
    this.#context.reporter.report(
      "UF3028",
      node,
      `${what} changes the ${changes} of ${whose}, behind its framework's back: when it next renders ${part === "style" ? "it" : "them"}, ${after}.`,
      {
        help: `Render it from state: keep it in a ref and bind it in the template (${bind}), or change the ${changes} of an element whose \`${attribute}\` the template does not bind.`,
      },
    );
    return true;
  }

  /**
   * The template's elements an expression may be (UF3028): a template ref's value, a listener's
   * `event.currentTarget` (the elements whose listeners pass it the event) or `event.target` (and
   * what those hold), or a local that only ever holds one of these; `undefined` where it may be
   * any (a node reached from one, a document listener's event).
   */
  #elementsOf(
    node: AST.Expression | AST.Super,
    visiting: Set<object>,
  ): Set<TemplateElement> | undefined {
    const inner = unwrapExpression(node);
    const context = this.#context;
    switch (inner.type) {
      case "MemberExpression": {
        if (inner.object.type !== "Identifier" || inner.computed) return undefined;
        const name = memberName(inner);
        const binding = setupBindingOf(inner.object, context);
        if (binding?.kind === "templateRef") {
          if (name !== "value") return undefined;
          return new Set(
            templateElements(context).filter((element) => element.refs.includes(binding)),
          );
        }
        if (name !== "currentTarget" && name !== "target") return undefined;
        const resolution = context.scopes.resolve(inner.object);
        if (resolution.kind !== "parameter") return undefined;
        const fn = resolution.function as AST.Function | AST.ArrowFunctionExpression;
        const own = listenerElements(context).get(fn);
        if (!own || fn.params[own.index] !== resolution.declaration) return undefined;
        if (name === "currentTarget") return new Set(own.elements);
        // The target is the element or a node it holds.
        return new Set(
          templateElements(context).filter((element) =>
            [...own.elements].some(
              (holder) =>
                holder.span.start <= element.span.start && element.span.end <= holder.span.end,
            ),
          ),
        );
      }
      case "ConditionalExpression":
        return unionOf(
          this.#elementsOf(inner.consequent, visiting),
          this.#elementsOf(inner.alternate, visiting),
        );
      case "LogicalExpression":
        return inner.operator === "&&"
          ? this.#elementsOf(inner.right, visiting)
          : unionOf(
              this.#elementsOf(inner.left, visiting),
              this.#elementsOf(inner.right, visiting),
            );
      case "Identifier": {
        const resolution = context.scopes.resolve(inner);
        if (resolution.kind !== "variable") return undefined;
        if (visiting.has(resolution.declaration)) return new Set();
        const values = assignedValues(context.component, context.scopes).get(
          resolution.declaration,
        );
        if (!values?.length) return undefined;
        visiting.add(resolution.declaration);
        let found: Set<TemplateElement> | undefined = new Set();
        for (const value of values) {
          // `null` and `undefined` are no element at all.
          const each =
            value === null
              ? undefined
              : isNullish(value)
                ? new Set<TemplateElement>()
                : this.#elementsOf(value, visiting);
          found = unionOf(found, each);
          if (!found) break;
        }
        visiting.delete(resolution.declaration);
        return found;
      }
      default:
        return undefined;
    }
  }

  /**
   * Whether an expression may be an element the framework renders (UF3028): a template ref's,
   * the event's `currentTarget` or `target`, or a node reached from one (`parentElement`,
   * `querySelector(…)`), itself or through a local, judged by where it comes from.
   */
  #rendered(node: AST.Expression | AST.Super): boolean {
    // Elsewhere a template ref is not read at all (UF2010), and there is no event; `watchEffect`
    // reads one only in what it hands on to run later.
    if (this.#mode !== "client") return false;
    return this.#originOf(node, new Set()).origins.has("element");
  }

  /**
   * Where the value an expression gives comes from (ADR-0045, UF2004, UF3028): see
   * {@link Origin}, with what it is for a message where code may not change it.
   */
  #originOf(node: AST.Expression | AST.Super, visiting: Set<object>): Provenance {
    const inner = unwrapExpression(node);
    const context = this.#context;
    const text = () => context.source.slice(inner.start, inner.end);
    switch (inner.type) {
      case "ObjectExpression":
      case "ArrayExpression":
      case "NewExpression":
        return FRESH;
      case "Literal":
        return inner.value === null && !("regex" in inner && inner.regex) ? NONE : other();
      case "ConditionalExpression":
        return either(
          this.#originOf(inner.consequent, visiting),
          this.#originOf(inner.alternate, visiting),
        );
      case "LogicalExpression":
        // `a && b` gives `b`, or a falsy `a`: a primitive or nothing.
        return inner.operator === "&&"
          ? this.#originOf(inner.right, visiting)
          : either(this.#originOf(inner.left, visiting), this.#originOf(inner.right, visiting));
      case "AssignmentExpression": {
        // `a = b` gives `b`; `a ??= b`, `a ||= b` and `a &&= b` give `a` or `b`.
        if (inner.operator === "=") return this.#originOf(inner.right, visiting);
        const { left } = inner;
        if (
          LOGICAL_ASSIGNMENTS.has(inner.operator) &&
          (left.type === "Identifier" || left.type === "MemberExpression")
        ) {
          return either(this.#originOf(left, visiting), this.#originOf(inner.right, visiting));
        }
        return other();
      }
      case "CallExpression": {
        const { callee } = inner;
        if (callee.type === "Identifier") {
          return callee.name === "structuredClone" &&
            context.scopes.resolve(callee).kind === "global"
            ? CLONE
            : other("a value a call returns,");
        }
        if (callee.type !== "MemberExpression" || callee.object.type === "Super") return other();
        const method = memberName(callee);
        const receiver = unwrapExpression(callee.object);
        if (
          receiver.type === "Identifier" &&
          method !== undefined &&
          context.scopes.resolve(receiver).kind === "global"
        ) {
          const result = globalCallProvenance(receiver.name, method);
          if (result) return result;
          const [target] = inner.arguments;
          return target && target.type !== "SpreadElement"
            ? this.#originOf(target, visiting)
            : other();
        }
        const holder = callee.object;
        return callProvenance(this.#originOf(holder, visiting), method, text(), () =>
          this.#membersOf(holder, undefined, visiting),
        );
      }
      case "MemberExpression": {
        const { object } = inner;
        if (object.type === "Super") return other();
        if (object.type === "Identifier") {
          const binding = setupBindingOf(object, context);
          if (binding && isRef(binding) && !inner.computed) {
            if (binding.kind === "templateRef") return ELEMENT;
            return other(
              `\`${binding.name}.value\`, ${binding.kind === "state" ? "a ref's value" : "a computed value"},`,
            );
          }
          if (this.#isPropsObject(object)) return other("a prop");
        }
        const name = memberName(inner);
        return memberProvenance(this.#originOf(object, visiting), name, text(), () =>
          this.#membersOf(object, name, visiting),
        );
      }
      case "Identifier": {
        const resolution = context.scopes.resolve(inner);
        switch (resolution.kind) {
          case "global":
            return inner.name === "undefined" ? NONE : GLOBAL;
          case "parameter": {
            if (this.#event?.declaration === resolution.declaration) return EVENT;
            if (resolution.function === context.component) {
              return other(`the prop \`${inner.name}\``);
            }
            if (context.loopVariables.has(resolution.declaration)) {
              return other(`\`${inner.name}\`, a list's item,`);
            }
            // An array method's callback is given the array's items (`items.forEach((li) => …)`).
            const items = this.#iteratedItems(resolution, visiting);
            if (items) return items;
            const accumulator = this.#accumulated(resolution, visiting);
            if (accumulator) return accumulator;
            return other(`the parameter \`${inner.name}\``);
          }
          case "variable": {
            if (resolution.scope === context.component) {
              const binding = context.setup.bindings.get(resolution.declaration);
              if (binding?.kind === "localVar") {
                return this.#heldBy(resolution.declaration, inner.name, visiting);
              }
              return other(binding ? `\`${inner.name}\`, ${WHAT[binding.kind]},` : undefined);
            }
            if ((resolution.scope as AST.Node).type === "Program") return other();
            return this.#heldBy(resolution.declaration, inner.name, visiting);
          }
          default:
            return other();
        }
      }
      default:
        return other();
    }
  }

  /**
   * Where the values a `const` or a `let` holds come from: its initial value and every value the
   * component's code writes to it, wherever it does (a setup `let` is written by one function and
   * changed by another).
   */
  #heldBy(declaration: object, name: string, visiting: Set<object>): Provenance {
    // A loop's variable holds the items of what it walks (`for (const li of list.children)`).
    const iterable = loopSources(this.#context.component).get(declaration);
    if (iterable && !visiting.has(declaration)) {
      visiting.add(declaration);
      const items = this.#membersOf(iterable, undefined, visiting);
      visiting.delete(declaration);
      if (items.origins.size && !items.origins.has("other")) return items;
    }
    // A name met again on the way (`list = byKind.get(kind) ?? []`, then `byKind.set(kind, list)`)
    // holds nothing new there: what it holds comes from its other values.
    if (visiting.has(declaration)) return NONE;
    const values = assignedValues(this.#context.component, this.#context.scopes).get(declaration);
    if (!values?.length) return other(`\`${name}\`, which holds a value from elsewhere,`);
    visiting.add(declaration);
    const held = values.map((value) => (value ? this.#originOf(value, visiting) : other()));
    visiting.delete(declaration);
    return joined(held, name);
  }

  /**
   * Where what a value holds comes from (UF2004, UF3028), read where the value is built: an
   * object literal's member is the value it writes for that key after its last spread (a member
   * a spread copied is the spread value's), an array literal's items its elements; a name's, what
   * every value given to it holds and every value code writes into it (`byKind[kind] = []`,
   * `push`, a `Map`'s `set`); a copy's (`slice`, `filter`, `Array.from`, `Object.values`), what it
   * copies; the DOM's and a global's, their own (`querySelectorAll(…)`'s elements); a deep copy's,
   * its own. Anything else is shared with what it came from, as a member of a value from elsewhere
   * is that value's. `property` is the member read, where static.
   */
  #membersOf(
    node: AST.Expression | AST.Super,
    property: string | undefined,
    visiting: Set<object>,
  ): Provenance {
    const inner = unwrapExpression(node);
    const context = this.#context;
    const text = context.source.slice(inner.start, inner.end);
    switch (inner.type) {
      case "ObjectExpression": {
        const found: Provenance[] = [];
        for (const item of inner.properties.toReversed()) {
          if (item.type === "SpreadElement") {
            found.push(this.#membersOf(item.argument, property, visiting));
            if (property !== undefined) return either(...found);
            continue;
          }
          const key = item.computed ? undefined : propertyKey(item.key);
          if (property !== undefined && key !== undefined && key !== property) continue;
          found.push(this.#originOf(item.value as AST.Expression, visiting));
          if (property !== undefined && key === property) return either(...found);
        }
        return found.length ? either(...found) : NONE;
      }
      case "ArrayExpression": {
        const found = inner.elements.map((element) =>
          element === null
            ? NONE
            : element.type === "SpreadElement"
              ? this.#membersOf(element.argument, undefined, visiting)
              : this.#originOf(element, visiting),
        );
        return found.length ? either(...found) : NONE;
      }
      case "NewExpression":
        return inner.arguments.length ? shared(text) : NONE;
      case "ConditionalExpression":
        return either(
          this.#membersOf(inner.consequent, property, visiting),
          this.#membersOf(inner.alternate, property, visiting),
        );
      case "LogicalExpression":
        return inner.operator === "&&"
          ? this.#membersOf(inner.right, property, visiting)
          : either(
              this.#membersOf(inner.left, property, visiting),
              this.#membersOf(inner.right, property, visiting),
            );
      case "CallExpression": {
        const { callee } = inner;
        if (callee.type !== "MemberExpression" || callee.object.type === "Super") break;
        const method = memberName(callee);
        const receiver = unwrapExpression(callee.object);
        if (method === undefined) break;
        if (receiver.type === "Identifier" && context.scopes.resolve(receiver).kind === "global") {
          const [first] = inner.arguments;
          const copies =
            (receiver.name === "Array" && method === "from" && inner.arguments.length === 1) ||
            (receiver.name === "Object" && method === "values");
          if (copies && first && first.type !== "SpreadElement") {
            return this.#membersOf(first, undefined, visiting);
          }
          break;
        }
        if (copiesItems(method) || returnsReceiver(method)) {
          return this.#membersOf(callee.object, undefined, visiting);
        }
        break;
      }
      case "Identifier": {
        const resolution = context.scopes.resolve(inner);
        if (resolution.kind === "parameter") {
          // A `reduce` callback's accumulator holds what its first value and every value the
          // callback returns hold, and what the callback writes into it.
          const call = this.#reduceCall(resolution);
          if (!call) break;
          const token = this.#memberToken(resolution.declaration);
          if (visiting.has(token)) return NONE;
          visiting.add(token);
          const given = [
            call.arguments[1] as AST.Expression,
            ...returnedOf(call.arguments[0] as AST.Function | AST.ArrowFunctionExpression),
          ].map((value) => this.#membersOf(value, property, visiting));
          const written = (
            memberValues(context.component, context.scopes).get(resolution.declaration) ?? []
          )
            .filter(({ key }) => property === undefined || key === undefined || key === property)
            .map(({ value }) => (value ? this.#originOf(value, visiting) : other()));
          visiting.delete(token);
          const all = [...given, ...written];
          return all.length ? either(...all) : NONE;
        }
        if (resolution.kind !== "variable" || (resolution.scope as AST.Node).type === "Program") {
          break;
        }
        if (resolution.scope === context.component) {
          if (context.setup.bindings.get(resolution.declaration)?.kind !== "localVar") break;
        }
        const { declaration } = resolution;
        // A loop's variable holds an item of what it walks: judged by where that comes from.
        if (loopSources(context.component).has(declaration)) break;
        const token = this.#memberToken(declaration);
        // A name met again on the way holds nothing new there.
        if (visiting.has(token)) return NONE;
        visiting.add(token);
        const given = (
          assignedValues(context.component, context.scopes).get(declaration) ?? []
        ).map((value) => (value ? this.#membersOf(value, property, visiting) : shared(text)));
        const written = (memberValues(context.component, context.scopes).get(declaration) ?? [])
          .filter(({ key }) => property === undefined || key === undefined || key === property)
          .map(({ value }) => (value ? this.#originOf(value, visiting) : other()));
        visiting.delete(token);
        const all = [...given, ...written];
        return all.length ? either(...all) : NONE;
      }
      default:
        break;
    }
    const own = this.#originOf(inner, visiting);
    if (own.origins.has("other")) return own;
    // The DOM's, a global's and a deep copy's items are their own.
    return own.origins.has("fresh") ? shared(text) : own;
  }

  /** A stand-in for a name's declaration in `visiting` while `#membersOf` reads its members. */
  #memberToken(declaration: object): object {
    let token = this.#memberTokens.get(declaration);
    if (!token) {
      token = {};
      this.#memberTokens.set(declaration, token);
    }
    return token;
  }

  /**
   * What the accumulator of a `reduce` or `reduceRight` callback holds (`(groups, card) => …`
   * with `{}`): its initial value, and every value the callback returns, which the next call
   * receives (`return groups` holds nothing new). `undefined` for any other parameter, and for a
   * `reduce` with no initial value, whose accumulator starts as an item.
   */
  #accumulated(
    resolution: { declaration: object; function: object },
    visiting: Set<object>,
  ): Provenance | undefined {
    const call = this.#reduceCall(resolution);
    if (!call) return undefined;
    if (visiting.has(resolution.declaration)) return NONE;
    visiting.add(resolution.declaration);
    const fn = call.arguments[0] as AST.Function | AST.ArrowFunctionExpression;
    const all = [call.arguments[1] as AST.Expression, ...returnedOf(fn)].map((value) =>
      this.#originOf(value, visiting),
    );
    visiting.delete(resolution.declaration);
    return either(...all);
  }

  /**
   * The `reduce` or `reduceRight` call whose callback's accumulator a parameter is, with an
   * initial value written as its second argument; `undefined` for any other parameter.
   */
  #reduceCall(resolution: {
    declaration: object;
    function: object;
  }): AST.CallExpression | undefined {
    const fn = resolution.function as AST.Node | undefined;
    if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") {
      return undefined;
    }
    if (fn.params[0] !== resolution.declaration) return undefined;
    const ancestors = ancestorsOf(fn, this.#context.component);
    const call = ancestors.at(-2);
    if (call?.type !== "CallExpression" || call.arguments[0] !== fn) return undefined;
    const initial = call.arguments[1];
    if (!initial || initial.type === "SpreadElement") return undefined;
    const { callee } = call;
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return undefined;
    const method = memberName(callee);
    return method === "reduce" || method === "reduceRight" ? call : undefined;
  }

  /**
   * What the first parameter of an array method's callback holds, where the method passes it the
   * array's items (`list.forEach((li) => …)`): the array's items, where code may change them;
   * `undefined` otherwise.
   */
  #iteratedItems(
    resolution: { declaration: object; function: object },
    visiting: Set<object>,
  ): Provenance | undefined {
    const fn = resolution.function as AST.Node | undefined;
    if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") {
      return undefined;
    }
    if (fn.params[0] !== resolution.declaration) return undefined;
    const ancestors = ancestorsOf(fn, this.#context.component);
    const call = ancestors.at(-2);
    if (call?.type !== "CallExpression" || call.arguments[0] !== fn) return undefined;
    const { callee } = call;
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return undefined;
    const method = memberName(callee);
    if (method === undefined || !ITERATING_METHODS.has(method)) return undefined;
    const items = this.#membersOf(callee.object, undefined, visiting);
    return items.origins.size && !items.origins.has("other") ? items : undefined;
  }

  /**
   * A call of `emit` (ADR-0047): client code only, as a statement of its own, of an event the
   * component declares, named by a string literal, with as many arguments as its payload takes
   * and none spread (UF2017).
   */
  #emit(node: AST.CallExpression, binding: SetupBinding, position: Position): Kinds {
    const { reporter, setup } = this.#context;
    const [first, ...payload] = node.arguments;
    const problem = (at: { start: number; end: number }, message: string, help?: string) => {
      reporter.report("UF2017", at, message, help ? { help } : {});
      return false;
    };
    let valid = true;
    if (this.#mode !== "client") {
      valid = problem(
        node,
        `\`emit\` tells the component's parent something happened, so only client code calls it: a handler, a watcher's callback, \`watchEffect\`, a lifecycle hook or a function they call, never ${this.#mode === "render" ? "a template expression" : "a getter or an initial value"}.`,
      );
    } else if (position !== "statement" && position !== "discarded" && position !== "nested") {
      valid = problem(
        node,
        "`emit(…)` is a statement of its own: what it returns differs from target to target (Qwik's is a promise), so code must not use it.",
        position === "returned"
          ? "Give the function a block body: `() => { emit(…); }`."
          : "Write the emit as a statement.",
      );
    }
    if (node.optional) {
      valid = problem(node, "`emit` is never null or undefined: call it as `emit(…)`.");
    }
    const name =
      first?.type === "Literal" && typeof first.value === "string"
        ? first.value
        : first?.type === "TemplateLiteral" && !first.expressions.length
          ? first.quasis.map((quasi) => quasi.value.cooked ?? "").join("")
          : undefined;
    const declared = name === undefined ? undefined : setup.events?.get(name);
    if (!first || name === undefined) {
      valid = problem(
        first ?? node,
        "`emit`'s first argument is the name of the event, written as a string: every target spells each event's emit apart.",
        'Write the name: `emit("change", value)`.',
      );
    } else if (!declared && setup.events) {
      // Without `setup.events`, the declaration is reported: its events are unknown.
      const events = [...setup.events.keys()];
      valid = problem(
        first,
        `"${name}" is not an event the component declares: it declares ${events.length ? events.map((event) => `"${event}"`).join(", ") : "none"}.`,
        "Declare the event in `defineEmits`, or emit one it declares.",
      );
    }
    const spread = node.arguments.find((argument) => argument.type === "SpreadElement");
    if (spread) {
      valid = problem(
        spread,
        "An emit's payload is passed argument by argument: Angular emits a payload's members as one value, which it builds from them.",
      );
    } else if (
      declared &&
      (payload.length < declared.required || payload.length > declared.total)
    ) {
      const takes =
        declared.required === declared.total
          ? `${declared.total}`
          : `${declared.required} to ${declared.total}`;
      valid = problem(
        node,
        `"${name}" takes ${takes} argument${declared.total === 1 ? "" : "s"}, and this emit passes ${payload.length}.`,
      );
    }
    if (valid && name !== undefined && declared) {
      this.refs.push(
        createEmitReference(
          binding.id,
          name,
          span(node),
          payload.map((item) => span(item)),
        ),
      );
    }
    if (first && name === undefined) this.#arguments([first], []);
    this.#arguments(payload, []);
    return UNDEFINED;
  }

  /** Reports a use of a handler's event that some target's event object cannot take (UF3032). */
  #eventProblem(node: { start: number; end: number }, message: string): void {
    this.#context.reporter.report("UF3032", node, message, {
      help: "Read the members every target's event has (`key`, `code`, the modifier keys, `button`, `clientX`, `currentTarget`, `target`, `preventDefault()`, …), or listen natively from `onMounted` through a template ref (`addEventListener`).",
    });
  }

  /** Walks a method call's callee up to its receiver, which it returns the kinds of. */
  #receiverOf(callee: AST.MemberExpression): Kinds {
    const render = this.#mode === "render";
    const receiver = this.value(callee.object, "value", false);
    if (callee.computed) this.value(callee.property, "value", false);
    else if (callee.property.type === "Identifier" && render) this.#asciiName(callee.property);
    if (callee.optional) {
      if (render) {
        this.#optional(callee.object, callee.property.start, receiver, callee.computed ? "" : ".");
      }
      if (mayBeNullish(receiver)) this.shortCircuits = true;
    }
    if (render) this.#readAbsent(callee.object, receiver);
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

  /**
   * Walks a call's arguments; `runs` says when the call runs the callbacks it is given (UF2024:
   * a local function that touches state may be called or passed only where they run later or
   * never, or directly in a function's body). `to` names the call, for the message.
   */
  #arguments(
    items: readonly AST.Argument[],
    parameters: readonly Kinds[],
    runs: Runs = "now",
    to?: { name: string | undefined; arrayMethod: boolean },
  ): void {
    for (const item of items) {
      // What runs later or never is not the caller's own run (UF2026, UF2027).
      if (runs !== "now" && this.#mode === "client" && item.type !== "SpreadElement") {
        this.#context.facts.passed.set(item.start, runs);
      }
      if (item.type === "SpreadElement") this.value(item.argument, "value", false);
      else if (item.type === "ArrowFunctionExpression") {
        this.#arrow(item, "argument", parameters, runs !== "now");
      } else {
        if (item.type === "Identifier" && runs === "now" && this.#mode === "client") {
          const binding = setupBindingOf(item, this.#context);
          if (binding?.kind === "localFn") {
            this.#context.facts.nestedCalls.push({
              binding: binding.id,
              span: span(item),
              passedTo: to?.name,
              arrayMethod: to?.arrayMethod ?? false,
            });
          }
        }
        this.value(item, "argument", false);
      }
    }
  }

  #array(node: AST.ArrayExpression): Kinds {
    const elements: Kinds[] = [];
    let hole = false;
    for (const element of node.elements) {
      if (element === null) {
        hole = true;
        if (this.#mode !== "render") elements.push(UNDEFINED);
      } else if (element.type === "SpreadElement") {
        elements.push(elementsOf(this.value(element.argument, "value", false)));
      } else {
        elements.push(this.value(element, "value", false));
      }
    }
    if (hole && this.#mode === "render") {
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
    const render = this.#mode === "render";
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
          render
            ? "Methods, getters and setters in object literals are not supported in template expressions: Angular's templates reject them."
            : "Methods, getters and setters in object literals are not supported in setup code: write a property whose value is an arrow function.",
        );
        this.#skip(property);
        continue;
      }
      if (property.computed) {
        if (render) {
          this.#unsupported(
            property.key,
            "Computed keys in object literals are not supported in template expressions: Angular's templates reject them.",
          );
        }
        this.value(property.key as AST.Expression, "value", false);
        this.value(property.value, "value", false);
        if (!render) spread = true;
        continue;
      }
      const { key } = property;
      let name: string | undefined;
      if (key.type === "Identifier") {
        if (!property.shorthand && render) name = this.#asciiName(key) ? key.name : undefined;
        else name = key.name;
      } else if (key.type === "Literal" && (typeof key.value === "string" || !render)) {
        name = String(key.value);
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
    deferred = false,
  ): Kinds {
    if (this.#mode !== "render") return this.#nestedArrow(node, position, parameters, deferred);
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
        // A default may read the parameters before it, or an outer arrow's.
        this.#skip(parameter);
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
      else this.#skip(body);
    } else {
      this.value(body, "value", false);
    }
    // The parameters' own diagnostics come before the body's, in source order.
    const inBody = reporter.diagnostics.splice(mark);
    this.#parameters(node, declared, true);
    reporter.diagnostics.push(...inBody);
    for (const { node: parameter } of declared) this.#locals.delete(parameter);
    return FUNCTION;
  }

  /**
   * An arrow function in setup code (ADR-0045): anywhere, with any parameters and body. Its
   * expression body's value is discarded where it is a call's argument (`setTimeout(() =>
   * count.value++, 100)`), so a write may be that body.
   */
  #nestedArrow(
    node: AST.ArrowFunctionExpression,
    position: Position,
    parameters: readonly Kinds[],
    deferred: boolean,
  ): Kinds {
    if (this.#mode === "pure" && position !== "argument") {
      this.#context.reporter.report(
        "UF2022",
        node,
        "A function is a value here, in a getter or an initial value, which only passes an arrow function to a call (`items.filter((item) => item.on)`): the targets cannot keep a function a getter or an initial value makes.",
        { help: "Declare a local function, and call it; or compute the value in place." },
      );
    }
    const declared: { node: AST.BindingIdentifier; local: Local }[] = [];
    for (const [index, parameter] of node.params.entries()) {
      this.#declareParameter(parameter, parameters[index] ?? UNKNOWN, declared);
    }
    const returns = this.#returns;
    this.#returns = undefined;
    // An arrow that runs later, or an `async` one, can await a local function's call (UF2024),
    // whatever arrows lie around it: nothing waits for its value but as a promise.
    const outerSynchronous = this.#synchronous;
    this.#synchronous = deferred || node.async ? 0 : outerSynchronous + 1;
    const { body } = node;
    if (body.type === "BlockStatement") {
      this.#statements(body.body);
    } else {
      // Only an `onCleanup` callback's value is the framework's to drop (UF2011); `nextTick`'s
      // callback is UF2025.
      this.#bodies.set(body, arrowBodySpan(node, this.#context.source));
      const use = this.#arrowUses.get(node);
      if (use) this.#arrowUses.set(body, use);
      this.value(
        body,
        position !== "argument"
          ? "value"
          : this.#arrowUses.get(node) === "callback"
            ? "discarded"
            : "nested",
        false,
      );
    }
    this.#synchronous = outerSynchronous;
    this.#returns = returns;
    this.#parameters(node, declared, true);
    return FUNCTION;
  }

  /** Declares a nested function's parameter as names local to the code, and walks its default. */
  #declareParameter(
    parameter: AST.ParamPattern | AST.BindingPattern,
    kindsOf: Kinds,
    declared: { node: AST.BindingIdentifier; local: Local }[],
  ): void {
    if (parameter.type === "TSParameterProperty") {
      this.#rejected(parameter, "Parameter properties are not supported in setup code.");
      return;
    }
    if (parameter.type === "Identifier") {
      const local: Local = {
        kinds: parameter.typeAnnotation
          ? this.#context.types.kindsOf(parameter.typeAnnotation.typeAnnotation)
          : kindsOf,
        read: false,
      };
      this.#locals.set(parameter, local);
      declared.push({ node: parameter, local });
      return;
    }
    if (parameter.type === "AssignmentPattern") {
      this.value(parameter.right, "value", false);
      this.#declareParameter(parameter.left, kindsOf, declared);
      // A parameter with a default is read by the caller's omission: never reported unread.
      for (const item of declared) if (item.node === parameter.left) item.local.read = true;
      return;
    }
    this.#computedKeys(parameter);
    for (const value of patternDefaults(parameter)) this.value(value, "value", false);
    for (const name of patternNames(parameter)) {
      this.#locals.set(name, { kinds: UNKNOWN, read: true });
      shadowing(name, this.#context);
    }
  }

  /**
   * Checks an arrow function's parameters once its body is walked: the trailing ones it never
   * reads fail the outputs' `no-unused-vars` (which reads only the parameters after the last one
   * read), and one that shadows a name the targets rewrite would capture the rewrite (UF3024).
   * The fix removes an unread one where nothing but the framework calls the function.
   */
  #parameters(
    node: AST.ArrowFunctionExpression | AST.Function,
    declared: readonly { node: AST.BindingIdentifier; local: Local }[],
    fixable: boolean,
  ): void {
    const context = this.#context;
    const { reporter, source } = context;
    const all = node.params;
    let lastRead = -1;
    for (const [index, parameter] of all.entries()) {
      const entry = declared.find((item) => item.node === parameter);
      if (!entry || entry.local.read) lastRead = index;
    }
    const open = skipTrivia(
      source,
      node.async && node.type === "ArrowFunctionExpression" ? node.start + 5 : node.start,
    );
    const parenthesised = node.type !== "ArrowFunctionExpression" || source[open] === "(";
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
            fixes: fixable
              ? [
                  {
                    title: `Remove \`${name}\``,
                    confidence: "safe",
                    edits: [{ span: removal, text: parenthesised ? "" : "()" }],
                  },
                ]
              : [],
          },
        );
        continue;
      }
      shadowing(entry.node, context);
    }
  }

  /**
   * Lowers a function the source writes (ADR-0045): its parameters, as the role takes them; its
   * body, a block or an expression; the event its parameter receives, whose members its code reads
   * as `Event` references; and the `preventDefault()` and `stopPropagation()` calls it makes while
   * the event is dispatched (UF3033).
   */
  function(
    fn: AST.Function | AST.ArrowFunctionExpression,
    options: FunctionOptions,
  ): { function: FunctionCode; returns: Kinds } {
    const context = this.#context;
    const { source, types } = context;
    const { role } = options;
    const limits = ROLE_PARAMETERS[role];
    const cleanup = role === "watch" ? fn.params[2] : role === "watchEffect" ? fn.params[0] : null;
    if (cleanup?.type === "Identifier") this.#onCleanup = cleanup;
    if (fn.generator) this.#unsupported(fn, "Generator functions are not supported in setup code.");
    if (fn.typeParameters) {
      this.#unsupported(
        fn.typeParameters,
        "Generic functions are not supported in setup code yet: the targets declare each local function once, for the types it is written with.",
      );
    }
    if (fn.async && role === "getter") {
      this.#unsupported(
        fn,
        "A getter is synchronous: every target computes a derived value or a watched source at once.",
        "Remove `async`: compute the value from what the setup holds.",
      );
    }
    if (fn.params.length > limits.max) {
      this.#unsupported(
        fn.params[limits.max]!,
        `This function takes at most ${limits.max} parameter${limits.max === 1 ? "" : "s"}: ${limits.what}.`,
      );
    }
    // A parameter the role does not take is reported once, above: never as unread too.
    const excess = new Set(fn.params.slice(limits.max));
    const parameters: Parameter[] = [];
    const declared: { node: AST.BindingIdentifier; local: Local }[] = [];
    for (const [index, parameter] of fn.params.entries()) {
      const lowered = this.#parameter(parameter, index, options, declared);
      if (lowered) parameters.push(lowered);
    }
    this.#returns = [];
    const { body } = fn;
    let code: Code;
    let expression = false;
    let returned: AST.Expression[];
    if (body?.type === "BlockStatement") {
      this.#statements(body.body);
      code = createCode(source.slice(body.start, body.end), span(body), []);
      returned = this.#returns;
    } else if (body) {
      expression = true;
      const at = arrowBodySpan(fn as AST.ArrowFunctionExpression, source);
      this.#bodies.set(body, at);
      this.value(body, options.item ? "returned" : "discarded", false);
      code = createCode(source.slice(at.start, at.end), at, []);
      returned = [body];
    } else {
      code = createCode("", span(fn), []);
      returned = [];
    }
    for (const item of declared) if (excess.has(item.node)) item.local.read = true;
    this.#parameters(fn, declared, role !== "function");
    const eventControls = this.#eventControls(fn, code.span);
    const refs = sortReferences(this.refs);
    const lowered = createFunctionCode(
      parameters,
      createCode(code.code, code.span, refs),
      functionSpan(fn, source),
      {
        async: fn.async,
        ...(fn.returnType
          ? {
              returnType: createTypeText(
                source.slice(fn.returnType.typeAnnotation.start, fn.returnType.typeAnnotation.end),
                span(fn.returnType.typeAnnotation),
              ),
            }
          : {}),
        expression,
        eventControls: eventControls.map((control) =>
          control.condition
            ? createEventControl(
                control.method,
                control.span,
                createCode(
                  source.slice(control.condition.start, control.condition.end),
                  control.condition,
                  refs.filter((ref) => inside(ref.span, control.condition!)),
                ),
              )
            : createEventControl(control.method, control.span),
        ),
      },
    );
    // An async getter is reported: what it gives says nothing more.
    const returns = fn.returnType
      ? types.kindsOf(fn.returnType.typeAnnotation)
      : fn.async
        ? role === "getter"
          ? UNKNOWN
          : kinds("object")
        : returnedKinds(returned, this.knownOf);
    return { function: lowered, returns };
  }

  /**
   * Lowers a parameter of a function the source writes: an identifier or a pattern, with its
   * type, a static default (the outputs evaluate it where they declare the function), and the
   * event it receives, if any.
   */
  #parameter(
    parameter: AST.ParamPattern,
    index: number,
    options: FunctionOptions,
    declared: { node: AST.BindingIdentifier; local: Local }[],
  ): Parameter | undefined {
    const context = this.#context;
    const { source, types } = context;
    const limits = ROLE_PARAMETERS[options.role];
    if (parameter.type === "TSParameterProperty") {
      this.#rejected(parameter, "Parameter properties are not supported in setup code.");
      return undefined;
    }
    let node: AST.BindingPattern;
    let defaultValue: AST.Expression | undefined;
    let rest = false;
    if (parameter.type === "AssignmentPattern") {
      defaultValue = parameter.right;
      node = parameter.left;
    } else if (parameter.type === "RestElement") {
      rest = true;
      node = parameter.argument;
    } else {
      node = parameter;
    }
    if (limits.plain && (rest || defaultValue)) {
      this.#unsupported(parameter, `This parameter takes no default and no rest: ${limits.what}.`);
    }
    const annotation =
      parameter.type === "RestElement"
        ? parameter.typeAnnotation
        : node.type === "AssignmentPattern"
          ? null
          : node.typeAnnotation;
    const type = annotation
      ? createTypeText(
          source.slice(annotation.typeAnnotation.start, annotation.typeAnnotation.end),
          span(annotation.typeAnnotation),
        )
      : undefined;
    let lowered: Expression | undefined;
    if (defaultValue) {
      if (isStatic(defaultValue)) {
        lowered = createExpression(
          source.slice(defaultValue.start, defaultValue.end),
          span(defaultValue),
          [],
        );
      } else {
        this.#unsupported(
          defaultValue,
          "A parameter's default must be a static value: the outputs evaluate it where they declare the function.",
          "Write the value itself: a literal, or an array or object of literals.",
        );
      }
    }
    if (node.type === "Identifier") {
      this.#asciiParameter(node);
      const event = options.event?.index === index ? options.event.interface : undefined;
      const local: Local = {
        kinds: annotation ? types.kindsOf(annotation.typeAnnotation) : UNKNOWN,
        read: rest || defaultValue !== undefined,
      };
      this.#locals.set(node, local);
      declared.push({ node, local });
      if (event !== undefined) {
        this.#event = { declaration: node, interface: event, events: options.event!.events };
      }
      return createParameter(node.name, span(parameter), {
        ...(type ? { type } : {}),
        optional: node.optional,
        rest,
        ...(lowered ? { default: lowered } : {}),
        ...(event === undefined ? {} : { event }),
      });
    }
    if (node.type !== "ObjectPattern" && node.type !== "ArrayPattern") {
      this.#rejected(node, "This parameter is not supported in setup code.");
      return undefined;
    }
    if (options.event?.index === index) {
      this.#eventProblem(
        node,
        "A handler's event is destructured: a handler reads its event's members (`event.key`), which the compiler checks against every target's event.",
      );
    }
    this.#computedKeys(node);
    for (const value of patternDefaults(node)) {
      if (!isStatic(value)) {
        this.#unsupported(
          value,
          "A parameter's default must be a static value: the outputs evaluate it where they declare the function.",
          "Write the value itself: a literal, or an array or object of literals.",
        );
      }
    }
    const names = patternNames(node);
    for (const name of names) {
      this.#asciiParameter(name);
      this.#locals.set(name, { kinds: UNKNOWN, read: true });
      shadowing(name, context);
    }
    const end = annotation ? trimmedEnd(source, node.start, annotation.start) : node.end;
    return createParameter(
      createParameterPattern(
        source.slice(node.start, end),
        names.map((name) => name.name),
        { start: node.start, end },
      ),
      span(parameter),
      { ...(type ? { type } : {}), rest, ...(lowered ? { default: lowered } : {}) },
    );
  }

  /**
   * Reports a parameter of a function the IR holds whose name is no ASCII identifier (UF2003, as
   * a setup binding's): Angular's methods and template statements name it, and its expression
   * lexer reads no other letter.
   */
  #asciiParameter(name: AST.BindingIdentifier): void {
    if (isIdentifier(name.name)) return;
    this.#context.reporter.report(
      "UF2003",
      { start: name.start, end: name.start + name.name.length },
      `\`${name.name}\` cannot name a parameter: it is not an ASCII identifier, which Angular's expression lexer reads.`,
      { help: "Rename it." },
    );
  }

  /**
   * The event controls of the function being lowered (ADR-0047): the leading `preventDefault()`
   * and `stopPropagation()` calls the IR lists (`eventControlsOf`). Every other runs while the
   * event is dispatched too, but one after an `await` or in a function inside the handler, which
   * runs once the event is over on every target: UF3033.
   */
  #eventControls(
    fn: AST.Function | AST.ArrowFunctionExpression,
    bodySpan: Span,
  ): { method: EventControl["method"]; span: Span; condition?: Span }[] {
    const event = this.#event;
    if (!event || !fn.body) return [];
    const { scopes, reporter } = this.#context;
    const isEvent = (identifier: AST.IdentifierReference) => {
      const resolution = scopes.resolve(identifier);
      return resolution.kind === "parameter" && resolution.declaration === event.declaration;
    };
    const { controls, deferred } = eventControlsOf(
      fn.body.type === "BlockStatement" ? fn.body : { node: fn.body, span: bodySpan },
      isEvent,
    );
    const lowered = controls.map((control) => ({
      method: control.method,
      span: control.statement,
      ...(control.test ? { condition: span(control.test) } : {}),
    }));
    for (const call of deferred.toSorted((a, b) => a.call.start - b.call.start)) {
      reporter.report(
        "UF3033",
        call.call,
        `\`${call.method}()\` must run while the event is dispatched, and ${call.reason}: the browser has acted on the event by then, on every target (ADR-0047).`,
        {
          help: call.inFunction
            ? `Call it in the handler itself, before anything it defers (\`event.${call.method}();\`).`
            : `Call it before the first \`await\`, under the same test if it is conditional (\`if (event.key === "Enter") event.${call.method}();\`).`,
        },
      );
    }
    return lowered;
  }

  /** Walks statements of setup code, in order. */
  #statements(statements: readonly (AST.Statement | AST.Directive)[]): void {
    for (const statement of statements) this.#statement(statement);
  }

  /**
   * A statement of setup code (ADR-0045): declarations, conditions, loops, `switch`, `try` with
   * a `catch`, `return` and `throw`. `var`, labels, `for…in`, `finally` and declarations of
   * functions, classes or types are not supported (UF1002).
   */
  #statement(node: AST.Statement | AST.Directive): void {
    switch (node.type) {
      case "ExpressionStatement":
        this.value(node.expression, "statement", false);
        return;
      case "VariableDeclaration":
        this.#declaration(node);
        return;
      case "IfStatement":
        this.value(node.test, "value", false);
        this.#statement(node.consequent);
        if (node.alternate) this.#statement(node.alternate);
        return;
      case "BlockStatement":
        this.#statements(node.body);
        return;
      case "ReturnStatement":
        if (node.argument) {
          this.value(node.argument, "value", false);
          this.#returns?.push(node.argument);
        }
        return;
      case "ForStatement":
        if (node.init?.type === "VariableDeclaration") this.#declaration(node.init);
        else if (node.init) this.value(node.init, "value", false);
        if (node.test) this.value(node.test, "value", false);
        if (node.update) this.value(node.update, "value", false);
        this.#statement(node.body);
        return;
      case "ForOfStatement": {
        const items = elementsOf(this.value(node.right, "value", false));
        if (node.left.type === "VariableDeclaration") {
          if (node.left.kind === "var") this.#unsupported(node.left, VAR);
          for (const declarator of node.left.declarations) {
            this.#computedKeys(declarator.id);
            for (const name of patternNames(declarator.id)) {
              this.#locals.set(name, {
                kinds: declarator.id.type === "Identifier" ? items : UNKNOWN,
                read: false,
              });
              localShadowing(name, this.#context);
            }
          }
        } else {
          // Each item is written to the loop's target in turn (UF2004).
          const left = node.left as AST.AssignmentTarget;
          const target = this.#target(left);
          const member = withoutAssertions(left as AST.Expression);
          if (target.kind === "member" && member.type === "MemberExpression") {
            this.value(left as AST.Expression, "value", false);
            this.#patternWrite(left, [member], "value");
          }
          if (target.members) this.#patternWrite(left, target.members, "value");
        }
        this.#statement(node.body);
        return;
      }
      case "ForInStatement":
        this.#unsupported(
          node,
          "`for…in` is not supported in setup code: it walks inherited keys too. Write `for (const key of Object.keys(object))`.",
        );
        this.#skip(node);
        return;
      case "WhileStatement":
        this.value(node.test, "value", false);
        this.#statement(node.body);
        return;
      case "DoWhileStatement":
        this.#statement(node.body);
        this.value(node.test, "value", false);
        return;
      case "SwitchStatement":
        this.value(node.discriminant, "value", false);
        for (const item of node.cases) {
          if (item.test) this.value(item.test, "value", false);
          this.#statements(item.consequent);
        }
        return;
      case "BreakStatement":
      case "ContinueStatement":
        if (node.label) {
          this.#unsupported(node, "Labels are not supported in setup code.");
        }
        return;
      // A `throw` in a `try` block, a `try` without a `catch` and `finally` are the language's on
      // every target: React opts a component the React Compiler cannot compile out of it
      // (ADR-0046).
      case "ThrowStatement":
        this.value(node.argument, "value", false);
        return;
      case "TryStatement":
        this.#statements(node.block.body);
        if (node.handler) {
          if (node.handler.param) {
            this.#computedKeys(node.handler.param);
            for (const name of patternNames(node.handler.param)) {
              this.#locals.set(name, { kinds: UNKNOWN, read: true });
              localShadowing(name, this.#context);
            }
          }
          this.#statements(node.handler.body.body);
        }
        if (node.finalizer) this.#statements(node.finalizer.body);
        return;
      case "EmptyStatement":
        return;
      case "LabeledStatement":
        this.#unsupported(node, "Labels are not supported in setup code.");
        this.#statement(node.body);
        return;
      case "DebuggerStatement":
        this.#unsupported(node, "`debugger` is not supported in setup code.");
        return;
      case "FunctionDeclaration":
        this.#rejected(
          node,
          "Functions declared inside other code are not supported: declare a local function at the top level of the component's body, or write an arrow function.",
        );
        return;
      case "ClassDeclaration":
        this.#rejected(node, "Classes are not supported in setup code.");
        return;
      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration":
      case "TSEnumDeclaration":
      case "TSModuleDeclaration":
        this.#rejected(
          node,
          "Types declared inside code are not supported: declare them at the module's top level.",
        );
        return;
      default:
        this.#rejected(node, "This statement is not supported in setup code yet.");
    }
  }

  /** A `const` or a `let` in setup code: names local to it, with the kinds of their values. */
  #declaration(node: AST.VariableDeclaration): void {
    if (node.kind === "var") this.#unsupported(node, VAR);
    else if (node.kind !== "const" && node.kind !== "let") {
      this.#unsupported(node, `\`${node.kind}\` declarations are not supported in setup code.`);
    }
    for (const declarator of node.declarations) {
      const value = declarator.init ? this.value(declarator.init, "value", false) : UNDEFINED;
      const { id } = declarator;
      if (id.type === "Identifier") {
        const annotated = id.typeAnnotation
          ? this.#context.types.kindsOf(id.typeAnnotation.typeAnnotation)
          : undefined;
        this.#locals.set(id, {
          kinds:
            annotated ??
            (declarator.init && node.kind !== "const"
              ? widened(declarator.init, this.knownOf)
              : value),
          read: false,
        });
        localShadowing(id, this.#context);
        continue;
      }
      this.#computedKeys(id);
      for (const fallback of patternDefaults(id)) this.value(fallback, "value", false);
      for (const name of patternNames(id)) {
        this.#locals.set(name, { kinds: UNKNOWN, read: false });
        localShadowing(name, this.#context);
      }
    }
  }

  /**
   * An assignment in setup code (ADR-0045): a write of a `state` binding's value or of a setup
   * `let` is a `Write` reference, in client code only, as a statement of its own (UF2011); what
   * a prop, a derived value, a template ref, a constant, a function, `emit` or a loop variable
   * holds is not written (UF2011). A function-local name is written as it is, and a member of an
   * object is the rules' to judge (UF2004).
   */
  #assignment(node: AST.AssignmentExpression, position: Position): Kinds {
    const target = this.#target(node.left);
    if (target.kind === "member") {
      this.value(node.left as AST.Expression, "value", false);
      this.#memberWrite(node, withoutAssertions(node.left) as AST.MemberExpression, position);
    }
    if (target.members) this.#patternWrite(node, target.members, position);
    if (target.kind === "binding" && this.#write(node, target.binding, node.operator, position)) {
      const at = this.#bodies.get(node);
      this.refs.push(
        createWriteReference(
          target.binding.id,
          node.operator,
          at ?? span(node),
          span(node.left),
          span(node.right),
          at !== undefined,
          this.#writtenNarrowing(node.left, target.binding, node.operator),
        ),
      );
    }
    return this.value(node.right, "value", false);
  }

  /**
   * The target of a write whose operator reads it (`+=`, `++`), where a condition around the
   * write shows it present (`if (count.value !== null) count.value += 1`, ADR-0046): the source's
   * TypeScript narrows it there, and a target that reads it through a call asserts it.
   */
  #writtenNarrowing(
    target: AST.AssignmentTarget | AST.SimpleAssignmentTarget,
    binding: SetupBinding,
    operator: string,
  ): NarrowedPath[] {
    if (binding.kind !== "state" || !READING_WRITES.has(operator) || !mayBeAbsent(binding.kinds)) {
      return [];
    }
    const path = referencePath(target as AST.Expression, this.#context);
    if (!path) return [];
    const facts = pathFacts(target, path, binding.kinds, this.#context, this.knownOf);
    return facts.some((fact) => fact.present && fact.scope === "local")
      ? [createNarrowedPath(span(target), "local")]
      : [];
  }

  /** An update in setup code: as an assignment's target, `++` and `--` write (ADR-0045). */
  #update(node: AST.UpdateExpression, position: Position): Kinds {
    const target = this.#target(node.argument as AST.AssignmentTarget);
    if (target.kind === "member") {
      this.value(node.argument as AST.Expression, "value", false);
      this.#memberWrite(node, withoutAssertions(node.argument) as AST.MemberExpression, position);
    }
    if (target.kind === "binding" && this.#write(node, target.binding, node.operator, position)) {
      const at = this.#bodies.get(node);
      this.refs.push(
        createWriteReference(
          target.binding.id,
          node.operator,
          at ?? span(node),
          span(node.argument),
          undefined,
          at !== undefined,
          this.#writtenNarrowing(node.argument, target.binding, node.operator),
        ),
      );
    }
    return NUMBER;
  }

  /**
   * A write of an object's member (ADR-0045): a change in place (UF2004) unless the object holds a
   * value code may change, and never of an element's text or markup through a template ref
   * (UF3028).
   */
  #memberWrite(
    node: AST.AssignmentExpression | AST.UpdateExpression,
    target: AST.MemberExpression,
    position: Position,
  ): void {
    if (target.type !== "MemberExpression" || target.object.type === "Super") return;
    const name = memberName(target);
    const part = elementPart(target.object);
    if (part && this.#rendered(part.owner)) {
      this.#renderedChange(
        node,
        `Setting \`${part.part}.${name ?? "[…]"}\``,
        part.part,
        part.owner,
      );
      return;
    }
    if (
      name !== undefined &&
      (name === "className" || name === "style") &&
      this.#rendered(target.object)
    ) {
      this.#renderedChange(
        node,
        `Setting \`${name}\``,
        name === "style" ? "style" : "classList",
        target.object,
      );
      return;
    }
    if (
      name !== undefined &&
      !target.computed &&
      DOM_MANIPULATING_PROPERTIES.has(name) &&
      this.#rendered(target.object)
    ) {
      this.#domManipulation(node, name, false);
      return;
    }
    const how =
      node.type === "UpdateExpression" ? `\`${node.operator}\` changes` : "An assignment changes";
    this.#mutation(node, target.object, how, position, undefined);
  }

  /**
   * The member targets of a destructuring assignment, or a loop's target, each written in place
   * (UF2004, UF3028): one report for the assignment, at it, with the likely fix that copies the
   * ref's value, writes the copy and then writes it whole (`[items.value[i], items.value[j]] = …`).
   */
  #patternWrite(
    node: AST.AssignmentExpression | AST.AssignmentTarget,
    members: readonly AST.MemberExpression[],
    position: Position,
  ): void {
    let first: { member: AST.MemberExpression; origin: Provenance } | undefined;
    for (const member of members) {
      if (member.object.type === "Super") continue;
      const name = memberName(member);
      const part = elementPart(member.object);
      if (part && this.#rendered(part.owner)) {
        this.#renderedChange(
          member,
          `Setting \`${part.part}.${name ?? "[…]"}\``,
          part.part,
          part.owner,
        );
        continue;
      }
      if (
        name !== undefined &&
        (name === "className" || name === "style") &&
        this.#rendered(member.object)
      ) {
        this.#renderedChange(
          member,
          `Setting \`${name}\``,
          name === "style" ? "style" : "classList",
          member.object,
        );
        continue;
      }
      if (
        name !== undefined &&
        !member.computed &&
        DOM_MANIPULATING_PROPERTIES.has(name) &&
        this.#rendered(member.object)
      ) {
        this.#domManipulation(member, name, false);
        continue;
      }
      const origin = this.#originOf(member.object, new Set());
      if (!mutable(origin)) first ??= { member, origin };
    }
    if (!first) return;
    const { source, reporter } = this.#context;
    const object = first.member.object as AST.Expression;
    const text = source.slice(object.start, object.end);
    const fix =
      node.type === "AssignmentExpression"
        ? this.#copyAndWrite(node, members, position)
        : undefined;
    reporter.report(
      "UF2004",
      node,
      `${node.type === "AssignmentExpression" ? "A destructuring assignment changes" : "A loop's assignment changes"} ${first.origin.what ?? `\`${text.length > 40 ? `${text.slice(0, 40)}…` : text}\``} in place: state is replaced whole (ADR-0008), and no target sees a change made in place.`,
      {
        help: "Write a copy and then the copy whole: `const next = [...items.value]; [next[i], next[j]] = [next[j]!, next[i]!]; items.value = next;`.",
        ...(fix ? { fixes: [fix] } : {}),
      },
    );
  }

  /**
   * The likely fix of UF2004 for a destructuring assignment whose member targets are all a
   * state's value's own members (`items.value[i]`): copy the value, assign the copy's members
   * and write the copy whole, in a statement of its own.
   */
  #copyAndWrite(
    node: AST.AssignmentExpression,
    members: readonly AST.MemberExpression[],
    position: Position,
  ): Fix | undefined {
    if (position !== "statement" || node.operator !== "=") return undefined;
    const { source, component } = this.#context;
    let binding: SetupBinding | undefined;
    for (const member of members) {
      const object = unwrapExpression(member.object as AST.Expression);
      if (
        object.type !== "MemberExpression" ||
        object.object.type !== "Identifier" ||
        object.computed ||
        object.property.type !== "Identifier" ||
        object.property.name !== "value"
      ) {
        return undefined;
      }
      const found = setupBindingOf(object.object, this.#context);
      if (found?.kind !== "state" || (binding && binding !== found)) return undefined;
      binding = found;
    }
    if (!binding) return undefined;
    const held = binding.kinds;
    const array = has(held, "array") && !outside(held, ["array"]).length;
    const shape =
      has(held, "object") &&
      !has(held, "unknown") &&
      !outside(held, ["object"]).length &&
      (held.objects?.length ?? 0) > 0;
    if (!array && !shape) return undefined;
    const ancestors = ancestorsOf(node, component);
    const statement = ancestors.at(-2);
    if (statement?.type !== "ExpressionStatement" || ancestors.at(-3)?.type !== "BlockStatement") {
      return undefined;
    }
    const text = source.slice(component.start, component.end);
    const local = ["next", "copy", "updated"].find(
      (candidate) => !new RegExp(`(?<![\\w$])${candidate}(?![\\w$])`).test(text),
    );
    if (!local) return undefined;
    const written = `${binding.name}.value`;
    const lineStart = source.lastIndexOf("\n", statement.start - 1) + 1;
    const indent = /^[\t ]*/.exec(source.slice(lineStart, statement.start))![0];
    // Every read of the value in the assignment reads the copy, which holds the same members.
    const reads: AST.Node[] = [];
    visitNodes(node, (child) => {
      if (
        child.type === "MemberExpression" &&
        !child.computed &&
        child.object.type === "Identifier" &&
        child.property.type === "Identifier" &&
        child.property.name === "value" &&
        setupBindingOf(child.object, this.#context) === binding
      ) {
        reads.push(child);
      }
    });
    return {
      title: `Write a copy of \`${written}\`, then the copy whole`,
      confidence: "likely",
      edits: [
        {
          span: { start: statement.start, end: statement.start },
          text: `const ${local} = ${array ? `[...${written}]` : `{ ...${written} }`};\n${indent}`,
        },
        ...reads.map((read) => ({ span: span(read), text: local })),
        {
          span: { start: statement.end, end: statement.end },
          text: `\n${indent}${written} = ${local};`,
        },
      ],
    };
  }

  /** What an assignment writes, reporting what may not be written (UF2011, UF2001). */
  #target(node: AST.AssignmentTarget | AST.SimpleAssignmentTarget): Target {
    const context = this.#context;
    const { reporter } = context;
    const invalid = (
      at: { start: number; end: number },
      message: string,
      help?: string,
    ): Target => {
      reporter.report("UF2011", at, message, help ? { help } : {});
      return { kind: "invalid" };
    };
    switch (node.type) {
      case "Identifier": {
        const resolution = context.scopes.resolve(node);
        if (resolution.kind === "variable" && resolution.scope === context.component) {
          const binding = context.setup.bindings.get(resolution.declaration);
          if (!binding) return { kind: "invalid" };
          if (binding.kind === "localVar") return { kind: "binding", binding };
          return isRef(binding)
            ? invalid(
                node,
                `\`${binding.name}\` is a ref: what it holds is written as \`${binding.name}.value\`.`,
              )
            : invalid(
                node,
                `\`${binding.name}\` is ${WHAT[binding.kind]}, which code does not write.`,
                binding.kind === "localConst"
                  ? "Declare it with `ref` to change it, and write its `.value`."
                  : undefined,
              );
        }
        if (resolution.kind === "parameter") {
          if (resolution.function === context.component) {
            if (context.propsObject?.declaration === resolution.declaration) {
              this.#wholeProps(node);
              return { kind: "invalid" };
            }
            return invalid(
              node,
              `\`${node.name}\` is a prop, which only the component's parent sets.`,
              `Copy it into a ref to change it: \`const ${node.name}Value = ref(${node.name});\`.`,
            );
          }
          if (context.loopVariables.has(resolution.declaration)) {
            return invalid(
              node,
              `\`${node.name}\` is a list's item or index, which the list sets.`,
            );
          }
          return { kind: "local" };
        }
        if (resolution.kind === "variable") {
          if ((resolution.scope as AST.Node).type === "Program") {
            this.#unsupported(
              node,
              `\`${node.name}\` is declared at the module's top level, which a component cannot read yet: module-level declarations land in M5.`,
            );
            return { kind: "invalid" };
          }
          return { kind: "local" };
        }
        if (resolution.kind === "import") {
          return invalid(node, `\`${node.name}\` is an import, which code does not write.`);
        }
        this.#unresolved(node);
        return { kind: "invalid" };
      }
      case "MemberExpression": {
        const { object } = node;
        if (object.type === "Identifier") {
          if (this.#isPropsObject(object)) {
            reporter.report(
              "UF2001",
              node,
              `\`${context.source.slice(node.start, node.end)}\` is a prop, which only the component's parent sets.`,
              { help: "Copy it into a ref to change it." },
            );
            return { kind: "invalid" };
          }
          const binding = setupBindingOf(object, context);
          if (
            binding &&
            isRef(binding) &&
            !node.computed &&
            node.property.type === "Identifier" &&
            node.property.name === "value" &&
            object.start === node.start &&
            !node.optional
          ) {
            if (binding.kind === "state") return { kind: "binding", binding };
            return invalid(
              node,
              binding.kind === "derived"
                ? `\`${binding.name}\` is a computed value, which follows its getter: code does not write it.`
                : `\`${binding.name}\` is a template ref, which its element sets.`,
              binding.kind === "derived" ? "Write the state it is computed from." : undefined,
            );
          }
        }
        return { kind: "member" };
      }
      case "ArrayPattern":
      case "ObjectPattern": {
        this.#computedKeys(node);
        // Destructuring writes each target on its own: a function-local name, or an object's
        // member, which its caller judges (UF2004); a write of state is `x.value = …`, a
        // statement of its own.
        let result: Target = { kind: "local" };
        const members: AST.MemberExpression[] = [];
        for (const { target, fallback } of assignedTargets(node)) {
          if (fallback) this.value(fallback, "value", false);
          const found = this.#target(target);
          if (found.kind === "member") {
            this.value(target as AST.Expression, "value", false);
            const member = withoutAssertions(target as AST.Expression);
            if (member.type === "MemberExpression") members.push(member);
          }
          members.push(...(found.members ?? []));
          if (found.kind === "binding") {
            reporter.report(
              "UF2011",
              target,
              "A destructuring assignment writes this value: a write of state is a statement of its own, `x.value = …`.",
            );
          }
          if (found.kind === "binding" || found.kind === "invalid") result = { kind: "invalid" };
        }
        return members.length ? { ...result, members } : result;
      }
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion": {
        // Judged as the target it asserts, so that its fix reveals nothing new.
        const found = this.#target(node.expression as AST.SimpleAssignmentTarget);
        if (found.kind === "binding") this.#assertedTarget(node);
        return found;
      }
      default:
        this.#unsupported(node, "This assignment's target is not supported in setup code.");
        return { kind: "invalid" };
    }
  }

  /**
   * Checks a write of a binding where it is (ADR-0045, UF2011): client code only, an operator a
   * setter takes, and a statement of its own, which every target can rewrite into a setter call.
   * A setup function whose expression body is the write gets a block body (the fix). Returns
   * whether it is a valid write.
   */
  #write(
    node: AST.AssignmentExpression | AST.UpdateExpression,
    binding: SetupBinding,
    operator: string,
    position: Position,
  ): boolean {
    const { reporter } = this.#context;
    const target = binding.kind === "state" ? `${binding.name}.value` : binding.name;
    if (this.#mode !== "client") {
      reporter.report(
        "UF2011",
        node,
        `\`${target}\` is written in ${this.#mode === "render" ? "a template expression" : "a getter or an initial value"}, which is pure: only client code writes state (a handler, a watcher's callback, \`watchEffect\`, a lifecycle hook or a function they call).`,
      );
      return false;
    }
    if (BITWISE_ASSIGNMENTS.has(operator)) {
      this.#unsupported(
        node,
        `Bitwise and shift assignments (\`${operator}\`) to state are not supported: write \`${target} = ${target} ${operator.slice(0, -1)} …\`.`,
      );
      return false;
    }
    if (position === "statement" || position === "discarded") return true;
    const body = this.#bodies.get(node);
    if (body && (position === "nested" || position === "value")) {
      // The arrow's value is a call's to use: `map` and `then` use it, and the setter of React,
      // Solid's batch and Angular's `set` return nothing, so the write is a statement of its own.
      const discarded = this.#arrowUses.get(node) === "discarded";
      reporter.report(
        "UF2011",
        node,
        `An arrow function whose expression body writes \`${target}\` returns the written value, which the targets that write state through a setter do not have: a call such as \`map\` or \`then\` would use it.`,
        {
          help: "Give the arrow function a block body, so that the write is a statement of its own, and return what the call needs.",
          fixes: [
            {
              title: "Give the arrow function a block body",
              confidence: discarded ? "safe" : "likely",
              edits: [
                { span: { start: body.start, end: body.start }, text: "{ " },
                { span: { start: body.end, end: body.end }, text: "; }" },
              ],
            },
          ],
        },
      );
      return false;
    }
    if (position === "returned") {
      // Two insertions, so that the fixes inside the body still apply beside this one.
      const at = this.#bodies.get(node)!;
      reporter.report(
        "UF2011",
        node,
        `A setup function whose expression body writes \`${target}\` returns the written value, which the targets that write state through a setter do not have.`,
        {
          help: "Give the function a block body, so that the write is a statement of its own.",
          fixes: [
            {
              title: "Give the function a block body",
              confidence: "safe",
              edits: [
                { span: { start: at.start, end: at.start }, text: "{ " },
                { span: { start: at.end, end: at.end }, text: "; }" },
              ],
            },
          ],
        },
      );
      return false;
    }
    reporter.report(
      "UF2011",
      node,
      `\`${target}\` is written inside another expression: a write is a statement of its own, which the targets that write state through a setter rewrite into a call.`,
      { help: "Write it as a statement, and read the value from it afterwards." },
    );
    return false;
  }

  #unary(node: AST.UnaryExpression): Kinds {
    const render = this.#mode === "render";
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
        if (render && this.#context.source[argument.start] === "/" && !between.includes("(")) {
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
        if (render) {
          this.#unsupported(
            node,
            "Bitwise operators are not supported in template expressions yet.",
          );
        }
        this.value(node.argument, "value", false);
        return NUMBER;
      case "void":
        if (render) return this.#impure(node, "`void` exists for its operand's side effects");
        this.value(node.argument, "value", false);
        return UNDEFINED;
      default: {
        if (render) return this.#impure(node, "`delete` changes an object");
        this.value(node.argument, "value", false);
        const argument = unwrapExpression(node.argument);
        if (argument.type === "MemberExpression" && argument.object.type !== "Super") {
          const part = elementPart(argument.object);
          if (part && this.#rendered(part.owner)) {
            this.#renderedChange(
              node,
              `\`delete\` of \`${part.part}\`'s member`,
              part.part,
              part.owner,
            );
          } else {
            this.#mutation(node, argument.object, "`delete` changes", "value", undefined);
          }
        }
        return BOOLEAN;
      }
    }
  }

  #binary(node: AST.BinaryExpression | AST.PrivateInExpression): Kinds {
    const render = this.#mode === "render";
    const { operator } = node;
    if (node.left.type === "PrivateIdentifier") {
      this.#unsupported(
        node,
        render
          ? "`#x in obj` is not supported in template expressions."
          : "`#x in obj` is not supported in setup code.",
      );
      this.#skip(node.right);
      return BOOLEAN;
    }
    if (operator === "in" || operator === "instanceof") {
      if (render) {
        this.#unsupported(node, `\`${operator}\` is not supported in template expressions yet.`);
      }
      this.value(node.left, "value", false);
      this.value(node.right, "value", false);
      return BOOLEAN;
    }
    const left = this.value(node.left, "value", false);
    const right = this.value(node.right, "value", false);
    const pending = this.#concatenations.get(node);
    if (pending) {
      this.#concatenations.delete(node);
      if (!(onlyStrings(left) || onlyStrings(right))) for (const report of pending) report();
    }
    if (COMPARISON.has(operator)) return BOOLEAN;
    if (!ARITHMETIC.has(operator)) {
      if (render) {
        this.#unsupported(
          node,
          operator === "|"
            ? "The bitwise operator `|` is not supported in template expressions: Angular reads `|` as a pipe."
            : "Bitwise operators are not supported in template expressions yet.",
        );
      }
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
      if (this.#mode !== "render") return union(without(left, "null", "undefined"), right);
      const token = findToken(source, node.left.end, node.right.start, "??");
      if (mayBeNullish(left)) {
        if (token) {
          const at = { start: token.start, end: token.start + 2 };
          this.#narrowedApart(node.left, at, "??");
        }
        return union(without(left, "null", "undefined"), right);
      }
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
    return union(falsyPart(left), right);
  }

  /** Reports an expression that changes something (UF3021), without walking into it. */
  #impure(node: { start: number; end: number }, why: string): Kinds {
    this.#context.reporter.report(
      "UF3021",
      node,
      `${why}: a template expression must not change anything, and renders the same however often it runs.`,
      { help: "Compute the value without side effects, from the props and the setup's values." },
    );
    this.#skip(node);
    return UNKNOWN;
  }

  #unsupported(node: { start: number; end: number }, message: string, help?: string): void {
    this.#context.reporter.unsupported(node, message, help ? { help } : {});
  }

  /**
   * Walks the computed keys of a destructuring pattern, in a declaration, a parameter or an
   * assignment alike: their names are read.
   */
  #computedKeys(pattern: unknown): void {
    if (!pattern || typeof pattern !== "object") return;
    const node = pattern as AST.Node;
    switch (node.type) {
      case "AssignmentPattern":
        this.#computedKeys(node.left);
        return;
      case "RestElement":
        this.#computedKeys(node.argument);
        return;
      case "ArrayPattern":
        for (const element of node.elements) this.#computedKeys(element);
        return;
      case "ObjectPattern":
        for (const property of node.properties) {
          if (property.type === "RestElement") {
            this.#computedKeys(property);
            continue;
          }
          if (property.computed) this.value(property.key as AST.Expression, "value", false);
          this.#computedKeys(property.value);
        }
        return;
      default:
        return;
    }
  }

  /**
   * A write of state or of a setup `let` whose target is wrapped in a type assertion
   * (`count.value! = …`, `(timer as number) = …`, `count.value!++`): UF1002, as the IR's `Write`
   * names the binding and the outputs respell its target (a setter, a signal's `set`, a ref's
   * `current`), which the assertion would hide (ADR-0045). The likely fix writes the target bare
   * (its parentheses go too); the value can carry the assertion instead. A local's or a member's
   * target may be asserted: the outputs copy it, and React opts out of the React Compiler there
   * (ADR-0046).
   */
  #assertedTarget(
    node:
      | AST.TSAsExpression
      | AST.TSSatisfiesExpression
      | AST.TSNonNullExpression
      | AST.TSTypeAssertion,
  ): void {
    const { source, comments } = this.#context;
    const inner = withoutAssertions(node);
    // The parser keeps no node for parentheses: take each pair around the target.
    let start = node.start;
    let end = node.end;
    for (;;) {
      let before = start - 1;
      while (before >= 0 && /\s/.test(source[before]!)) before--;
      const after = skipTrivia(source, end);
      if (source[before] !== "(" || source[after] !== ")") break;
      start = before;
      end = after + 1;
    }
    const at = { start, end };
    const commented = comments.some((comment) => comment.start >= start && comment.end <= end);
    this.#context.reporter.unsupported(
      node,
      "A type assertion on the target of a write of state or of a setup `let` is not supported: the outputs respell that target (a setter, a signal's `set`, a ref's `current`), which the assertion would hide.",
      {
        help: "Write the target bare, and assert the value instead where its type needs it (`count.value = value as number`).",
        ...(commented
          ? {}
          : {
              fixes: [
                {
                  title: "Write the target without the assertion",
                  confidence: "likely" as const,
                  edits: [{ span: at, text: source.slice(inner.start, inner.end) }],
                },
              ],
            }),
      },
    );
  }
}

/**
 * An assignment's target without the type assertions around it (`x!`, `(x as T)`), which
 * UF1002 reports: judged as the target it asserts, so that the fix reveals nothing new.
 */
function withoutAssertions(node: AST.Node): AST.Node {
  let inner = node;
  while (
    inner.type === "TSAsExpression" ||
    inner.type === "TSSatisfiesExpression" ||
    inner.type === "TSNonNullExpression" ||
    inner.type === "TSTypeAssertion"
  ) {
    inner = inner.expression;
  }
  return inner;
}

/** Why `var` is not supported. */
const VAR = "`var` is not supported in setup code: declare a name with `const` or `let`.";

/** What each kind of setup binding is, for messages. */
const WHAT: Readonly<Record<SetupBinding["kind"], string>> = {
  state: "a ref",
  derived: "a computed value",
  templateRef: "a template ref",
  localConst: "a constant the setup declares",
  localFn: "a local function",
  localVar: "a setup `let`",
  emit: "the component's `emit`",
  model: "a model",
  slots: "the component's slots",
  slotScope: "a slot's props",
  context: "an injected value",
  component: "a component",
};

/** Whether a setup binding is a ref, whose value is read and written as `x.value`. */
export function isRef(binding: SetupBinding): boolean {
  return binding.kind === "state" || binding.kind === "derived" || binding.kind === "templateRef";
}

/** The targets a destructuring assignment writes, each with the default written for it. */
function assignedTargets(
  pattern: AST.AssignmentTargetPattern,
): { target: AST.AssignmentTarget; fallback?: AST.Expression }[] {
  const found: { target: AST.AssignmentTarget; fallback?: AST.Expression }[] = [];
  const add = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const typed = node as AST.Node;
    if (typed.type === "AssignmentPattern") {
      found.push({ target: typed.left as AST.AssignmentTarget, fallback: typed.right });
    } else if (typed.type === "RestElement") {
      add(typed.argument);
    } else if (typed.type === "ArrayPattern") {
      for (const element of typed.elements) add(element);
    } else if (typed.type === "ObjectPattern") {
      for (const property of typed.properties) {
        add(property.type === "RestElement" ? property : property.value);
      }
    } else {
      found.push({ target: typed as AST.AssignmentTarget });
    }
  };
  add(pattern);
  return found;
}

/** The union of two sets of template refs, `undefined` where either is unknown. */
/**
 * The values a function returns: its expression body, or the argument of each `return` in its
 * block, outside the functions in it.
 */
function returnedOf(fn: AST.Function | AST.ArrowFunctionExpression): AST.Expression[] {
  if (!fn.body) return [];
  if (fn.body.type !== "BlockStatement") return [fn.body];
  const found: AST.Expression[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const typed = node as AST.Node;
    if (typeof typed.type !== "string") return;
    if (
      typed.type === "ArrowFunctionExpression" ||
      typed.type === "FunctionExpression" ||
      typed.type === "FunctionDeclaration"
    ) {
      return;
    }
    if (typed.type === "ReturnStatement" && typed.argument) found.push(typed.argument);
    for (const key of visitorKeys[typed.type] ?? []) {
      visit((typed as unknown as Record<string, unknown>)[key]);
    }
  };
  visit(fn.body.body);
  return found;
}

function unionOf<T>(a: Set<T> | undefined, b: Set<T> | undefined): Set<T> | undefined {
  return a && b ? new Set([...a, ...b]) : undefined;
}

/** Whether an expression is `null` or `undefined` written as such. */
function isNullish(node: AST.Expression): boolean {
  const inner = unwrapExpression(node);
  return (
    (inner.type === "Literal" && inner.value === null && !("regex" in inner && inner.regex)) ||
    (inner.type === "Identifier" && inner.name === "undefined")
  );
}

/** An element of a component's template, as UF3028 judges a change of its classes or style. */
interface TemplateElement {
  /** Where it is written, its children included. */
  span: Span;
  /** The template refs attached to it. */
  refs: object[];
  /** The functions its listeners run: each written in place, or the local function named. */
  listeners: object[];
  /** Whether it binds a dynamic `class` or `style` (a spread may bind either). */
  class: boolean;
  style: boolean;
}

const TEMPLATE_ELEMENTS = new WeakMap<object, TemplateElement[]>();

/**
 * The elements a component's JSX writes, with their template refs, their listeners and bound
 * parts (UF3028).
 */
function templateElements(context: RenderContext): TemplateElement[] {
  const known = TEMPLATE_ELEMENTS.get(context.component);
  if (known) return known;
  const found: TemplateElement[] = [];
  visitNodes(context.component, (jsx) => {
    if (jsx.type !== "JSXElement") return;
    const node = jsx.openingElement;
    const element: TemplateElement = {
      span: span(jsx),
      refs: [],
      listeners: [],
      class: false,
      style: false,
    };
    for (const attribute of node.attributes) {
      if (attribute.type === "JSXSpreadAttribute") {
        element.class = true;
        element.style = true;
        continue;
      }
      if (attribute.name.type !== "JSXIdentifier") continue;
      const { name } = attribute.name;
      const value = attribute.value;
      if (value?.type !== "JSXExpressionContainer") continue;
      const { expression } = value;
      if (name === "ref" && expression.type === "Identifier") {
        const binding = setupBindingOf(expression, context);
        if (binding?.kind === "templateRef") element.refs.push(binding);
      } else if (/^on[A-Z]/.test(name)) {
        if (expression.type === "ArrowFunctionExpression") element.listeners.push(expression);
        else if (expression.type === "Identifier") {
          const fn = setupBindingOf(expression, context)?.function;
          if (fn) element.listeners.push(fn);
        }
      } else if (name === "class" || name === "style") {
        // A string written in braces binds nothing that changes.
        const literal = expression.type === "Literal" && typeof expression.value === "string";
        if (!literal) element[name] = true;
      }
    }
    found.push(element);
  });
  TEMPLATE_ELEMENTS.set(context.component, found);
  return found;
}

const LISTENER_ELEMENTS = new WeakMap<object, ReadonlyMap<object, ListenerElements>>();

/** The elements whose listeners pass their event to a function, as its parameter `index`. */
interface ListenerElements {
  index: number;
  elements: Set<TemplateElement>;
}

/**
 * The elements whose listeners each function receives the event of (UF3028): a listener's own
 * function, by its first parameter, and a local function it passes the event on to, by the
 * parameter that takes it, followed through every such call.
 */
function listenerElements(context: RenderContext): ReadonlyMap<object, ListenerElements> {
  const known = LISTENER_ELEMENTS.get(context.component);
  if (known) return known;
  const found = new Map<object, ListenerElements>();
  const queue: object[] = [];
  const reach = (fn: object, index: number, elements: Iterable<TemplateElement>) => {
    let entry = found.get(fn);
    if (!entry) {
      entry = { index, elements: new Set() };
      found.set(fn, entry);
    } else if (entry.index !== index) {
      return;
    }
    const size = entry.elements.size;
    for (const element of elements) entry.elements.add(element);
    if (entry.elements.size !== size) queue.push(fn);
  };
  for (const element of templateElements(context)) {
    for (const fn of element.listeners) reach(fn, 0, [element]);
  }
  while (queue.length) {
    const fn = queue.pop() as AST.Function | AST.ArrowFunctionExpression;
    const { index, elements } = found.get(fn)!;
    const parameter = fn.params[index];
    if (parameter?.type !== "Identifier" || !fn.body) continue;
    visitNodes(fn.body, (node) => {
      if (node.type !== "CallExpression" || node.callee.type !== "Identifier") return;
      const callee = setupBindingOf(node.callee, context)?.function;
      if (!callee) return;
      for (const [at, argument] of node.arguments.entries()) {
        if (argument.type !== "Identifier") continue;
        const resolution = context.scopes.resolve(argument);
        if (resolution.kind === "parameter" && resolution.declaration === parameter) {
          reach(callee, at, elements);
        }
      }
    });
  }
  LISTENER_ELEMENTS.set(context.component, found);
  return found;
}

/** An object literal's static key: `name`, `"name"`, `0`. */
function propertyKey(key: AST.PropertyKey): string | undefined {
  if (key.type === "Identifier") return key.name;
  return key.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")
    ? String(key.value)
    : undefined;
}

/** The operators of a write that read its target first, which may rely on its narrowing. */
const READING_WRITES: ReadonlySet<string> = new Set([
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**=",
  "++",
  "--",
]);

/** Whether kinds hold `null` or `undefined`. */
function mayBeAbsent(kindsOf: Kinds): boolean {
  return has(kindsOf, "null") || has(kindsOf, "undefined");
}

/** An expression through its parentheses, TypeScript's assertions and `?.` chains. */
function unwrapExpression(node: AST.Expression | AST.Super): AST.Expression | AST.Super {
  let inner = node;
  for (;;) {
    switch (inner.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "TSInstantiationExpression":
        inner = inner.expression;
        continue;
      default:
        return inner;
    }
  }
}

/** A member's name, written as a name or as a string in brackets. */
function memberName(node: AST.MemberExpression): string | undefined {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : undefined;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : undefined;
}

/**
 * The part of an element an expression names, and the element it belongs to: `el.classList`,
 * `el.style` or `el.dataset` (UF3028).
 */
function elementPart(
  node: AST.Expression | AST.Super,
): { part: "classList" | "style" | "dataset"; owner: AST.Expression } | undefined {
  const inner = unwrapExpression(node);
  if (inner.type !== "MemberExpression" || inner.object.type === "Super") return undefined;
  const name = memberName(inner);
  return name === "classList" || name === "style" || name === "dataset"
    ? { part: name, owner: inner.object }
    : undefined;
}

/** Visits every node in a tree, depth first. */
function visitNodes(node: unknown, enter: (node: AST.Node) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) visitNodes(item, enter);
    return;
  }
  const typed = node as AST.Node;
  if (typeof typed.type !== "string") return;
  enter(typed);
  for (const key of visitorKeys[typed.type] ?? []) {
    visitNodes((typed as unknown as Record<string, unknown>)[key], enter);
  }
}

/** Whether `inner` lies in `outer`. */
function inside(inner: Span, outer: Span): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/** Where the text from `start` to `end` ends without its trailing whitespace. */
function trimmedEnd(source: string, start: number, end: number): number {
  return start + source.slice(start, end).trimEnd().length;
}

/**
 * Why `?.` or `??` on a value a condition tests is reported (`Walk.#narrowedApart`), and what
 * to write instead: Angular's checker rejects the operator where it narrows the value, and the
 * other spelling fails where some target's checker does not narrow it.
 */
function narrowedApart(
  operator: "?." | "??",
  reason: "callback" | "form",
): { message: string; help: string } {
  const [code, plain] =
    operator === "?." ? ["NG8107", "`.`"] : ["NG8102", "the value without `??`"];
  return reason === "callback"
    ? {
        message: `\`${operator}\` on a property that a condition outside the list narrows is not supported yet: Angular's checker narrows it in the list, where it rejects the \`${operator}\` (${code}), and TypeScript does not narrow a property in the JSX targets' callbacks, where ${plain} fails their type check.`,
        help: "Test the value inside the list's callback, where every target narrows it.",
      }
    : {
        message: `\`${operator}\` on a value that a condition around it tests ${UNFOLLOWED_FORMS} is not supported yet: Angular's checker rejects the \`${operator}\` (${code}) where it narrows the value, and the compiler cannot tell whether it does.`,
        help: NARROWED_HELP,
      };
}

/** The tests of a value the compiler does not follow, which TypeScript narrows its own way. */
const UNFOLLOWED_FORMS =
  "in a form the compiler does not follow (an equality with a value that is no literal, such as `member === current`)";

/** How to test a value so that every target narrows it. */
const NARROWED_HELP =
  "Test the value itself, as in `{box.inner && <p title={box.inner.title} />}` or `{count !== undefined && count > 0 && …}`, where every target narrows it.";

/**
 * Why a use of a value a condition narrows is reported (`Walk.#readApart`), and what to write
 * instead: what passes every target there.
 */
function readApart(
  reason: Exclude<Unfollowed, "form">,
  checked: boolean,
): { message: string; help: string } {
  switch (reason) {
    case "key":
      return {
        message:
          "A list's key that uses a prop a condition narrows is not supported yet other than through `?.`, `??`, a test, an equality or a string: Angular's `track` reads the prop again from its input (`this.count()`), which its checker never narrows.",
        help: "Give it a value where it may be absent, as in `(count ?? 0) + index` or `label?.length ?? 0`.",
      };
    case "closure":
      return {
        message:
          "A value that a condition outside an arrow function narrows (to be there, or to one kind of a union) is not supported yet in the arrow function other than through `?.`, `??`, a test, an equality or a string: TypeScript does not narrow a property in a closure, and Solid copies an expression's conditional with `props.x`.",
        help: 'Read it through `?.`, or give it a value with `??` (`item.includes(query ?? "")`), which every target takes there, or test it inside the arrow function or in a conditional child, whose branch keeps it.',
      };
    default:
      return {
        message: `A property that a condition outside the list narrows is not supported yet in the list's callback other than through \`?.\`, \`??\`, a test, an equality or a string: TypeScript does not narrow a property (a member, or a prop of the object form) in a callback${checked ? ", while Angular's checker narrows it, where it rejects `?.` (NG8107)" : ""}.`,
        help: checked
          ? "Test the value inside the list's callback, where every target narrows it."
          : "Read it through `?.` or give it a value with `??`, which every target takes there, or test it inside the list's callback.",
      };
  }
}

/** Whether a value is a string, which `+` concatenates whatever the other side is. */
function onlyStrings(kindsOf: Kinds): boolean {
  return kindsOf.primitives.size > 0 && [...kindsOf.primitives].every((kind) => kind === "string");
}

/** Whether kinds list two literals or more of a kind (`"sm" | "md"`, `boolean`), which a test narrows. */
function hasLiterals(kindsOf: Kinds): boolean {
  return (
    (kindsOf.strings?.size ?? 0) > 1 ||
    (kindsOf.numbers?.size ?? 0) > 1 ||
    (has(kindsOf, "boolean") && kindsOf.booleans?.size !== 1)
  );
}

/** A value whose narrowing UF3031 judges: a ref's value, or a prop outside the template. */
type Narrowable = { kind: "ref"; binding: SetupBinding } | { kind: "prop"; prop: PropBinding };

/** The uses of a narrowed value that flow it whole into a local, a result or an assignment. */
const LOCAL = "a local's initial value";
const RESULT = "a function's result";
const ASSIGNED = "an assignment of it";
const LITERAL = "a member of a literal that goes whole elsewhere";
const FLOWS: ReadonlySet<string> = new Set([LOCAL, RESULT, ASSIGNED, LITERAL]);

/**
 * Where the conditions that narrow a read start (UF3031): the first statement, in a block of the
 * read's own function, that holds one of them, and the statements whose reads a local read before
 * it replaces. A statement around the read (an `if` whose branch holds it, or one whose `?:` or
 * `&&` does) is its own region; a guard clause before the read (`if (!user) return;`) leads the
 * rest of its block.
 */
interface NarrowingAnchor {
  statement: AST.Statement;
  region: AST.Statement[];
  /** The block that holds the statement, where the local is declared. */
  block: AST.BlockStatement;
}

/** The anchor of the conditions that narrow a read (see {@link NarrowingAnchor}). */
function narrowingAnchor(
  ancestors: readonly AST.Node[],
  facts: readonly { condition: AST.Expression }[],
  component: AST.Node,
): NarrowingAnchor | undefined {
  // The blocks around the read in its own function, which is code's: the component's own body
  // is the setup and the template, where no local goes.
  let first = -1;
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const node = ancestors[index]!;
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      first = node === component ? -1 : index + 1;
      break;
    }
  }
  if (first < 0) return undefined;
  let found: NarrowingAnchor | undefined;
  for (const { condition } of facts) {
    for (let index = ancestors.length - 2; index >= first; index--) {
      const block = ancestors[index]!;
      if (block.type !== "BlockStatement") continue;
      const statements = block.body as AST.Statement[];
      const holder = statements.find(
        (statement) => statement.start <= condition.start && condition.end <= statement.end,
      );
      if (!holder) continue;
      const around = ancestors[index + 1] === holder;
      if (!found || holder.start < found.statement.start) {
        found = {
          statement: holder,
          region: around ? [holder] : statements.slice(statements.indexOf(holder)),
          block,
        };
      }
      break;
    }
  }
  return found;
}

/**
 * Whether a path's kinds are any a condition may narrow (ADR-0046): `null` or `undefined`, several
 * object shapes, or a union of kinds or of literals.
 */
function narrowable(kindsOf: Kinds): boolean {
  if (mayBeAbsent(kindsOf)) return true;
  return severalShapes(kindsOf) || isUnion(kindsOf) || literalUnion(kindsOf);
}

/** Whether kinds are objects of several shapes, which a discriminant narrows. */
function severalShapes(kindsOf: Kinds): boolean {
  return !outside(kindsOf, ["object"]).length && (kindsOf.objects?.length ?? 0) > 1;
}

/**
 * The kinds of a member read off a value of these kinds: an array's element by a literal index
 * may be `undefined`, as `noUncheckedIndexedAccess` says, which the targets check with.
 */
function pathMember(value: Kinds, key: string, computed: boolean): Kinds {
  const present = without(value, "null", "undefined");
  if (
    computed &&
    /^(?:0|[1-9][0-9]*)$/.test(key) &&
    present.primitives.size === 1 &&
    has(present, "array")
  ) {
    return union(elementsOf(present), UNDEFINED);
  }
  return memberOf(present, key);
}

/** Whether kinds are a union of string or number literals (`"a" | "b"`), which `===` narrows. */
function literalUnion(kindsOf: Kinds): boolean {
  return (
    !outside(kindsOf, ["string", "number"]).length &&
    !has(kindsOf, "unknown") &&
    (kindsOf.strings?.size ?? 0) + (kindsOf.numbers?.size ?? 0) > 1
  );
}

/** Whether every kind of a value has a member, which reads alike whichever it is. */
function sharedMember(kindsOf: Kinds, name: string): boolean {
  if (name === "toString" || name === "valueOf") return true;
  return name === "length" && !outside(kindsOf, ["string", "array"]).length;
}

/**
 * Whether a value of the given kinds fits where the target's kinds are taken: each of its
 * primitives is one of the target's, and its literals are among the target's where the target
 * takes literals only. Objects and arrays are taken to fit; `unknown` fits anything.
 */
function fits(value: Kinds, target: Kinds): boolean {
  if (has(target, "unknown")) return true;
  for (const primitive of value.primitives) {
    if (primitive !== "unknown" && !has(target, primitive)) return false;
  }
  const literals = <T>(own: ReadonlySet<T> | undefined, taken: ReadonlySet<T> | undefined) =>
    !taken || (own !== undefined && [...own].every((item) => taken.has(item)));
  return (
    (!has(value, "string") || literals(value.strings, target.strings)) &&
    (!has(value, "number") || literals(value.numbers, target.numbers))
  );
}

/** Whether kinds hold more than one kind of value, which `typeof` or a discriminant narrows. */
function isUnion(kindsOf: Kinds): boolean {
  const primitives = [...kindsOf.primitives].filter(
    (primitive) => primitive !== "null" && primitive !== "undefined" && primitive !== "unknown",
  );
  return primitives.length > 1 || (kindsOf.objects?.length ?? 0) > 1;
}

/** A call's callee by name (`observe` for `observer.observe(…)`), for a message. */
function calleeName(callee: AST.Expression | AST.Super): string | undefined {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type !== "MemberExpression") return undefined;
  if (!callee.computed && callee.property.type === "Identifier") return callee.property.name;
  return callee.property.type === "Literal" && typeof callee.property.value === "string"
    ? callee.property.value
    : undefined;
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
 * Reports a parameter of a list or a function whose name would capture a target's rewrite
 * (UF3024): a prop's (Solid reads it as `props.label`, Angular as the template variable its
 * `@let label = this.label();` declares), a setup binding's (Angular reads each as a member of
 * its class, ADR-0045), the object form's parameter's, a loop variable's around it, an allowed
 * global's, `props` or `rawProps`, which the outputs declare, `Fragment`, which Astro's output
 * imports, one starting with `$`, as the variables Angular's `@for` declares (`$index`), or one
 * starting with `_`, as Vue's compiled code declares (`_ctx`); or a name Angular's template
 * expressions read as a keyword (`as`). The names besides the component's are
 * `reservedParameterName`'s in `@unframework/ir`, which `checkInvariants` reads too. Returns
 * whether it does.
 */
export function shadowing(parameter: AST.BindingIdentifier, context: RenderContext): boolean {
  const { name } = parameter;
  if (ANGULAR_KEYWORDS.has(name) && !ALLOWED_GLOBALS.has(name)) {
    context.reporter.report(
      "UF3024",
      parameter,
      `The parameter \`${name}\` is a keyword in Angular's template expressions, which cannot read it as a name: the Angular output would not compile.`,
      { help: "Rename the parameter." },
    );
    return true;
  }
  let what: string | undefined;
  const setup = [...context.setup.bindings.values()].find((binding) => binding.name === name);
  if (context.props.has(name)) what = `the prop \`${name}\``;
  else if (context.propsObject?.name === name) what = `the props parameter \`${name}\``;
  else if (setup) what = `${WHAT[setup.kind]} the setup declares, \`${name}\``;
  else if (context.enclosing.some((variable) => variable.name === name)) {
    what = `the list variable \`${name}\` around it`;
  } else if (ALLOWED_GLOBALS.has(name)) what = `the global \`${name}\``;
  else if (name === "props" || name === "rawProps")
    what = `\`${name}\`, which some outputs declare`;
  else if (name === "Fragment") what = "the `Fragment` Astro's output renders `<>` with";
  // Angular's `@for` declares `$index`, `$count`, `$first`, `$last`, `$even` and `$odd`.
  else if (name.startsWith("$"))
    what = "the names starting with `$` that Angular's `@for` declares";
  // Vue's compiled render and setup functions declare `_ctx`, `_cache`, `__props` and helpers
  // (`_toDisplayString`, `_ssrInterpolate`) beside the template's variables. A bare `_` is free.
  else if (name.length > 1 && name.startsWith("_"))
    what =
      "the names starting with `_` that Vue's compiled render functions declare (`_ctx`, `__props`)";
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
 * Reports a `const`, a `let` or a `catch` parameter of setup or client code that takes a name the
 * component declares (UF3024, ADR-0045): a prop's, the props object's, a setup binding's, `emit`'s,
 * a loop variable's around it, or `props` and `rawProps`, which the JSX outputs declare. The
 * targets rewrite those names in the code (`count` to `count()`, `label` to `props.label`), and
 * cannot rename a local, so the rewrite would read the local instead.
 */
export function localShadowing(local: AST.BindingIdentifier, context: RenderContext): boolean {
  const { name } = local;
  const setup = [...context.setup.bindings.values()].find((binding) => binding.name === name);
  const what = context.props.has(name)
    ? `the prop \`${name}\``
    : context.propsObject?.name === name
      ? `the props parameter \`${name}\``
      : setup
        ? `${WHAT[setup.kind]} the setup declares, \`${name}\``
        : context.enclosing.some((variable) => variable.name === name)
          ? `the list variable \`${name}\` around it`
          : name === "props" || name === "rawProps"
            ? `\`${name}\`, which some outputs declare`
            : undefined;
  if (!what) return false;
  context.reporter.report(
    "UF3024",
    local,
    `The local \`${name}\` shadows ${what}: the targets that rewrite names would read the local instead.`,
    { help: "Rename the local." },
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

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
