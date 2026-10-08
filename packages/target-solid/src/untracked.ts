// Where a client function's code says `untrack` (ADR-0046, ADR-0048). `solid/reactivity` (L5)
// reports a function that reads a prop, state or a derived value where nothing tracks it and
// nothing calls it as an event handler: a promise's continuation (`then`, `catch`, `finally`), an
// array method's callback it does not read as its caller's (an async one, a comparator), an arrow
// passed to a function it does not know (`update((list) => [...list, draft.value])`, a
// `queueMicrotask` callback) from a function it does not track, and an arrow kept in a variable
// (`stop = () => …`). Each runs outside any tracking scope, so `untrack` around its body changes
// nothing but says so: `(result) => untrack(() => …)`. It reads as tracked or called later a
// timer's, a listener's, a cleanup's and a `create…` helper's callback, and any arrow passed to a
// function from code it tracks or calls as a handler (a watcher's callback, a hook, a template
// listener); a setup function is neither, so it is where an arrow needs `untrack`.
import { parseCodeSource } from "@unframework/codegen";
import type { Code, CodeReference, FunctionCode, Span } from "@unframework/ir";

/** Text put into code at an offset of the source, replacing what lies before `end`, if given. */
export interface Edit {
  at: number;
  end?: number;
  text: string;
  /** How deep the wrapper it opens or closes nests: equal offsets close inner ones first. */
  depth: number;
  closing: boolean;
  /** Where a closing edit's wrapper opens: a span holding that is a span holding the wrapper. */
  opens?: number;
}

/** What placing one function's `untrack` needs. */
export interface UntrackOptions {
  /** Where the body reads a prop, state or a derived value, itself or through a call. */
  reactive: readonly Span[];
  /**
   * Whether `solid/reactivity` reads the function as a tracked scope or a handler: a watcher's
   * callback, a hook, a template listener; not a setup function.
   */
  tracked: boolean;
  /** The local name of Solid's `untrack`, claimed when used. */
  untrack: () => string;
}

/** A parsed node, as the walks below read it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "start" in value &&
    typeof value.start === "number"
  );
}

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);
/** Expressions that only say something about their operand's type. */
const TYPE_WRAPPERS = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

/** The global functions whose callback `solid/reactivity` reads as one called later. */
const TIMERS: ReadonlySet<string> = new Set([
  "requestAnimationFrame",
  "requestIdleCallback",
  "setImmediate",
  "setInterval",
  "setTimeout",
]);
/** The objects whose timers it reads so too (`window.setTimeout`). */
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(["globalThis", "self", "window"]);
/** The observers whose callback it reads so (`new ResizeObserver(() => …)`). */
const OBSERVERS: ReadonlySet<string> = new Set([
  "IntersectionObserver",
  "MutationObserver",
  "PerformanceObserver",
  "ReportingObserver",
  "ResizeObserver",
]);
/**
 * The array methods whose synchronous callback, alone in its call, `solid/reactivity` reads as
 * part of the code that calls it (eslint-plugin-solid 0.18's `checkForSyncCallbacks`).
 */
const SYNC_CALLBACK_METHODS: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
]);
/** A `create…` or `use…` name, whose arguments the rule reads as tracked. */
const PRIMITIVE = /^(?:use|create)[A-Z]/;

/** How `solid/reactivity` reads a function by where it is. */
type Position =
  /** A tracked scope, or one called later: what it reads is fine, and so are its callbacks. */
  | "tracked"
  /** Part of the code that calls it (a sync array callback, an IIFE): its reads are the caller's. */
  | "caller"
  /** A function it reports where it reads anything reactive: printed in `untrack`. */
  | "reported"
  /** Declared, returned or a property: not reported, and not tracked. */
  | "plain";

/** A function in the body: the body itself (`node` undefined), or an arrow in it. */
interface Fn {
  node: Node | undefined;
  /** Its body: a block, or an expression. */
  body: Node;
  /** Where its body is written, an expression body's parentheses included. */
  region: Span;
  async: boolean;
  position: Position;
  /** Printed in `untrack`: reported where it is, and it reads a reactive value. */
  untracked: boolean;
  /** The functions around it, innermost first. */
  outer: Fn[];
}

/**
 * The edits that wrap in `untrack` the arrows `solid/reactivity` would report (see the module
 * comment). Offsets are the source's, as the body's references are.
 */
