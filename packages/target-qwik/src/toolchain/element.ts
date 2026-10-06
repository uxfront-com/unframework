// How both adapters hand props to the component under test.
import type { JSXOutput } from "@qwik.dev/core";
import { _jsxSorted } from "@qwik.dev/core/internal";

/**
 * The JSX node of `component` with `props`, as a parent that writes each prop as an attribute
 * renders it (`<Card bio={bio} />`), which the optimizer compiles to `_jsxSorted`: every value
 * arrives as it is, `null` included. Qwik's public `jsx()`, like a spread (`<Card {...user} />`),
 * goes through `_jsxSplit` instead, which deletes every null-valued prop (Qwik 2.0.0-beta.47,
 * `core.mjs` `_jsxSplit`: "Clean up null markers"), so the component would read `undefined`
 * where the source's `x === null` expects `null` (ADR-0034: `null` is a value). `_jsxSorted`
 * wants its props sorted by key.
 */
export function withProps(component: unknown, props: Readonly<Record<string, unknown>>): JSXOutput {
  const sorted = Object.fromEntries(
    Object.entries(props).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return _jsxSorted(component, sorted, null, null, 0, null);
}
