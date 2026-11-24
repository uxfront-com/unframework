import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface StepsSlots {
  marker$?: QRL<() => JSXOutput>;
}

export default component$<
  { steps: string[] } & StepsSlots &
    Omit<PropsOf<"ol">, "steps" | "marker$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ steps, marker$, class: className, style, ...attributes }) => {
  return (
    <ol class={["steps", className]} style={style} {...attributes}>
      {steps.map((step) => (
        <li key={step}>
          {marker$?.()}
          {step}
        </li>
      ))}
    </ol>
  );
});
