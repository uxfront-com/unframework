// The rewrite engine (plan §5.4, ADR-0035, ADR-0045). IR code keeps its source text
// exactly; a target prints it by splicing its own spelling of each reference into that text,
// never by re-printing a parsed AST: oxc-codegen prints numbers from their value (`1000` →
// `1e3`) and drops comments, while splicing keeps every literal, space and comment as the author
// wrote it. Setup code adds structural references (ADR-0045): a write or an emit is replaced
// whole, after the references inside its value or arguments, so React, Solid and Angular can
// turn `count.value += step` into a setter call.
import type * as AST from "@oxc-project/types";
import { functionsOf } from "@unframework/ir";
import type {
  ApiReference,
  Binding,
  BindingId,
  BindingReference,
  Code,
  CodeReference,
  EmitReference,
  EventReference,
  Expression,
  GlobalReference,
  Span,
  UfComponent,
  WriteReference,
} from "@unframework/ir";
import { MagicString } from "magic-string";

import { isNode, parseCodeSource, parseExpression, visitNodes } from "./parse.ts";
import type { CodeKind } from "./parse.ts";

/**
 * Where code is printed, which may change how a target spells a reference (ADR-0045):
 * - `render`: a template's expressions (interpolations, conditions, attribute values, a list's
 *   source);
 * - `key`: a list's key (Angular reads a `track` expression from the class, not from the
 *   template's `@let` declarations);
 * - `pure`: what the setup evaluates (the initial values of `ref`, `const` and `let`, and the
 *   getters of `computed` and of watch sources);
 * - `client`: what runs in the browser (handlers, watch callbacks, `watchEffect`, lifecycle hooks
 *   and the setup's functions), where state is written and events emitted.
 */
export type RewriteSite = "render" | "key" | "pure" | "client";

/** What a target's `write` hook receives besides the write itself. */
export interface WriteParts {
  /**
   * The target as the rules spell a read of it (`count`, `count()`, `this.count()`): the binding
   * rule's spelling of a reference spanning the write's target.
   */
  target: string;
  /**
   * The value with its references rewritten, parenthesised where a call's argument would need
   * it (a sequence): absent for `++` and `--`. {@link writtenValue} combines it with the target
   * for a compound operator.
   */
  value?: string;
  /** The write as written, with its target and every reference in its value respelled. */
  code: string;
}

/** What a target's `emit` hook receives besides the emit itself. */
export interface EmitParts {
  /** Each argument with its references rewritten, parenthesised where an argument needs it. */
  arguments: string[];
  /** The call as written, with every reference in its arguments respelled. */
  code: string;
}

/**
 * How a target spells the references of code. Each rule gets the site the code is printed for.
 * A rule's result is spliced where the reference is as it is, so it must bind as tightly as a
 * member access (an identifier, a member, a call): only a write's or an emit's replacement,
 * which stands alone as a statement or an arrow's body, is parenthesised where it must be.
 */
export interface RewriteRules {
  /**
   * The code that replaces a reference to one of the component's bindings: the whole
   * reference span, so `props.label` in the object form, and `count.value` for a `state`,
   * `derived` or `templateRef` binding, as well as `label`. `written` is the span's source text.
   * A shorthand property (`{ label }`) is expanded around the result. A local function called
   * there has `reference.call` (Qwik awaits its QRL: `await save` makes `await save()`).
   */
  binding(
    reference: BindingReference,
    binding: Binding,
    written: string,
    site: RewriteSite,
  ): string;
  /** The code that replaces a reference to a global: its own name when absent. */
  global?(reference: GlobalReference, site: RewriteSite): string;
  /**
   * The code that replaces a use of a handler's event parameter (`event.currentTarget`, the
   * callee `event.preventDefault`): as written when absent.
   */
  event?(reference: EventReference, site: RewriteSite): string;
  /** The code that replaces a use of an authoring API (`nextTick`): as written when absent. */
  api?(reference: ApiReference, site: RewriteSite): string;
  /**
   * The code that replaces a whole write (`count.value += step` → `setCount(count + step)`),
   * given its parts already rewritten: an expression, which stands as a statement or as an
   * arrow's expression body. `undefined`, or no hook, keeps `parts.code`: the write as written
   * with its target spelled as a read (`count += step` in a Svelte or a Vue template).
   */
  write?(
    write: WriteReference,
    binding: Binding,
    parts: WriteParts,
    site: RewriteSite,
  ): string | undefined;
  /**
   * The code that replaces a whole call of `emit` (`emit("change", count.value)` →
   * `props.onChange?.(count())`), given its arguments already rewritten: an expression, as a
   * write's. `undefined`, or no hook, keeps `parts.code`, the call as written.
   */
  emit?(
    emit: EmitReference,
    binding: Binding,
    parts: EmitParts,
    site: RewriteSite,
  ): string | undefined;
}

