// Where a function's code runs after the function has given control back (ADR-0048): after an
// `await` that every path to that code passes, and in the functions it hands to a call that runs
// them later. UF2027, UF2015 and UF2010 judge only what a `watchEffect` runs while it runs, which
// is what every target tracks; UF2018 judges only what a watcher reads before `await nextTick()`.
// The references client code makes in the functions it hands on are marked `later` in the IR,
// whose `summarizeTracked` leaves them out of a `watchEffect`'s dependencies on every target.

import { functionsOf } from "@unframework/ir";
import type { Span, UfComponent } from "@unframework/ir";
import type { AST } from "@unframework/parser";
import { visitorKeys } from "@unframework/parser";

import type { RenderContext } from "./render.ts";

/** A function the source writes: a declaration, an arrow function or a function expression. */
export type FunctionNode = AST.Function | AST.ArrowFunctionExpression;

/** What `laterRegions` counts as giving control back. */
export interface Suspensions {
  /** Whether code after this `await` runs later: every `await`, or only `await nextTick()`. */
  readonly awaits: (node: AST.AwaitExpression) => boolean;
  /** Whether a function in the body runs later, never while the body runs (a timer's callback). */
  readonly deferred: (node: FunctionNode) => boolean;
}

/**
 * The regions of a function's body that do not run while a call of it runs, up to the first
 * suspension: what follows an `await` that `awaits` selects, as far as every path from it leads
 * (the rest of its block, and of the blocks around it, but no branch of an `if`, a `?:`, `&&`,
 * `||` or `??`, a loop's body, a `switch`'s case, a `try` block's `catch` or what follows a
 * `try` block, which may run without it), and the functions `deferred` selects, whole. A function
 * in the body that may run at once (an array method's callback) has its own regions.
 */
export function laterRegions(fn: FunctionNode, suspensions: Suspensions): Span[] {
  const regions: Span[] = [];
  walkFunction(fn, suspensions, regions);
  return regions;
}

/** Whether a position lies in one of the regions. */
export function isLater(position: number, regions: readonly Span[]): boolean {
  return regions.some((region) => position >= region.start && position < region.end);
}

function walkFunction(fn: FunctionNode, suspensions: Suspensions, regions: Span[]): void {
  if (!fn.body) return;
  const path: AST.Node[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as AST.Node;
    if (typeof node.type !== "string") return;
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      if (suspensions.deferred(node)) regions.push({ start: node.start, end: node.end });
      else walkFunction(node, suspensions, regions);
      return;
    }
    path.push(node);
    for (const key of visitorKeys[node.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key]);
    }
    path.pop();
    if (node.type === "AwaitExpression" && suspensions.awaits(node)) {
      regions.push({ start: node.end, end: dominatedEnd(node, path) });
    }
  };
  visit(fn.body);
}

/**
 * Where what follows a node on every path from it ends: the end of the outermost construct
 * around it, inside the function, that runs it unconditionally once it starts.
 */
function dominatedEnd(node: AST.Node, path: readonly AST.Node[]): number {
  let end = node.end;
  let child = node;
  for (let index = path.length - 1; index >= 0; index--) {
    const parent = path[index]!;
    if (runsUnderCondition(parent, child)) return end;
    end = parent.end;
    child = parent;
  }
  return end;
}

/** Whether `parent` may run what follows `child` without running `child` first. */
function runsUnderCondition(parent: AST.Node, child: AST.Node): boolean {
  switch (parent.type) {
    case "IfStatement":
      return child !== parent.test;
    case "ConditionalExpression":
      return child !== parent.test;
    case "LogicalExpression":
      return child === parent.right;
    case "AssignmentExpression":
      return child === parent.right && /^(?:\|\||&&|\?\?)=$/.test(parent.operator);
    case "AssignmentPattern":
      return child === parent.right;
    case "SwitchStatement":
      return child !== parent.discriminant;
    case "ForStatement":
      return child === parent.body || child === parent.update;
    case "ForOfStatement":
    case "ForInStatement":
      return child !== parent.right;
    case "WhileStatement":
      return child === parent.body;
    // What follows a `try` block also runs when a statement before the `await` throws.
    case "TryStatement":
      return child !== parent.finalizer;
    // A `?.` before the node may skip it, and what follows it in the chain.
    case "ChainExpression":
      return true;
    default:
      return false;
  }
}

/**
 * The functions client code hands on to run later (ADR-0048): each passed to a call that runs it
 * later or never (`CodeFacts.passed`: a timer, a promise's `then`, `addEventListener`,
 * `onCleanup`, an observer's constructor, `removeEventListener`), written in place, or held in a
 * `const` declared inside a function that only such calls are given (`const tick = () => …;
 * setInterval(tick, 1000)`). A function the setup declares is called by name, and is not one.
 */
export function deferredFunctions(render: RenderContext): ReadonlySet<FunctionNode> {
  const { passed } = render.facts;
  const found = new Set<FunctionNode>();
  const held: { name: AST.BindingIdentifier; value: FunctionNode }[] = [];
  const references = new Map<object, AST.IdentifierReference[]>();
  const visit = (value: unknown, depth: number): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth);
      return;
    }
    const node = value as AST.Node;
    if (typeof node.type !== "string") return;
    const fn =
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionExpression" ||
      node.type === "FunctionDeclaration";
    if (fn && passed.has(node.start)) found.add(node);
    if (
      node.type === "VariableDeclarator" &&
      depth > 0 &&
      node.id.type === "Identifier" &&
      (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression")
    ) {
      held.push({ name: node.id, value: node.init });
    }
    if (node.type === "Identifier") {
      const resolution = render.scopes.resolve(node as AST.IdentifierReference);
      if (resolution.kind === "variable") {
        const list = references.get(resolution.declaration) ?? [];
        list.push(node as AST.IdentifierReference);
        references.set(resolution.declaration, list);
      }
    }
    for (const key of visitorKeys[node.type] ?? []) {
      visit((node as unknown as Record<string, unknown>)[key], fn ? depth + 1 : depth);
    }
  };
  visit(render.component.body, 0);
  for (const { name, value } of held) {
    // The declaration's own identifier is the initialising write of it.
    const uses = (references.get(name) ?? []).filter((use) => use !== (name as object));
    if (uses.length && uses.every((use) => passed.has(use.start))) found.add(value);
  }
  return found;
}

/**
 * Marks `later` each reference client code makes in a function it hands on to run later
 * (`deferredFunctions`), in every function of the component: what it reads, no target tracks
 * while the code around it runs (ADR-0048).
 */
export function markLater(
  component: UfComponent,
  render: RenderContext,
  deferred: ReadonlySet<FunctionNode>,
): void {
  if (!deferred.size) return;
  const regions = laterRegions(render.component, {
    awaits: () => false,
    deferred: (node) => deferred.has(node),
  });
  for (const { function: fn } of functionsOf(component)) {
    for (const ref of fn.body.refs) {
      if (ref.kind === "Binding" && isLater(ref.span.start, regions)) ref.later = true;
    }
  }
}