export function untrackEdits(fn: FunctionCode, options: UntrackOptions): Edit[] {
  const { body } = fn;
  const offset = body.span.start;
  const relative = (span: Span): Span => ({ start: span.start - offset, end: span.end - offset });
  const reactive = options.reactive.map(relative);
  const { root } = parseCodeSource(body.code, fn.expression ? "expression" : "statements");
  const parsed: unknown[] = Array.isArray(root) ? root : [root];
  const nodes = parsed.filter(isNode);
  const top: Node = fn.expression
    ? nodes[0]!
    : (nodes.find((node) => node.type === "BlockStatement") ?? nodes[0]!);
  const self: Fn = {
    node: undefined,
    body: top,
    region: { start: 0, end: body.code.length },
    async: Boolean(fn.async),
    position: options.tracked ? "tracked" : "plain",
    untracked: false,
    outer: [],
  };
  const functions = collect(top, self, body.code, reactive);
  const edits: Edit[] = [];
  for (const each of functions) {
    if (!each.untracked || !each.node) continue;
    const depth = each.outer.length * 100;
    // An untracked async arrow's work moves into `untrack`'s callback, which returns its promise
    // (`(result) => untrack(async () => { … })`).
    let prefix = "";
    if (each.async) {
      const start = each.node.start;
      const keyword = /^async\s*/.exec(body.code.slice(start))![0];
      edits.push({ at: start, end: start + keyword.length, text: "", depth, closing: false });
      prefix = "async ";
    }
    edits.push({
      at: each.region.start,
      text: `${options.untrack()}(${prefix}() => `,
      depth,
      closing: false,
    });
    edits.push({
      at: each.region.end,
      text: ")",
      depth,
      closing: true,
      opens: each.region.start,
    });
  }
  return edits.map((edit) => ({
    ...edit,
    at: edit.at + offset,
    ...(edit.end === undefined ? {} : { end: edit.end + offset }),
    ...(edit.opens === undefined ? {} : { opens: edit.opens + offset }),
  }));
}

/**
 * Finds the arrows in a body, how the rule reads each by where it is, and which it reports for a
 * reactive read: its own, or one in a callback it runs at once (`list.filter((value) => value <
 * limit.value)`), as the rule counts them.
 */
function collect(root: Node, self: Fn, code: string, reactive: readonly Span[]): Fn[] {
  const functions: Fn[] = [];
  const parents = new Map<Fn, Node | undefined>();
  const visit = (node: unknown, parent: Node | undefined, around: Fn): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, parent, around);
      return;
    }
    if (!isNode(node)) return;
    let inside = around;
    if (FUNCTIONS.has(node.type) && isNode(node.body)) {
      const fn: Fn = {
        node,
        body: node.body,
        region: bodyRegion(node, code),
        async: Boolean(node.async),
        position: positionOf(node, parent, around),
        untracked: false,
        outer: [around, ...around.outer],
      };
      functions.push(fn);
      parents.set(fn, parent);
      inside = fn;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") {
        visit(value, node, inside);
      }
    }
  };
  visit(root, undefined, self);
  // Outermost first: an arrow passed to a function is tracked where the arrow around it is
  // wrapped, which is known once that one's reads are (a sync callback stays its caller's).
  for (const fn of functions) {
    fn.position = positionOf(fn.node!, parents.get(fn), fn.outer[0]!);
    if (fn.position === "reported") fn.untracked = readsReactive(fn, functions, reactive);
  }
  return functions;
}

/** Whether a function reads a reactive value in its own scope or a callback it runs at once. */
function readsReactive(fn: Fn, functions: readonly Fn[], reactive: readonly Span[]): boolean {
  const node = fn.node!;
  return reactive.some((site) => {
    if (site.start < node.start || site.end > node.end) return false;
    let owner: Fn | undefined;
    for (const each of functions) {
      if (each.node!.start <= site.start && each.node!.end >= site.end) {
        if (!owner || each.outer.length > owner.outer.length) owner = each;
      }
    }
    for (let current = owner; current && current !== fn; current = current.outer[0]) {
      if (current.position !== "caller") return false;
    }
    return true;
  });
}

/**
 * How `solid/reactivity` (eslint-plugin-solid 0.18, `checkForTrackedScopes`) reads a function by
 * where it is: a timer's, a listener's, an observer's or a `create…` call's callback is tracked,
 * as is an arrow passed to any function from a function it tracks; a sync array callback or an
 * IIFE is its caller's; a declared, returned or property arrow is plain; any other is reported
 * where it reads reactive values (`then`'s, a comparator, an arrow passed to a function from a
 * setup function, an arrow assigned to a variable).
 */
