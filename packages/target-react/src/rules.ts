// How React spells a component's code (plan §5.4, ADR-0046): a template reads state and derived
// values as React's (`count`, `doubled`); client code reads written state through its mirror
// (`countRef.current`), derived values through their live getters (`currentDoubled()`) and the
// props deferred code reads through theirs; a write of state updates the mirror, then calls the
// setter; `emit("change", v)` calls the event's prop (`onChange?.(v)`); `nextTick` is the
// component's own, from `useNextTick`.
import {
  functionText,
  parseExpressionSource,
  parseStatementsSource,
  rewriteCode,
  writtenValue,
} from "@unframework/codegen";
import type { FunctionTextOptions, RewriteRules, RewriteSite } from "@unframework/codegen";
import type { Binding, BindingId, BindingReference, Code, FunctionCode } from "@unframework/ir";

import { assertedCode, assertedPaths } from "./narrowing.ts";
import type { ReactPlan } from "./plan.ts";

/** Prints a component's code for React: its rules, and the text its writes expand to. */
export interface ReactCode {
  /** The rules, for the JSX printer's expressions. */
  readonly rules: RewriteRules;
  /** Code with every reference spelled for `site`, and each write of state expanded. */
  code(code: Code, site: RewriteSite, overrides?: ReadonlyMap<BindingId, string>): string;
  /** A function, as {@link functionText} prints it, spelled for `site`. */
  fn(
    fn: FunctionCode,
    site: RewriteSite,
    options?: FunctionTextOptions,
    overrides?: ReadonlyMap<BindingId, string>,
  ): string;
  /**
   * A function's body as the statements of a function the target writes around it (a handler
   * with a guard, or several listeners merged): a block's statements, or an expression body as a
   * statement whose value is dropped, a write of state as its two statements.
   */
  statements(fn: FunctionCode, site: RewriteSite): string;
}

/** A write of state, as the statements it expands to once the code around it is spelled. */
interface Expansion {
  statements: string[];
  /** Whether the statements need a block: an arrow's body, or an `if`'s or a loop's. */
  block: boolean;
  /** Whether a `;` after the marker ends a statement the expansion replaces. */
  ownsSemicolon: boolean;
}

