// A `.uf.ts` module's composable as a Qwik `use*` hook, `useToggle.ts` (ADR-0069): its setup as a
// component's (./plan.ts, ./setup.ts), with `useSignal`, `useComputed$` and tasks, returning its
// signals and its functions as `$()` QRLs. A hook's `$` scopes capture only what Qwik serialises,
// so its parameters change form where a plain function would be captured (optimizer C02): a
// getter, `() => T`, is the `ReadonlySignal<T>` its caller makes with `useComputed$`, read through
// `.value`, and a callback is the `QRL` its caller makes with `$()`, called as a QRL is. A value is
// taken as it is.
import { parseCodeSource } from "@unframework/codegen";
import type { CodeKind } from "@unframework/codegen";
import type { ComposableParameter, UfComponent, UfComposable } from "@unframework/ir";

import { unreachable } from "./plan.ts";
import type { OutputNames } from "./plan.ts";

/** A node of oxc's syntax tree, as far as this walk reads it. */
interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * A composable as the component whose setup the planner reads: its bindings, its setup and the
 * types it declares, with no props and nothing to render.
 */
export function setupOwner(composable: UfComposable): UfComponent {
  return {
    name: composable.name,
    span: composable.span,
    ...(composable.typeParameters ? { typeParameters: composable.typeParameters } : {}),
    props: [],
    types: composable.types,
    bindings: composable.bindings,
    setup: composable.setup,
    render: { kind: "Fragment", children: [], span: composable.span },
  };
}

/**
 * A parameter as the hook declares it: a value as written, a getter as the signal of what it
 * returns (`price: ReadonlySignal<number>`), a callback as its QRL (`onLimit: QRL<(count: number)
 * => void>`).
 */
export function parameterCode(parameter: ComposableParameter, names: OutputNames): string {
  const head = `${parameter.name}${parameter.optional ? "?" : ""}: `;
  const type = parameter.type.code;
  switch (parameter.kind) {
    case "value":
      return `${head}${type}`;
    case "getter": {
      // `() => T` returns what follows its arrow; a generic getter's return names its own type
      // parameters, which `ReturnType` reads.
      const returned = /^\(\s*\)\s*=>\s*([\s\S]+)$/.exec(type)?.[1] ?? `ReturnType<${type}>`;
      return `${head}${names.core("ReadonlySignal", { type: true })}<${returned}>`;
    }
    case "callback":
      return `${head}${names.core("QRL", { type: true })}<${type}>`;
    default:
      return unreachable(parameter.kind);
  }
}

/**
 * Reads each getter argument's signal where printed code calls it: `price()` becomes
 * `price.value`, and `price?.()` `price?.value`. A getter takes no arguments, so the call is
 * the read. `getters` are the names the code calls them by.
 */
export function readGetters(code: string, kind: CodeKind, getters: ReadonlySet<string>): string {
  if (getters.size === 0 || ![...getters].some((name) => code.includes(name))) return code;
  const { root } = parseCodeSource(code, kind);
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isNode(node)) return;
    const callee = node.callee as Node | undefined;
    if (
      node.type === "CallExpression" &&
      callee?.type === "Identifier" &&
      getters.has(callee.name as string) &&
      (node.arguments as unknown[]).length === 0
    ) {
      const read = node.optional === true ? "?.value" : ".value";
      edits.push({ start: node.start, end: node.end, text: `${callee.name as string}${read}` });
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== "type" && key !== "parent" && typeof value === "object") visit(value);
    }
  };
  visit(root);
  let result = code;
  for (const { start, end, text } of edits.toSorted((a, b) => b.start - a.start)) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`;
  }
  return result;
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).type === "string" &&
    typeof (value as Node).start === "number"
  );
}
