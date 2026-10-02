import type { Component } from "@qwik.dev/core";
// Qwik marks what component$() returns with this symbol, and has no public way to test for it.
import { _qwikSymbol } from "@qwik.dev/core/internal";

type Props = Record<string, unknown>;

/** The marker of a component$() result: the component's QRL, kept for serialisation. */
const SERIALIZABLE_STATE = _qwikSymbol("serializable-data");

/**
 * The component a test mounts or renders, checked to be what the Qwik target emits, a
 * component$(): Qwik would otherwise fail far from the import that went wrong, or, for a plain
 * function, render it as an inline component that the target never emits.
 */
export function asComponent(value: unknown): Component<Props> {
  if (typeof value === "function" && SERIALIZABLE_STATE in value) return value as Component<Props>;
  const actual =
    typeof value === "function"
      ? `the function ${value.name || "(anonymous)"}`
      : value === null
        ? "null"
        : typeof value;
  throw new TypeError(`Expected a Qwik component created by component$(), received ${actual}.`);
}