/**
 * Where code is spliced, which decides whether it needs parentheses there:
 * - `operand`: an operand of an operator, the object of a member access or a callee
 *   (`(a ?? []).map`, `!(a && b)`);
 * - `test`: the test of a conditional (`(a ? b : c) ? x : y`);
 * - `argument`: a position that takes any expression but a sequence: a call argument, an
 *   array element, a property value, a JSX expression container or a conditional's branch.
 */
export type ParenthesesSlot = "operand" | "test" | "argument";

const bindingsByComponent = new WeakMap<UfComponent, ReadonlyMap<BindingId, Binding>>();

/** A component's bindings by id. */
function bindingsOf(component: UfComponent): ReadonlyMap<BindingId, Binding> {
  let bindings = bindingsByComponent.get(component);
  if (!bindings) {
    bindings = new Map(component.bindings.map((binding) => [binding.id, binding]));
    bindingsByComponent.set(component, bindings);
  }
  return bindings;
}

/** The binding a component declares under `id`. Throws when it declares none: invalid IR. */
export function bindingOf(component: UfComponent, id: BindingId): Binding {
  const binding = bindingsOf(component).get(id);
  if (!binding) throw new Error(`Component ${component.name} declares no binding ${id}.`);
  return binding;
}

const blockBodies = new WeakMap<UfComponent, ReadonlySet<string>>();

/**
 * What a piece of a component's setup code is: the block body of one of its functions is
 * statements; everything else (initial values, values, expression bodies, conditions) is an
 * expression. Code alone cannot say (`{ a }`), its place in the component does.
 */
export function codeKind(code: Code, component: UfComponent): CodeKind {
  let bodies = blockBodies.get(component);
  if (!bodies) {
    bodies = new Set(
      functionsOf(component).flatMap(({ function: fn }) =>
        fn.expression ? [] : [spanKey(fn.body.span)],
      ),
    );
    blockBodies.set(component, bodies);
  }
  return bodies.has(spanKey(code.span)) ? "statements" : "expression";
}

const spanKey = ({ start, end }: Span) => `${start}:${end}`;

/**
 * A render expression's code with each reference spelled by `rules` for `site` (`render` by
 * default; `key` for a list's key), spliced at the reference's span; everything between
 * references stays as written. A shorthand property whose binding changes spelling is expanded
 * (`{ label }` → `{ label: props.label }`). Throws on a reference outside the expression or
 * overlapping another, which `checkInvariants` rules out.
 */
export function rewriteExpression(
  expression: Expression,
  component: UfComponent,
  rules: RewriteRules,
  site: RewriteSite = "render",
): string {
  return rewrite(expression, "expression", component, rules, site);
}

/**
 * Setup code with each reference spelled by `rules` for `site` (`pure` or `client`), as
 * {@link rewriteExpression} does, and each write and emit replaced whole by its hook once the
 * references inside its value or arguments are rewritten (`timer = setInterval(() =>
 * count.value++, 1000)` rewrites the inner write first). A hook's replacement is parenthesised
 * where it could not stand as a statement or as an arrow's expression body (an object literal, a
 * sequence). Throws on references that overlap other than a write's or an emit's nesting, which
 * `checkInvariants` rules out, and on a hook's replacement that is no expression.
 */
export function rewriteCode(
  code: Code,
  component: UfComponent,
  rules: RewriteRules,
  site: RewriteSite,
): string {
  return rewrite(code, codeKind(code, component), component, rules, site);
}

/** What spelling one piece of code needs. */
interface Context {
  component: UfComponent;
  rules: RewriteRules;
  site: RewriteSite;
  /** The whole code, its offset in the source and its kind. */
  code: string;
  offset: number;
  kind: CodeKind;
  /** The shorthand properties' values in the code, by offset in the source: read once. */
  shorthands?: ReadonlySet<number>;
}

