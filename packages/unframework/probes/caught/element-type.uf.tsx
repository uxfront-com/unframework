// What JSX.Element (opaque, branded) and the non-global JSX namespace mean for authors.
import { defineSlots, type Element } from "@uxfront/unframework";

function ReturnsAString() {
  return "not JSX";
}

export function ComponentMustReturnJsx() {
  // @ts-expect-error TS2786 a component returns JSX.Element (or null), not a string
  return <ReturnsAString />;
}

async function ResolvesToAString() {
  return "not JSX";
}

export function AsyncComponentMustResolveToJsx() {
  // @ts-expect-error TS2786 an async component resolves to JSX.Element (or null), not a string
  return <ResolvesToAString />;
}

export function JsxIsNotAValue() {
  // @ts-expect-error TS2741 JSX.Element is opaque: a plain object is not an element
  const element: Element = {};
  return <div>{element}</div>;
}

export function JsxNamespaceIsNotGlobal() {
  // @ts-expect-error TS2503 `JSX` is not a global: `import { type JSX } from "@uxfront/unframework"` (or `Element`)
  const slots = defineSlots<{ default?(): JSX.Element }>();
  return <div>{slots.default?.()}</div>;
}
