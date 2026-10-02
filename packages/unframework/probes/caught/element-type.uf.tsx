// What JSX.Element (opaque, branded) and the non-global JSX namespace mean for authors.
import { defineSlots, type Element } from "unframework";

function ReturnsAString() {
  return "not JSX";
}

export function ComponentMustReturnJsx() {
  // @ts-expect-error TS2786 a component returns JSX.Element (or null), not a string
  return <ReturnsAString />;
}

export function JsxIsNotAValue() {
  // @ts-expect-error TS2741 JSX.Element is opaque: a plain object is not an element
  const element: Element = {};
  return <div>{element}</div>;
}

export function JsxNamespaceIsNotGlobal() {
  // @ts-expect-error TS2503 `JSX` is not a global: `import { type JSX } from "unframework"` (or `Element`)
  const slots = defineSlots<{ default?(): JSX.Element }>();
  return <div>{slots.default?.()}</div>;
}