/** The React spelling of a component's code. */
export function reactCode(plan: ReactPlan): ReactCode {
  const { component } = plan;
  // A write's two statements cannot be one expression, which a rule must return: it returns a
  // marker, which is replaced once the code around it is printed. The prefix is one no source
  // code holds, so the output is the same for the same source (P8).
  const sources = component.bindings.map((binding) => binding.name).join(" ");
  let prefix = "__ufWrite";
  const all = [component, ...plan.module.types].map((part) => JSON.stringify(part)).join("");
  while (all.includes(prefix) || sources.includes(prefix)) prefix = `_${prefix}`;
  const expansions = new Map<string, Expansion>();
  let overrides: ReadonlyMap<BindingId, string> | undefined;
  // Where the code being printed has each position in the source: client code is printed with
  // the `!`s of its narrowed paths (./narrowing.ts), which move what follows them.
  let original = unmoved;

  /** What a read is overridden with: a `watchEffect`'s own value, but in what runs later. */
  const overridden = (reference: BindingReference) =>
    reference.later ? undefined : overrides?.get(reference.binding);

  /** How a read of a binding is spelled: in client code (`client`), or as render reads it. */
  const spelling = (binding: Binding, written: string, client: boolean): string => {
    switch (binding.kind) {
      case "prop": {
        const mirror = client ? plan.propMirrors.get(binding.id) : undefined;
        return mirror ? `${mirror}.current` : written;
      }
      case "state": {
        const state = plan.state.get(binding.id)!;
        return client && state.mirror ? `${state.mirror}.current` : state.name;
      }
      case "derived": {
        const derived = plan.derived.get(binding.id)!;
        return client && derived.current ? `${derived.current}()` : derived.name;
      }
      case "templateRef":
      case "localVar":
        return `${binding.name}.current`;
      case "localFn":
        return client ? (plan.clientVariants.get(binding.id) ?? binding.name) : binding.name;
      case "loopVar":
      case "localConst":
      case "emit":
        return written;
      default:
        return binding.kind satisfies never;
    }
  };

  const rules: RewriteRules = {
    binding(reference, binding, written, site) {
      const start = original(reference.span.start);
      // A read a template's condition narrows is the rendered value, as TypeScript narrows it.
      const client = site === "client" && !plan.narrowedReads.has(start);
      // A read in what the effect hands on to run later reads the value then, not the run's.
      const override = overridden(reference);
      if (override !== undefined) return override;
      const spelled = spelling(binding, written, client);
      // A read React's spelling does not narrow asserts what the source's condition shows.
      const asserted =
        client &&
        assertedPaths(plan, reference, binding, start).some(
          ({ span }) => span.end === reference.span.end,
        );
      return asserted ? `${spelled}!` : spelled;
    },
    write(write, binding, parts) {
      // React Compiler 1.0 does not lower a logical assignment (`??=`, `||=`, `&&=`, a `Todo`
      // bailout that fails L3): it is written out, `x = x ?? y`.
      const logical = LOGICAL.has(write.operator);
      if (binding.kind !== "state") {
        return logical ? `${parts.target} = ${writtenValue(write, parts)}` : undefined;
      }
      const state = plan.state.get(binding.id)!;
      const mirror = `${state.mirror!}.current`;
      const update =
        write.operator === "++" || write.operator === "--"
          ? `${mirror}${write.operator}`
          : logical
            ? `${mirror} = ${writtenValue(write, { ...parts, target: mirror })}`
            : `${mirror} ${write.operator} ${parts.value!}`;
      const marker = `${prefix}${expansions.size}__`;
      const single = plan.writePositions.get(original(write.span.start)) === "single";
      expansions.set(marker, {
        statements: [update, `${state.setter!}(${mirror})`],
        block: write.arrowBody === true || single,
        ownsSemicolon: write.arrowBody !== true && single,
      });
      return marker;
    },
    emit(emit, _binding, parts) {
      const event = plan.events.get(emit.event)!;
      const callee = event.mirror ? `${event.mirror}.current` : event.local;
      return `${callee}?.(${parts.arguments.join(", ")})`;
    },
    api: () => plan.nextTick!,
  };

  /**
   * Replaces each write's marker with its statements, and the markers of the writes those hold
   * (a write in a function the written value passes, `timer.value = setInterval(() => {
   * seconds.value += 1; })`).
   */
  const expand = (text: string): string => {
    if (!text.includes(prefix)) return text;
    const marker = `${escape(prefix)}\\d+__`;
    const pattern = new RegExp(`(?:\\(\\s*(${marker})\\s*\\)|(${marker}))(\\s*;)?`, "g");
    const expanded = text.replace(
      pattern,
      (_match, wrapped: string | undefined, bare: string | undefined, end: string | undefined) => {
        const found = expansions.get((wrapped ?? bare)!)!;
        const { block, ownsSemicolon } = found;
        const statements = found.statements.map(expand);
        const semicolon = end ?? "";
        if (!block) return `${statements.join(";\n")}${semicolon}`;
        const body = `{\n${statements.map((statement) => `${statement};`).join("\n")}\n}`;
        return ownsSemicolon ? body : `${body}${semicolon}`;
      },
    );
    return expanded;
  };

  const withOverrides = <T>(
    found: ReadonlyMap<BindingId, string> | undefined,
    print: () => T,
  ): T => {
    const outer = overrides;
    overrides = found;
    try {
      return print();
    } finally {
      overrides = outer;
    }
  };

  /** Code `print` prints, with its narrowed paths asserted in client code (`assertedCode`). */
  const asserting = <T>(code: Code, site: RewriteSite, print: (code: Code) => T): T => {
    if (site !== "client") return print(code);
    const asserted = assertedCode(code, (reference) =>
      overridden(reference) === undefined
        ? assertedPaths(plan, reference, plan.bindings.get(reference.binding)!)
        : [],
    );
    const outer = original;
    original = asserted.original;
    try {
      return print(asserted.code);
    } finally {
      original = outer;
    }
  };

  /** A function's body as statements: see {@link ReactCode.statements}. */
  const statementsOf = (fn: FunctionCode, site: RewriteSite): string => {
    const body = rewriteCode(fn.body, component, rules, site).trim();
    if (!fn.expression) return forReactCompiler(expand(body)).trim().slice(1, -1).trim();
    // A write that is the whole body is its statements, never a block in parentheses.
    const write = expansions.get(body.replace(/^\(\s*(.*?)\s*\)$/s, "$1"));
    if (write) {
      return forReactCompiler(write.statements.map((line) => `${expand(line)};`).join("\n"));
    }
    const text = expand(body);
    const statement = /^(?:\{|function\b|class\b|async\s+function\b|let\s*\[)/.test(text)
      ? `(${text});`
      : `${text};`;
    return forReactCompiler(statement);
  };

  return {
    rules,
    code: (code, site, found) =>
      withOverrides(found, () =>
        asserting(code, site, (asserted) =>
          forReactCompiler(expand(rewriteCode(asserted, component, rules, site))),
        ),
      ),
    fn: (fn, site, options, found) =>
      withOverrides(found, () =>
        asserting(fn.body, site, (body) =>
          forReactCompiler(expand(functionText({ ...fn, body }, component, rules, site, options))),
        ),
      ),
    statements: (fn, site) =>
      withOverrides(undefined, () =>
        asserting(fn.body, site, (body) => statementsOf({ ...fn, body }, site)),
      ),
  };
}

/** The position of code that holds no `!` of a narrowed path: where the source has it. */
function unmoved(position: number): number {
  return position;
}

const LOGICAL = new Set(["&&=", "||=", "??="]);

/**
 * Code as React Compiler 1.0 compiles it (L3), where the author's own code would make it bail
 * out with a `Todo` (ADR-0046): a logical assignment to a function's own variable is written out
 * (`x = x ?? y`), and an update of a variable a nested function captures (`count++` where an arrow
 * reads `count`) becomes a compound assignment: `count += 1` where its value is dropped, and an
 * expression of the same value where it is used (`(count += 1) - 1` for `count++`, `(count += 1)`
 * for `++count`). Everything else is as written.
 */
function forReactCompiler(code: string): string {
  if (!/\+\+|--|&&=|\|\|=|\?\?=/.test(code)) return code;
  // The updates first: a logical assignment's value may hold one, which its rewrite copies.
  return rewriteLogical(rewriteUpdates(code));
}

/** The AST of code that is an expression or statements, and whether it is a function. */
function parseCode(code: string): { root: unknown; base: number } {
  let root: unknown;
  try {
    root = parseExpressionSource(code).expression;
  } catch {
    root = parseStatementsSource(code).statements;
  }
  // Code that is a function (a handler, a setup function) is not nested in itself.
  const top = Array.isArray(root) ? (root.length === 1 ? root[0] : undefined) : root;
  return { root, base: isNode(top) && FUNCTIONS.has(top.type) ? 1 : 0 };
}

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/** Applies edits, none overlapping another, to code. */
function applyEdits(code: string, edits: readonly { start: number; end: number; text: string }[]) {
  let result = code;
  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

/** `x ??= y` (and `||=`, `&&=`) as `x = x ?? (y)`. */
function rewriteLogical(code: string): string {
  if (!/&&=|\|\|=|\?\?=/.test(code)) return code;
  const { root } = parseCode(code);
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isNode(node)) return;
    const fields = node as unknown as Record<string, unknown>;
    if (node.type === "AssignmentExpression" && LOGICAL.has(fields.operator as string)) {
      const left = fields.left as Node;
      const right = fields.right as Node;
      const target = code.slice(left.start, left.end);
      const value = code.slice(right.start, right.end);
      const operator = (fields.operator as string).slice(0, -1);
      edits.push({
        start: node.start,
        end: node.end,
        text: `${target} = ${target} ${operator} (${value})`,
      });
      return;
    }
    for (const [key, value] of Object.entries(fields)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  return applyEdits(code, edits);
}

/**
 * The places where an expression's value is dropped: a statement's, a loop's update, a sequence's
 * element but its last, `void`'s operand, the body of an arrow `forEach` calls (it ignores what
 * its callback returns); and from there a logical or conditional expression's operands that
 * decide no value, and what parentheses hold.
 */
function dropsValue(parent: Node, key: string, dropped: boolean, last: boolean): boolean {
  switch (parent.type) {
    case "ArrowFunctionExpression":
      return key === "body" && IGNORED_RETURNS.has(parent);
    case "ExpressionStatement":
      return key === "expression";
    case "ForStatement":
      return key === "update";
    case "SequenceExpression":
      return !last || dropped;
    case "UnaryExpression":
      return (parent as unknown as { operator: string }).operator === "void";
    case "LogicalExpression":
      return key === "right" && dropped;
    case "ConditionalExpression":
      return key !== "test" && dropped;
    case "ParenthesizedExpression":
      return dropped;
    default:
      return false;
  }
}

/** The arrows whose value their caller ignores: `forEach`'s callback. */
const IGNORED_RETURNS = new WeakSet<Node>();

/** Records the callback of a `forEach` call: what it returns is ignored. */
function noteIgnoredReturn(node: Node): void {
  const call = node as unknown as { type: string; callee?: Node; arguments?: Node[] };
  const callee = call.callee as unknown as
    | { type: string; computed?: boolean; property?: { type: string; name?: string } }
    | undefined;
  const [callback] = call.arguments ?? [];
  if (
    call.type === "CallExpression" &&
    callee?.type === "MemberExpression" &&
    !callee.computed &&
    callee.property?.name === "forEach" &&
    callback?.type === "ArrowFunctionExpression"
  ) {
    IGNORED_RETURNS.add(callback);
  }
}

/**
 * How loosely an expression may bind at a place, without parentheses: an assignment's level
 * (an argument, a statement's expression, an arrow's body…), a subtraction's (an operand of
 * `&&` or `??`, a conditional's test), or tighter (any other operand).
 */
type Level = "assignment" | "additive" | "tight";

function levelAt(parent: Node, key: string): Level {
  switch (parent.type) {
    case "ExpressionStatement":
    case "SequenceExpression":
    case "ArrowFunctionExpression":
    case "VariableDeclarator":
    case "AssignmentExpression":
    case "ArrayExpression":
    case "Property":
    case "ReturnStatement":
    case "ParenthesizedExpression":
    case "TemplateLiteral":
    case "SpreadElement":
    case "IfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
    case "SwitchStatement":
    case "SwitchCase":
      return "assignment";
    case "CallExpression":
    case "NewExpression":
      return key === "arguments" ? "assignment" : "tight";
    case "MemberExpression":
      return key === "property" && (parent as unknown as { computed: boolean }).computed
        ? "assignment"
        : "tight";
    case "ConditionalExpression":
      return key === "test" ? "additive" : "assignment";
    case "LogicalExpression":
      return "additive";
    default:
      return "tight";
  }
}

/** Updates of a variable a nested function captures, as compound assignments of the same value. */
function rewriteUpdates(code: string): string {
  if (!/\+\+|--/.test(code)) return code;
  const { root, base } = parseCode(code);
  const captured = new Set<string>();
  const updates: { node: Node; name: string; text: string }[] = [];
  const visit = (node: unknown, depth: number, dropped: boolean, level: Level): void => {
    if (!isNode(node)) return;
    const fields = node as unknown as Record<string, unknown>;
    const inner = FUNCTIONS.has(node.type) ? depth + 1 : depth;
    if (node.type === "Identifier" && depth > base) captured.add(fields.name as string);
    noteIgnoredReturn(node);
    const argument = fields.argument as (Node & { name?: string }) | undefined;
    if (node.type === "UpdateExpression" && argument?.type === "Identifier") {
      const name = argument.name!;
      const assign = `${name} ${fields.operator === "++" ? "+=" : "-="} 1`;
      const value = `(${assign}) ${fields.operator === "++" ? "-" : "+"} 1`;
      const text = dropped
        ? level === "assignment"
          ? assign
          : `(${assign})`
        : fields.prefix
          ? `(${assign})`
          : level === "tight"
            ? `(${value})`
            : value;
      updates.push({ node, name, text });
    }
    for (const [key, value] of Object.entries(fields)) {
      if (key === "type" || key === "parent" || typeof value !== "object") continue;
      const items: unknown[] = Array.isArray(value) ? value : [value];
      for (const [index, item] of items.entries()) {
        const last = index === items.length - 1;
        visit(item, inner, dropsValue(node, key, dropped, last), levelAt(node, key));
      }
    }
  };
  for (const item of Array.isArray(root) ? root : [root]) visit(item, 0, false, "assignment");
  return applyEdits(
    code,
    updates
      .filter((update) => captured.has(update.name))
      .map(({ node, text }) => ({ start: node.start, end: node.end, text })),
  );
}

/** A node of oxc's AST, as far as a walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

function escape(text: string): string {
  return text.replace(/[$]/g, "\\$");
}