/** A reference, with the references inside its value or each of its arguments. */
interface ReferenceNode {
  reference: CodeReference;
  slots: SlotNode[];
}

/** A write's value or an emit's argument, with the references in it. */
interface SlotNode {
  span: Span;
  children: ReferenceNode[];
}

function rewrite(
  code: Expression | Code,
  kind: CodeKind,
  component: UfComponent,
  rules: RewriteRules,
  site: RewriteSite,
): string {
  if (code.refs.length === 0) return code.code;
  const context: Context = {
    component,
    rules,
    site,
    code: code.code,
    offset: code.span.start,
    kind,
  };
  return spliced(code.code, code.span.start, referenceTree(code), context);
}

/**
 * The references of code as a tree: a write's value and an emit's arguments hold the references
 * that follow it inside them (ADR-0045); every other reference stands alone, after the previous
 * one ends.
 */
function referenceTree({ code, span, refs }: Expression | Code): ReferenceNode[] {
  let index = 0;
  const fail = (reference: CodeReference, why: string): never => {
    throw new Error(
      `A reference at ${reference.span.start}–${reference.span.end} ${why} the code \`${code}\` at ${span.start}.`,
    );
  };
  const level = (start: number, end: number): ReferenceNode[] => {
    const nodes: ReferenceNode[] = [];
    let previous = start;
    while (index < refs.length) {
      const reference = refs[index]!;
      if (reference.span.start >= end) break;
      if (
        reference.span.start < previous ||
        reference.span.end > end ||
        reference.span.start >= reference.span.end
      ) {
        fail(reference, "is outside or overlaps another reference in");
      }
      index++;
      let slotEnd = reference.span.start;
      const slots = slotsOf(reference).map((slot): SlotNode => {
        if (slot.start < slotEnd || slot.end > reference.span.end || slot.start >= slot.end) {
          fail(reference, "has a value or an argument outside it, or out of order, in");
        }
        slotEnd = slot.end;
        return { span: slot, children: level(slot.start, slot.end) };
      });
      const next = refs[index];
      const holds = reference.kind === "Write" || reference.kind === "Emit";
      if (holds && next && next.span.start < reference.span.end) {
        fail(next, "lies inside a write or an emit, but outside its value and its arguments, in");
      }
      nodes.push({ reference, slots });
      previous = reference.span.end;
    }
    return nodes;
  };
  const nodes = level(span.start, span.end);
  if (index < refs.length) fail(refs[index]!, "is outside or overlaps another reference in");
  return nodes;
}

/** The spans that hold references of their own: a write's value, an emit's arguments. */
function slotsOf(reference: CodeReference): readonly Span[] {
  switch (reference.kind) {
    case "Write":
      return reference.value ? [reference.value] : [];
    case "Emit":
      return reference.arguments;
    case "Binding":
    case "Global":
    case "Event":
    case "Api":
    case "Slot":
      return [];
    default:
      return unreachable(reference);
  }
}

/** `text`, which starts at `offset` in the source, with each node's span replaced. */
function spliced(
  text: string,
  offset: number,
  nodes: readonly ReferenceNode[],
  context: Context,
): string {
  return replaced(
    text,
    offset,
    nodes.map((node) => {
      const written = text.slice(
        node.reference.span.start - offset,
        node.reference.span.end - offset,
      );
      return [node.reference.span, spell(node, written, context)] as const;
    }),
  );
}

/** `text`, which starts at `offset`, with each span replaced by its code where that differs. */
function replaced(
  text: string,
  offset: number,
  edits: readonly (readonly [Span, string])[],
): string {
  let output: MagicString | undefined;
  for (const [span, code] of edits) {
    const start = span.start - offset;
    const end = span.end - offset;
    if (text.slice(start, end) === code) continue;
    output ??= new MagicString(text);
    if (code === "") output.remove(start, end);
    else output.overwrite(start, end, code);
  }
  return output ? output.toString() : text;
}

