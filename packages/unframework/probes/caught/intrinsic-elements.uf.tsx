// What the JSX types catch on intrinsic elements (plan §4.3). Each `@ts-expect-error` names the code
// the probe runner pins (scripts/run-probes.ts): it must stay exactly this error.
import { useTemplateRef } from "unframework";

export function MisspelledAttribute() {
  // @ts-expect-error TS2322 `clas` is not an attribute (did you mean `class`?)
  return <div clas="x" />;
}

export function WrongAttributeValueType() {
  // @ts-expect-error TS2322 `disabled` is Booleanish, not an arbitrary string
  return <button disabled="yes-please" />;
}

export function WrongTabindexType() {
  // @ts-expect-error TS2322 `tabindex` is Numberish
  return <div tabindex={{ index: 1 }} />;
}

export function WrongClassValueType() {
  // @ts-expect-error TS2322 `class` takes a string, array or object, not a number
  return <div class={42} />;
}

export function WrongStyleProperty() {
  // @ts-expect-error TS2353 `colour` is not a CSS property (csstype, closed except for `--*`)
  return <div style={{ colour: "red" }} />;
}

export function DeclaredHyphenatedAttributeIsChecked() {
  // @ts-expect-error TS2322 `aria-hidden` is declared (Booleanish); only undeclared ones go unchecked
  return <div aria-hidden={42} />;
}

export function SpreadAttributesAreChecked() {
  const attributes = { disabled: "yes-please" };
  // @ts-expect-error TS2322 spread attributes are checked like written ones
  return <button {...attributes} />;
}

export function UnknownElement() {
  // @ts-expect-error TS2339 not an intrinsic element (custom elements need a hyphen)
  return <notatag />;
}

export function MisspelledEvent() {
  // @ts-expect-error TS2322 `onClik` is not an event
  return <button onClick={() => {}} onClik={() => {}} />;
}

export function MisspelledEventOption() {
  // @ts-expect-error TS2322 the event options are Capture, Once and Passive
  return <button onClickOnse={() => {}} />;
}

export function NonFunctionHandler() {
  // @ts-expect-error TS2322 a handler must be a function
  return <button onClick="go()" />;
}

export function BadEventMember() {
  // @ts-expect-error TS2339 the event is a PointerEvent; `nope` does not exist
  return <button onClick={(event) => event.nope()} />;
}

export function KeyboardEventIsTyped() {
  // @ts-expect-error TS2551 onKeydown gets a KeyboardEvent; `keyCodee` does not exist
  return <input onKeydown={(event) => event.keyCodee} />;
}

export function EventOptionHandlerIsTyped() {
  // @ts-expect-error TS2551 onKeydownCapture gets a KeyboardEvent too
  return <input onKeydownCapture={(event) => event.keyCodee} />;
}

export function HandlerParameterType() {
  // @ts-expect-error TS2322 onClick receives a PointerEvent, not a KeyboardEvent
  return <button onClick={(event: KeyboardEvent) => event.key} />;
}

export function ReactClassName() {
  // @ts-expect-error TS2322 React name: use `class` (the compiler also reports it, plan §4.6)
  return <div className="x" />;
}

export function ReactHtmlFor() {
  // @ts-expect-error TS2322 React name: use `for`
  return <label htmlFor="x" />;
}

export function ReactOnKeyDown() {
  // @ts-expect-error TS2322 React name: use `onKeydown`
  return <input onKeyDown={() => {}} />;
}

export function ReactOnDoubleClick() {
  // @ts-expect-error TS2322 React name: Vue's is `onDblclick`
  return <div onDoubleClick={() => {}} />;
}

export function VoidElementChildren() {
  // @ts-expect-error TS2747 <input> is a void element: its children are `never`
  return <input>text</input>;
}

export function TemplateRefOfWrongElement() {
  const button = useTemplateRef<HTMLButtonElement>();
  // @ts-expect-error TS2322 a TemplateRef<HTMLButtonElement> cannot hold an <input>
  return <input ref={button} />;
}

export function RefIsNotAString() {
  // @ts-expect-error TS2322 refs are objects from useTemplateRef, never string keys (plan §4.2)
  return <input ref="field" />;
}

export function DynamicComponentWithoutIs() {
  // @ts-expect-error TS2741 <component> needs `is`
  return <component class="x" />;
}

export function DynamicComponentUnknownTag() {
  // @ts-expect-error TS2820 `is` takes a known tag or a component (did you mean "button"?)
  return <component is="buttton" />;
}

export function SlotObjectOnAnElement() {
  // @ts-expect-error TS2353 slot objects are for components, not elements
  return <div>{{ default: () => "x" }}</div>;
}
