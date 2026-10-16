import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface StepsSlots {
  marker$?: QRL<() => JSXOutput>;
}

export default component$<
  { steps: string[] } & StepsSlots & { class?: ClassList; style?: CSSProperties }
>(({ steps, marker$, class: className, style }) => {
  return (
    <ol class={["steps", className]} style={style}>
      {steps.map((step) => (
        <li key={step}>
          {marker$?.()}
          {step}
        </li>
      ))}
    </ol>
  );
});