/** A reference's spelling: each kind through its rule, exhaustively. */
function spell(node: ReferenceNode, written: string, context: Context): string {
  const { component, rules, site } = context;
  const { reference } = node;
  switch (reference.kind) {
    case "Binding": {
      const binding = bindingOf(component, reference.binding);
      const spelling = rules.binding(reference, binding, written, site);
      return reference.shorthand === true && spelling !== written
        ? `${written}: ${spelling}`
        : spelling;
    }
    case "Global": {
      const spelling = rules.global?.(reference, site) ?? written;
      // The IR marks shorthand properties on bindings only: find a global's from the AST, and
      // only when its spelling changes.
      if (spelling === written) return written;
      context.shorthands ??= shorthandStarts(context.code, context.kind, context.offset);
      return context.shorthands.has(reference.span.start) ? `${written}: ${spelling}` : spelling;
    }
    case "Event":
      return rules.event?.(reference, site) ?? written;
    case "Api":
      return rules.api?.(reference, site) ?? written;
    case "Write":
      return spellWrite(reference, node.slots, written, context);
    case "Emit":
      return spellEmit(reference, node.slots, written, context);
    // A slot's presence is not spelt yet (ADR-0055): each target's `emit` reports UF1002 for it.
    case "Slot":
      return written;
    default:
      return unreachable(reference);
  }
}

function spellWrite(
  write: WriteReference,
  slots: readonly SlotNode[],
  written: string,
  context: Context,
): string {
  const { component, rules, site } = context;
  const binding = bindingOf(component, write.binding);
  const offset = write.span.start;
  // The target as the operator reads it, narrowed where the write's condition narrows it.
  const read: BindingReference = {
    kind: "Binding",
    binding: write.binding,
    span: write.target,
    ...(write.narrowed ? { narrowed: write.narrowed } : {}),
  };
  const target = rules.binding(
    read,
    binding,
    written.slice(write.target.start - offset, write.target.end - offset),
    site,
  );
  const [slot] = slots;
  const value = slot && slotCode(slot, written, offset, context);
  const code = replaced(written, offset, [
    [write.target, target],
    ...(slot && value !== undefined ? [[slot.span, value] as const] : []),
  ]);
  if (!rules.write) return code;
  const parts: WriteParts = {
    target,
    ...(value === undefined ? {} : { value: inParentheses(value, "argument") }),
    code,
  };
  const replacement = rules.write(write, binding, parts, site);
  return replacement === undefined || replacement === code
    ? code
    : standalone(replacement, "write");
}

function spellEmit(
  emit: EmitReference,
  slots: readonly SlotNode[],
  written: string,
  context: Context,
): string {
  const { component, rules, site } = context;
  const binding = bindingOf(component, emit.binding);
  const offset = emit.span.start;
  const values = slots.map((slot) => slotCode(slot, written, offset, context));
  const code = replaced(
    written,
    offset,
    slots.map((slot, index) => [slot.span, values[index]!] as const),
  );
  if (!rules.emit) return code;
  const parts: EmitParts = {
    arguments: values.map((value) => inParentheses(value, "argument")),
    code,
  };
  const replacement = rules.emit(emit, binding, parts, site);
  return replacement === undefined || replacement === code ? code : standalone(replacement, "emit");
}

/** A value's or an argument's code, rewritten, out of the text of the write or emit holding it. */
function slotCode(slot: SlotNode, written: string, offset: number, context: Context): string {
  const text = written.slice(slot.span.start - offset, slot.span.end - offset);
  return spliced(text, slot.span.start, slot.children, context);
}

/** Code in parentheses where `slot` needs them. */
function inParentheses(code: string, slot: ParenthesesSlot): string {
  return parenthesesNeeded(parseExpression(code), code, slot) ? `(${code})` : code;
}

/**
 * A hook's replacement where a write or an emit stood: an expression statement's expression, or
 * an arrow's expression body. Parenthesised when it would read as something else there: a block
 * or a declaration (an expression statement cannot start with `{`, `function`, `async function`,
 * `class` or `let [`), or a sequence (an arrow's body is one assignment expression).
 */
