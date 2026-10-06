import { component$, jsx, useSignal } from "@qwik.dev/core";

export interface NullProbeProps {
  value?: string | null;
}

// Tells a `null` prop from an absent or `undefined` one, as a source's `x === null` does.
export const NullProbe = component$<NullProbeProps>(({ value }) => {
  return <p>{value === null ? "null" : value === undefined ? "undefined" : value}</p>;
});

// The ways a Qwik parent passes `null`: written as a literal, as a value it holds, through a
// spread, and through a `jsx()` call whose props are not an object literal.
export const Written = component$(() => {
  return <NullProbe value={null} />;
});

export const Held = component$(() => {
  const value = useSignal<string | null>(null);
  return <NullProbe value={value.value} />;
});

export const Spread = component$(() => {
  const attrs: NullProbeProps = { value: null };
  return <NullProbe {...attrs} />;
});

export const Called = component$(() => {
  const attrs: NullProbeProps = { value: null };
  return jsx(NullProbe, attrs);
});

export default NullProbe;
