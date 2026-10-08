// How the Angular output spells each reference (plan §6, ADR-0045): in the class (`this.count()`,
// `this.count.set(…)`, `this.change.emit(…)`), in the template (`count`, read through its `@let`),
// in a list's `track` (`this.count()`: NG8009) and in a listener's template statement.
import { mapCode, parseCodeSource, parseExpression, writtenValue } from "@unframework/codegen";
import type { CodeKind, RewriteRules, RewriteSite } from "@unframework/codegen";
import type { Binding, EmitReference, EventDeclaration } from "@unframework/ir";

import { narrowedWhole } from "./narrowing.ts";
import { formOf, isSignal, unreachable } from "./plan.ts";
import type { MemberForm, Plan } from "./plan.ts";

/**
 * The rules for the class's code: every member through `this.`, a signal read by calling it,
 * a template ref's element through `nativeElement` (`undefined` before the view renders it, as
 * `viewChild` gives), a state written through `set` or `update`, an event emitted through its
 * output, and `nextTick()` through the class's own helper (`nextTick` names it).
 */
export function classRules(plan: Plan, nextTick?: string): RewriteRules {
  return {
    binding: (reference, binding) => classRead(plan, binding, narrowedWhole(reference)),
    write: (write, binding, parts) => {
      const form = formOf(plan, binding);
      switch (form) {
        case "signal":
        case "linked":
          if (write.operator === "=") return `this.${binding.name}.set(${parts.value})`;
          // `update` for a new value made from the current one, as Angular's guide writes it,
          // where the value reads only literals and signals. Its callback is a closure, where
          // TypeScript keeps no narrowing of a local, a parameter or a field (`row.size` under
          // `row.size !== undefined`), and types no `let` that has no type yet: a value that
          // reads one is `set` from the current value, where the source reads it. So is a value
          // whose current one a condition narrows (`this.count()!`, as `classRead` spells it).
          return !parts.target.endsWith("!") &&
            (parts.value === undefined || readsOnlySignals(parts.value))
            ? `this.${binding.name}.update((${binding.name}) => ${writtenValue(write, { ...parts, target: binding.name })})`
            : `this.${binding.name}.set(${writtenValue(write, parts)})`;
        case "field":
          // A setup `let` is a plain field: written as the source writes it, through `this.`.
          return undefined;
        case "input":
        case "computed":
        case "once":
        case "value":
        case "query":
        case "method":
        case "arrow":
        case "loop":
        case "emit":
          throw new Error(`\`${binding.name}\` is written, which the analyser rejects (UF2011).`);
        default:
          return unreachable(form);
      }
    },
    emit: (emit, _binding, parts) =>
      emitCall(`this.${emit.event}`, eventOf(plan, emit), parts.arguments),
    api: () => {
      if (nextTick === undefined) throw new Error("`nextTick` is called, and no helper declared.");
      return `this.${nextTick}`;
    },
  };
}

/**
 * Whether class code reads only literals and the component's signals and methods (`this.step()`,
 * `this.picked()!.id`): no name, which TypeScript may narrow where the code is and not in a
 * callback, and no field (`this.last`).
 */
function readsOnlySignals(code: string): boolean {
  return closed(parseExpression(code));
}

/** Whether a node of class code reads only literals, signals and methods (see `readsOnlySignals`). */
function closed(value: unknown, parent?: Node, key = ""): boolean {
  if (Array.isArray(value)) return value.every((item) => closed(item, parent, key));
  if (!isNode(value)) return true;
  switch (value.type) {
    case "Identifier":
      // A member's or a key's own name reads nothing.
      return (key === "property" || key === "key") && parent?.computed === false;
    case "ThisExpression":
      return false;
    case "CallExpression": {
      // `this.x(…)`: a signal's read or a method's call, which no condition narrows.
      const callee = value.callee as Node;
      const member =
        callee.type === "MemberExpression" &&
        !callee.computed &&
        (callee.object as Node).type === "ThisExpression";
      return (member || closed(callee, value, "callee")) && closed(value.arguments, value);
    }
    default:
      return Object.entries(value).every(
        ([child, node]) =>
          child === "parent" || typeof node !== "object" || closed(node, value, child),
      );
  }
}