function standalone(code: string, hook: "write" | "emit"): string {
  let expression: AST.Expression;
  try {
    expression = parseExpression(code);
  } catch (error) {
    throw new Error(`The ${hook} rule returned \`${code}\`, which is not an expression.`, {
      cause: error,
    });
  }
  const wrapped = code.startsWith("(") && code.endsWith(")") && expression.start > 0;
  if (wrapped && expression.end < code.length) return code;
  return /^(?:\{|function\b|class\b|async\s+function\b|let\s*\[)/.test(code) ||
    expression.type === "SequenceExpression"
    ? `(${code})`
    : code;
}

/** The offsets in the source of the shorthand properties' values in code (`{ NaN }`). */
function shorthandStarts(code: string, kind: CodeKind, offset: number): ReadonlySet<number> {
  const starts = new Set<number>();
  visitNodes(parseCodeSource(code, kind).root, (node) => {
    if (node.type === "Property" && (node as AST.ObjectProperty).shorthand) {
      starts.add(offset + (node as AST.ObjectProperty).value.start);
    }
  });
  return starts;
}

/**
 * The value a write stores, as one expression from its rewritten parts: the value for `=`,
 * `count + step` for `+=`, `count + 1` for `++`, `open ?? fallback` for `??=`, with the operands
 * parenthesised where the operator would otherwise bind them differently (`count * (a + b)`).
 * For a target whose framework writes a value through a setter (`setCount(…)`, `.set(…)`). A
 * logical assignment's value is the logical expression: storing the value a variable already
 * holds changes nothing a reader sees.
 */
export function writtenValue(write: WriteReference, parts: WriteParts): string {
  const { operator } = write;
  if (operator === "=") return valueOf(write, parts);
  if (operator === "++" || operator === "--") {
    return binary(parts.target, operator === "++" ? "+" : "-", "1");
  }
  return binary(parts.target, operator.slice(0, -1), valueOf(write, parts));
}

function valueOf(write: WriteReference, parts: WriteParts): string {
  if (parts.value === undefined) {
    throw new Error(`A write with \`${write.operator}\` has no value: invalid IR.`);
  }
  return parts.value;
}

/** The binary operators' precedences, tightest last; `??` cannot mix with `||` or `&&` unwrapped. */
const PRECEDENCE: Readonly<Record<string, number>> = {
  "??": 1,
  "||": 2,
  "&&": 3,
  "|": 4,
  "^": 5,
  "&": 6,
  "==": 7,
  "!=": 7,
  "===": 7,
  "!==": 7,
  "<": 8,
  ">": 8,
  "<=": 8,
  ">=": 8,
  instanceof: 8,
  in: 8,
  as: 8,
  satisfies: 8,
  "<<": 9,
  ">>": 9,
  ">>>": 9,
  "+": 10,
  "-": 10,
  "*": 11,
  "/": 11,
  "%": 11,
  "**": 12,
};

/** `left op right`, each operand parenthesised where `op` would bind it otherwise. */
function binary(left: string, operator: string, right: string): string {
  const own = PRECEDENCE[operator]!;
  // `a ?? (b || c)`: the precedences of `||` and `&&` are above `??`'s, but they cannot mix.
  const mixes = (code: string) =>
    operator === "??" && [PRECEDENCE["||"], PRECEDENCE["&&"]].includes(precedenceOf(code));
  const leftLooser = precedenceOf(left) < own || (operator === "**" && precedenceOf(left) <= own);
  const rightLooser =
    precedenceOf(right) < own || (operator !== "**" && precedenceOf(right) === own);
  const wrap = (code: string, looser: boolean) => (looser || mixes(code) ? `(${code})` : code);
  return `${wrap(left, leftLooser || unary(left, operator))} ${operator} ${wrap(right, rightLooser)}`;
}

/** The precedence of code's outermost operator: above every binary one for a primary, a call or a unary. */
function precedenceOf(code: string): number {
  const expression = parseExpression(code);
  if (code.startsWith("(") && code.endsWith(")") && expression.start > 0) {
    if (expression.end < code.length) return Number.POSITIVE_INFINITY;
  }
  switch (expression.type) {
    case "SequenceExpression":
      return -3;
    case "ArrowFunctionExpression":
    case "AssignmentExpression":
    case "YieldExpression":
      return -2;
    case "ConditionalExpression":
      return -1;
    case "LogicalExpression":
    case "BinaryExpression":
      return PRECEDENCE[expression.operator]!;
    case "TSAsExpression":
    case "TSSatisfiesExpression":
      return PRECEDENCE.as!;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

/** Whether code is a unary operation, which `**` rejects as its left operand. */
function unary(code: string, operator: string): boolean {
  if (operator !== "**") return false;
  const { type } = parseExpression(code);
  return type === "UnaryExpression" || type === "AwaitExpression";
}

/**
 * Whether code needs parentheses where it is spliced (`operand` by default): see
 * {@link ParenthesesSlot}. Code the author parenthesised as a whole needs none. Conservative:
 * oxfmt removes parentheses that turn out redundant.
 */
export function needsParentheses(code: string, slot: ParenthesesSlot = "operand"): boolean {
  return parenthesesNeeded(parseExpression(code), code, slot);
}

/** {@link needsParentheses} for code already parsed. */
export function parenthesesNeeded(
  expression: AST.Expression,
  code: string,
  slot: ParenthesesSlot,
): boolean {
  // The parser drops parentheses: an expression that starts after the code's first character
  // and ends before its last sits inside the author's own.
  if (code.startsWith("(") && code.endsWith(")") && expression.start > 0) {
    if (expression.end < code.length) return false;
  }
  switch (slot) {
    case "argument":
      return expression.type === "SequenceExpression";
    case "test":
      return LOWER_THAN_CONDITIONAL.has(expression.type);
    case "operand":
      return !OPERAND_SAFE.has(expression.type) || isNumericLiteral(expression);
    default:
      return unreachable(slot);
  }
}

/** Expressions that bind no tighter than a conditional's test may hold. */
const LOWER_THAN_CONDITIONAL: ReadonlySet<string> = new Set([
  "ConditionalExpression",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "SequenceExpression",
  "YieldExpression",
]);

/**
 * Expressions that bind as tightly as a member access, so any operator, member access or call
 * can take them as written. An optional chain is not one: `(a?.b).c` throws where `a?.b.c`
 * short-circuits. A number literal is not one either (`1.toFixed` is a syntax error).
 */
const OPERAND_SAFE: ReadonlySet<string> = new Set([
  "Identifier",
  "Literal",
  "TemplateLiteral",
  "TaggedTemplateExpression",
  "ArrayExpression",
  "ObjectExpression",
  "MemberExpression",
  "CallExpression",
  "ThisExpression",
  "MetaProperty",
  "JSXElement",
  "JSXFragment",
]);

function isNumericLiteral(expression: AST.Expression): boolean {
  return expression.type === "Literal" && typeof expression.value === "number";
}

/**
 * The names an expression's code declares or reads as variables: identifiers, arrow
 * parameters included, but not member or property names (`a.b`, `{ b: 1 }`), which no
 * declaration can capture.
 */
export function expressionNames(code: string): Set<string> {
  return codeNames(code, "expression");
}

/**
 * The names code of either kind declares or reads as variables, as {@link expressionNames}
 * finds them in an expression: in statements, the names its declarations bind and its
 * functions' parameters as well (`const next = …`, `(event) => …`), and the types its
 * annotations name.
 */
export function codeNames(code: string, kind: CodeKind = "expression"): Set<string> {
  const names = new Set<string>();
  collectNames(parseCodeSource(code, kind).root, names);
  return names;
}

/**
 * Adds to `names` every identifier in an AST that names a variable or a type: not a member's
 * property, an object's or a type's non-computed key, or a tuple member's label.
 */
export function collectNames(root: unknown, names: Set<string>): void {
  const visit = (node: unknown, skip: ReadonlySet<unknown>): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, skip);
      return;
    }
    if (!isNode(node) || skip.has(node)) return;
    if (node.type === "Identifier") names.add((node as AST.IdentifierName).name);
    const ignored = new Set<unknown>(ignoredNames(node));
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value, ignored);
    }
  };
  visit(root, new Set());
}

/** The children of a node that hold names, not variables (a member's property, a key, a label). */
function ignoredNames(node: { type: string }): unknown[] {
  const of = node as Record<string, unknown>;
  switch (node.type) {
    case "MemberExpression":
      return of.computed ? [] : [of.property];
    // A shorthand property's key is its value, which is visited.
    case "Property":
    case "TSPropertySignature":
    case "TSMethodSignature":
      return of.computed ? [] : [of.key];
    case "TSNamedTupleMember":
      return [of.label];
    case "TSQualifiedName":
      return [of.right];
    // `value is Size` names the function's parameter, which is declared where it is a variable.
    case "TSTypePredicate":
      return [of.parameterName];
    default:
      return [];
  }
}

/** The `never` default of an exhaustive switch: a kind added to a union fails type checking. */
function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
