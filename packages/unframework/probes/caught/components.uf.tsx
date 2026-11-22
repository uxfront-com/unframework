// What stock tsgo catches when a consumer uses a component (layer 1 of plan §5.6). Props are in the
// signature, so they are fully checked; events, models and slots are not (see ../allowed).
import Button from "../fixtures/Button.uf.tsx";
import Counter from "../fixtures/Counter.uf.tsx";
import Dialog from "../fixtures/Dialog.uf.tsx";
import List from "../fixtures/List.uf.tsx";

export function SignaturePropWrongType() {
  // @ts-expect-error TS2322 `initial` is a number
  return <Counter initial="x" />;
}

export function LiteralUnionProp() {
  // @ts-expect-error TS2322 `size` is "sm" | "md" | "lg"
  return <Button size="xl" />;
}

export function MissingRequiredProp() {
  // @ts-expect-error TS2322 Dialog requires `label`
  return <Dialog />;
}

export function MisspelledProp() {
  // @ts-expect-error TS2322 `intial` is not a prop of Counter (no blanket index signature, unlike v1)
  return <Counter intial={1} />;
}

export function HandlerIsNotAFunction() {
  // @ts-expect-error TS2322 `on*` must be a function
  return <Counter onChange="log" />;
}

export function LowercaseHandler() {
  // @ts-expect-error TS2322 only `on${Capitalize<string>}` is open; `onchange` is Svelte casing
  return <Counter onchange={() => {}} />;
}

export function FallthroughAttributeWrongType() {
  // @ts-expect-error TS2322 what falls through is typed as the elements that take it: `disabled` is a boolean
  return <Counter disabled={{}} />;
}

export function DeclaredPropKeepsItsType() {
  // @ts-expect-error TS2322 Button's own `size` is "sm" | "md" | "lg", though an <input>'s `size` is a number
  return <Button size={2} />;
}

export function SlotObjectMixedWithText() {
  // @ts-expect-error TS2353 a slot object must be the only child
  return <Dialog label="x">{{ title: () => "T" }} trailing text</Dialog>;
}

export function SlotFunctionReturnsAnObject() {
  // @ts-expect-error TS2322 a slot function returns children, not arbitrary objects
  return <List items={[]}>{{ item: () => ({ not: "a child" }) }}</List>;
}

export function ComponentRefIsNotAString() {
  // @ts-expect-error TS2322 component refs are objects too
  return <Dialog label="x" ref="dialog" />;
}

function Picker(_props: { label: string; onPick?: (value: number) => void }) {
  return <div />;
}

export function DeclaredHandlerKeepsItsType() {
  // An explicit on* prop wins over the open on${Capitalize<string>} signature (what layer 3 builds on).
  // @ts-expect-error TS2322 `onPick` declared in the props takes a number
  return <Picker label="x" onPick={(value: string) => value} />;
}

export function DeclaredHandlerContextualType() {
  // @ts-expect-error TS2339 `value` is contextually a number, not any
  return <Picker label="x" onPick={(value) => value.toUpperCase()} />;
}