/**
 * Class code with a template ref's element read as Angular code reads it. The source tests the
 * ref's value (`field.value?.focus()`), which the class reads as `this.field()?.nativeElement`,
 * whose element is never nullish once the query has one (`this.field()?.nativeElement.focus()`).
 * And the source's value is `T | null`, where the query's read is `T | undefined`: so a read used
 * as a value (stored, passed, returned, compared) is `this.field()?.nativeElement ?? null`, which
 * type-checks wherever the source's does and compares with `null` as it does. A read that is only
 * tested (`if (…)`, `!…`, the left side of `&&`, `||` or `??`, `… == null`), asserted (`!`) or
 * read through (`.focus()`) needs none. Only code between literals changes: `this` is no name the
 * source may use, so the text is the rules' own.
 */
export function tidied(code: string, kind: CodeKind): string {
  if (!code.includes("?.nativeElement")) return code;
  const read = code.includes("?.nativeElement?.")
    ? mapCode(code, { other: (text) => text.replace(/(\(\)\?\.nativeElement)\?\./g, "$1.") }, kind)
    : code;
  return withNullElements(read, kind);
}

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** Class code with each template ref's read used as a value ending `?? null` (see `tidied`). */
function withNullElements(code: string, kind: CodeKind): string {
  const edits: { start: number; end: number }[] = [];
  const visit = (value: unknown, parent: Node | undefined, key: string): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, parent, key);
      return;
    }
    if (!isNode(value)) return;
    if (value.type === "ChainExpression" && isElementRead(value.expression as Node)) {
      if (parent === undefined || !testsOnly(parent, key, value)) edits.push(value);
      return;
    }
    for (const [child, node] of Object.entries(value)) {
      if (child !== "type" && child !== "parent" && typeof node === "object") {
        visit(node, value, child);
      }
    }
  };
  visit(parseCodeSource(code, kind).root, undefined, "");
  let result = code;
  for (const { start, end } of edits.toSorted((a, b) => b.start - a.start)) {
    // In parentheses, which oxfmt drops where they are not needed (`??` beside `||` needs them).
    result = `${result.slice(0, start)}(${result.slice(start, end)} ?? null)${result.slice(end)}`;
  }
  return result;
}

/** `this.field()?.nativeElement`: a template ref's element, read in the class. */
function isElementRead(node: Node): boolean {
  if (node.type !== "MemberExpression" || node.computed || !node.optional) return false;
  const object = node.object as Node;
  const property = node.property as Node;
  if (property.name !== "nativeElement" || object.type !== "CallExpression") return false;
  const callee = object.callee as Node;
  return (
    (object.arguments as unknown[]).length === 0 &&
    callee.type === "MemberExpression" &&
    (callee.object as Node).type === "ThisExpression"
  );
}

/** Whether a value in `parent`'s `key` is only tested, asserted or read through, never kept. */
function testsOnly(parent: Node, key: string, node: Node): boolean {
  switch (parent.type) {
    case "IfStatement":
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
    case "ConditionalExpression":
      return key === "test";
    case "UnaryExpression":
      return parent.operator === "!";
    case "LogicalExpression":
      return parent.left === node;
    case "BinaryExpression": {
      if (parent.operator !== "==" && parent.operator !== "!=") return false;
      const other = (parent.left === node ? parent.right : parent.left) as Node;
      return (
        (other.type === "Literal" && other.value === null) ||
        (other.type === "Identifier" && other.name === "undefined")
      );
    }
    case "TSNonNullExpression":
    case "MemberExpression":
    case "CallExpression":
      return key === "expression" || key === "object" || key === "callee";
    case "ExpressionStatement":
      return true;
    default:
      return false;
  }
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}

/**
 * A read of a binding in the class's code; `narrowed` where a condition around it shows it present,
 * which TypeScript does not narrow a call by (./narrowing.ts): `this.selected()!`, and a template
 * ref's `this.field()!.nativeElement` (an assertion inside `?.nativeElement` would leave the chain
 * optional).
 */
export function classRead(plan: Plan, binding: Binding, narrowed = false): string {
  const form = formOf(plan, binding);
  switch (form) {
    case "input":
    case "signal":
    case "linked":
    case "computed":
    case "once":
      return `this.${binding.name}()${narrowed ? "!" : ""}`;
    case "query":
      return `this.${binding.name}()${narrowed ? "!." : "?."}nativeElement`;
    case "value":
    case "method":
    case "arrow":
    case "field":
      return `this.${binding.name}`;
    case "loop":
    case "emit":
      throw new Error(`\`${binding.name}\` is read in the class, where it is not in scope.`);
    default:
      return unreachable(form);
  }
}

/**
 * The rules for the template's expressions: what the template reads through a `@let` (a signal's
 * value, which Angular's type checker narrows as TypeScript narrows a local) or as a member (a
 * constant, a method) by its own name; in a list's `track`, which may read only its item, its
 * index and the component's members (NG8009), a signal from the class.
 */
