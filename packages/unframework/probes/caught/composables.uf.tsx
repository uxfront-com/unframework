// What stock tsgo catches when a component calls a composable (ADR-0069): its parameters and what it
// returns are ordinary TypeScript.
import { useControllableState, useToggle } from "../fixtures/useToggle.uf.ts";

export function WrongArgument() {
  // @ts-expect-error TS2345 `initial` is a boolean
  const { on } = useToggle("yes");
  return <output>{String(on.value)}</output>;
}

export function ValueForAGetter() {
  // @ts-expect-error TS2345 `value` is a getter, `() => string`
  const { current } = useControllableState("x", () => {});
  return <output>{current.value}</output>;
}

export function UnknownMember() {
  // @ts-expect-error TS2339 useToggle returns `on`, `label` and `toggle`
  const { open } = useToggle(false);
  return <output>{String(open)}</output>;
}

export function ExtraArgumentToAReturnedFunction() {
  const { toggle } = useToggle(false);
  // @ts-expect-error TS2554 `toggle` takes no argument
  return <button type="button" onClick={() => toggle(true)} />;
}

export function WriteToAReturnedComputed() {
  const { label } = useToggle(false);
  // @ts-expect-error TS2540 `label` is a computed
  const rename = () => (label.value = "x");
  return <button type="button" onClick={rename} />;
}