function positionOf(node: Node, parent: Node | undefined, around: Fn): Position {
  if (!parent) return "plain";
  /** Whether the function the call is in is a tracked scope (or untrack's, once wrapped). */
  const tracking = around.position === "tracked" || around.untracked;
  switch (parent.type) {
    case "CallExpression": {
      const args = Array.isArray(parent.arguments) ? parent.arguments : [];
      if (unwrap(parent.callee as Node) === node) return "caller";
      if (!args.includes(node)) return "plain";
      const callee = unwrap(parent.callee as Node);
      if (callee.type === "Identifier") {
        const name = callee.name as string;
        if (TIMERS.has(name) || PRIMITIVE.test(name)) return "tracked";
        // An arrow passed to any other function is a called function inside a tracked scope.
        return tracking ? "tracked" : "reported";
      }
      if (callee.type === "MemberExpression" && !callee.computed && isNode(callee.property)) {
        const method = callee.property.name as string;
        const object = unwrap(callee.object as Node);
        if (method === "addEventListener" && args[1] === node) return "tracked";
        if (
          object.type === "Identifier" &&
          GLOBAL_OBJECTS.has(object.name as string) &&
          TIMERS.has(method) &&
          args[0] === node
        ) {
          return "tracked";
        }
        if (PRIMITIVE.test(method)) return "tracked";
        if (syncCallback(node, parent)) return "caller";
      }
      return "reported";
    }
    case "NewExpression": {
      const callee = unwrap(parent.callee as Node);
      const args = Array.isArray(parent.arguments) ? parent.arguments : [];
      return callee.type === "Identifier" &&
        OBSERVERS.has(callee.name as string) &&
        args[0] === node
        ? "tracked"
        : "reported";
    }
    case "AssignmentExpression": {
      if (parent.right !== node) return "plain";
      const left = parent.left as Node;
      // A member `on…` is a handler.
      return left.type === "MemberExpression" &&
        !left.computed &&
        isNode(left.property) &&
        /^on[a-z]+$/.test(left.property.name as string)
        ? "tracked"
        : "reported";
    }
    case "VariableDeclarator":
    case "ReturnStatement":
    case "Property":
      return "plain";
    case "ArrowFunctionExpression":
      // Directly returned by the arrow around it.
      return parent.body === node ? "plain" : "reported";
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSNonNullExpression":
    case "TSTypeAssertion":
      return "plain";
    default:
      return "reported";
  }
}

/**
 * Whether `solid/reactivity` reads a function as part of the code that calls it: a synchronous
 * callback, alone in its call, of an array method the rule knows (`list.filter((value) => …)`).
 */
function syncCallback(node: Node, parent: Node): boolean {
  if (parent.type !== "CallExpression" || node.async) return false;
  const args = parent.arguments as unknown[];
  if (args.length !== 1 || args[0] !== node) return false;
  const callee = unwrap(parent.callee as Node);
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    isNode(callee.property) &&
    SYNC_CALLBACK_METHODS.has(callee.property.name as string) &&
    unwrap(callee.object as Node).type !== "ObjectExpression"
  );
}

/** An expression without the parentheses and type assertions around it. */
function unwrap(node: Node): Node {
  let current = node;
  while (TYPE_WRAPPERS.has(current.type) && isNode(current.expression))
    current = current.expression;
  return current;
}

/** Where an arrow's body is written: an expression body with the parentheses around it. */
function bodyRegion(node: Node, code: string): Span {
  const body = node.body as Node;
  if (body.type === "BlockStatement") return { start: body.start, end: body.end };
  let start = body.start;
  // Back over the parentheses the parser leaves out, to the `=>`.
  for (let index = body.start - 1; index > node.start; index--) {
    const char = code[index]!;
    if (char === "(") start = index;
    else if (!/\s/.test(char)) break;
  }
  return { start, end: node.end };
}

/**
 * Code with edits applied at offsets in the source (statement and function boundaries, which no
 * reference straddles), its references moved past what was put in before them.
 */
export function edited(code: Code, edits: readonly Edit[]): Code {
  const sorted = edits.toSorted(
    (a, b) =>
      a.at - b.at ||
      // At one offset, wrappers close before others open; inner ones close first and open last.
      Number(b.closing) - Number(a.closing) ||
      (a.closing ? b.depth - a.depth : a.depth - b.depth),
  );
  const shift = (offset: number, include: (edit: Edit) => boolean) =>
    offset +
    sorted
      .filter(include)
      .reduce((sum, edit) => sum + edit.text.length - ((edit.end ?? edit.at) - edit.at), 0);
  // A span starts after what is put in at its start, and ends before what is put in at its end,
  // but the end of a wrapper that opens inside it.
  const span = (value: Span): Span => ({
    start: shift(value.start, ({ at }) => at <= value.start),
    end: shift(
      value.end,
      (edit) =>
        edit.at < value.end ||
        (edit.at === value.end && edit.opens !== undefined && edit.opens > value.start),
    ),
  });
  let text = "";
  let last = code.span.start;
  for (const edit of sorted) {
    text += code.code.slice(last - code.span.start, edit.at - code.span.start) + edit.text;
    last = edit.end ?? edit.at;
  }
  text += code.code.slice(last - code.span.start);
  const refs = code.refs.map((ref): CodeReference => {
    switch (ref.kind) {
      case "Write":
        return {
          ...ref,
          span: span(ref.span),
          target: span(ref.target),
          ...(ref.value ? { value: span(ref.value) } : {}),
        };
      case "Emit":
        return { ...ref, span: span(ref.span), arguments: ref.arguments.map(span) };
      case "Binding":
      case "Global":
      case "Event":
      case "Api":
      case "Slot":
        return { ...ref, span: span(ref.span) };
      default:
        return unreachable(ref);
    }
  });
  return { code: text, span: { start: code.span.start, end: code.span.start + text.length }, refs };
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected IR value: ${JSON.stringify(value)}`);
}