export function templateRules(plan: Plan): RewriteRules {
  return {
    binding: (_reference, binding, _written, site) => templateRead(plan, binding, site),
  };
}

function templateRead(plan: Plan, binding: Binding, site: RewriteSite): string {
  const form = formOf(plan, binding);
  switch (form) {
    case "input":
    case "signal":
    case "linked":
    case "computed":
    case "once":
      return site === "key" ? `this.${binding.name}()` : binding.name;
    case "value":
    case "method":
    case "arrow":
      return site === "key" ? `this.${binding.name}` : binding.name;
    case "loop":
      return binding.name;
    case "query":
    case "field":
    case "emit":
      throw new Error(`\`${binding.name}\` is read in the template, which the analyser rejects.`);
    default:
      return unreachable(form);
  }
}

/**
 * The rules for a listener's template statement (`(click)="pick(contact, index)"`): an input and
 * a list's item or index through the template's own names, a state through the class (`this.x()`:
 * a `@let` holds the value of the last render, which another listener of the same event may
 * already have changed), the handler's event as `$event`, an event through its output (through
 * `this.` where a list's variable shadows it or JavaScript reads its name as a keyword).
 */
export function statementRules(plan: Plan): RewriteRules {
  return {
    binding: (reference, binding) => statementRead(plan, binding, narrowedWhole(reference)),
    event: (reference) => `$event.${reference.member}`,
    emit: (emit, _binding, parts) => {
      const output =
        plan.loopNames.has(emit.event) || !readsAsName(emit.event)
          ? `this.${emit.event}`
          : emit.event;
      return emitCall(output, eventOf(plan, emit), parts.arguments);
    },
  };
}

/**
 * Whether JavaScript reads a name as a name where it starts an expression (`picked.emit()`), not a
 * keyword (`delete`, `new`): an event may take a reserved word that Angular's expression language
 * reads as a name (UF2008 rejects its own keywords), but the printer handles a template statement
 * as JavaScript, so such an output is read through `this.` (`this.delete.emit(id)`), which both
 * read as the member.
 */
function readsAsName(name: string): boolean {
  let known = NAMES.get(name);
  if (known === undefined) {
    try {
      parseExpression(`${name}.emit()`);
      known = true;
    } catch {
      known = false;
    }
    NAMES.set(name, known);
  }
  return known;
}

const NAMES = new Map<string, boolean>();

/**
 * A read of a binding in a template statement; `narrowed` as in {@link classRead}, which an
 * input, read through the template's own name, needs not.
 */
export function statementRead(plan: Plan, binding: Binding, narrowed = false): string {
  const form: MemberForm = formOf(plan, binding);
  switch (form) {
    case "input":
    case "value":
    case "method":
    case "arrow":
    case "loop":
      return binding.name;
    case "signal":
    case "linked":
    case "computed":
    case "once":
      return `this.${binding.name}()${narrowed ? "!" : ""}`;
    case "query":
    case "field":
    case "emit":
      throw new Error(`\`${binding.name}\` is read in a template statement.`);
    default:
      return unreachable(form);
  }
}

/** Whether the template reads a binding through a `@let`: a signal's value. */
export function readThroughLet(plan: Plan, binding: Binding): boolean {
  return isSignal(formOf(plan, binding));
}

function eventOf(plan: Plan, emit: EmitReference): EventDeclaration {
  const event = plan.events.get(emit.event);
  if (!event) throw new Error(`\`${emit.event}\` is emitted and not declared.`);
  return event;
}

/**
 * An emit through an output, which emits one value (ADR-0047): nothing for an event without
 * members, the value for one required member, and a tuple of exactly the arguments given
 * otherwise (the mount adapter spreads it back).
 */
export function emitCall(output: string, event: EventDeclaration, args: readonly string[]): string {
  const [only, ...more] = event.parameters;
  if (only === undefined) return `${output}.emit()`;
  if (more.length === 0 && !only.optional) return `${output}.emit(${args[0] ?? ""})`;
  return `${output}.emit([${args.join(", ")}])`;
}

/** An output's value type by the same rule: `void`, the member's type, or the named tuple. */
export function outputType(event: EventDeclaration): string {
  const [only, ...more] = event.parameters;
  if (only === undefined) return "void";
  if (more.length === 0 && !only.optional) return only.type.code;
  return `[${event.parameters
    .map(({ name, optional, type }) => `${name}${optional ? "?" : ""}: ${type.code}`)
    .join(", ")}]`;
}
