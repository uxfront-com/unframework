// Event controls in `sync$` handlers (ADR-0047). Qwik runs a `$` handler once its code has loaded,
// after the event has been dispatched, so a `preventDefault()` or a `stopPropagation()` that runs
// on some events only runs in a `sync$` handler: a function the loader calls as it dispatches,
// which captures nothing, so it reads only the event and the element Qwik passes it. The controls
// of an element's listeners of one event run in one (./listeners.ts).
import { parseCodeSource, rewriteCode } from "@unframework/codegen";
import type { LiftedControl } from "@unframework/codegen";
import type { FunctionCode, Span } from "@unframework/ir";

import { readsName } from "./handlers.ts";
import type { SetupPlan } from "./plan.ts";

/** Controls that run in a `sync$`: of one function, under the same tests. */
export interface SyncBatch {
  fn: FunctionCode;
  tests: LiftedControl["tests"];
  controls: LiftedControl[];
}

/**
 * One `sync$` handler that runs controls as the event is dispatched, each batch under its tests
 * (a guard clause's negated), in order, with `event.currentTarget` read from the element Qwik's
 * loader passes it; `undefined` for no controls. Its event has `type`, the listeners' own: a
 * function they pass their event to may take a wider one (`MouseEvent | KeyboardEvent`), which
 * their tests do not read through. A `once` listener's control runs on every event here:
 * `conditional-event-control` reports it (Qwik's cell).
 */
export function syncHandler(
  plan: SetupPlan,
  syncs: readonly SyncBatch[],
  type: string,
): string | undefined {
  if (!syncs.length) return undefined;
  const element = plan.names.once("element");
  const own = syncs[0]!.fn.parameters.find((candidate) => candidate.event !== undefined);
  const name = own?.name ?? "event";
  const blocks = syncs.map(({ fn, tests, controls }) => {
    const body = controls
      .map(({ control }) => eventText(fn, control.span, name, element))
      .join("\n");
    if (!tests.length) return body;
    const conditions = tests.map(({ test, negated: guard }) => {
      const rewritten = rewriteCode(test, plan.component, plan.rules(name), "client");
      const written = guard ? negation(rewritten) : rewritten;
      return tests.length > 1 && /\|\||\?\?|\?|,/.test(written) ? `(${written})` : written;
    });
    return `if (${conditions.join(" && ")}) {\n${body}\n}`;
  });
  const body = blocks.join("\n");
  const parameters = `${name}: ${type}${readsName(body, element) ? `, ${element}: Element` : ""}`;
  return `${plan.names.core("sync$")}((${parameters}) => {\n${body}\n})`;
}

/** Controls grouped by the function that makes them and the tests they run under, in order. */
export function batches(controls: readonly LiftedControl[]): SyncBatch[] {
  const found: SyncBatch[] = [];
  for (const lifted of controls) {
    const batch = found.find(
      (each) => each.fn === lifted.fn && sameTests(each.tests, lifted.tests),
    );
    if (batch) batch.controls.push(lifted);
    else found.push({ fn: lifted.fn, tests: lifted.tests, controls: [lifted] });
  }
  return found;
}

/** Whether two lists of tests are the same tests. */
function sameTests(a: LiftedControl["tests"], b: LiftedControl["tests"]): boolean {
  return (
    a.length === b.length &&
    a.every((test, index) => test.test === b[index]!.test && test.negated === b[index]!.negated)
  );
}

/**
 * A control's statement as the source writes it, where a `sync$` handler runs it: its event's
 * members read from `name`, and `currentTarget` from `element`, which Qwik's loader passes.
 */
function eventText(fn: FunctionCode, span: Span, name: string, element: string): string {
  const { code, span: body } = fn.body;
  let text = code.slice(span.start - body.start, span.end - body.start);
  const edits = fn.body.refs
    .filter(
      (reference) =>
        reference.kind === "Event" &&
        reference.span.start >= span.start &&
        reference.span.end <= span.end,
    )
    .toSorted((a, b) => b.span.start - a.span.start);
  for (const reference of edits) {
    if (reference.kind !== "Event") continue;
    const start = reference.span.start - span.start;
    const end = reference.span.end - span.start;
    const read = reference.member === "currentTarget" ? element : `${name}.${reference.member}`;
    text = `${text.slice(0, start)}${read}${text.slice(end)}`;
  }
  return text;
}

/**
 * A test's negation, as a reader writes it: `a !== b` → `a === b`, `!a` → `a`, `a || b` → `!a &&
 * !b` (each side negated so), anything else `!(…)`.
 */
export function negation(test: string): string {
  const { root } = parseCodeSource(test, "expression");
  return negated(test, root as TestNode);
}

/** A node of a test, as far as {@link negation} reads it. */
interface TestNode {
  type: string;
  start: number;
  end: number;
  operator?: string;
  argument?: TestNode;
  left?: TestNode;
  right?: TestNode;
}

const FLIPPED: Readonly<Record<string, string>> = {
  "===": "!==",
  "!==": "===",
  "==": "!=",
  "!=": "==",
};

function negated(test: string, node: TestNode): string {
  const text = (each: TestNode) => test.slice(each.start, each.end);
  if (node.type === "BinaryExpression" && node.operator !== undefined && node.operator in FLIPPED) {
    return `${text(node.left!)} ${FLIPPED[node.operator]} ${text(node.right!)}`;
  }
  if (node.type === "UnaryExpression" && node.operator === "!") return text(node.argument!);
  if (node.type === "LogicalExpression" && (node.operator === "||" || node.operator === "&&")) {
    const join = node.operator === "||" ? " && " : " || ";
    const side = (each: TestNode) => {
      const written = negated(test, each);
      // A side that is itself an `||` under `&&`, or an `&&` under `||` for clarity, keeps
      // its parentheses.
      return /\|\||&&|\?/.test(written) && !/^!\(.*\)$/.test(written) ? `(${written})` : written;
    };
    return `${side(node.left!)}${join}${side(node.right!)}`;
  }
  const written = text(node);
  return /^(?:Identifier|MemberExpression|CallExpression|ChainExpression)$/.test(node.type)
    ? `!${written}`
    : `!(${written})`;
}
