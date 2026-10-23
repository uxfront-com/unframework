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
>(({ steps, marker$, class: className, style, ...attributes }) => {
  return (
    <ol class={["steps", className]} {...scopeAttributes(attributes)} style={style}>
      {steps.map((step) => (
        <li key={step}>
          {marker$?.()}
          {step}
        </li>
      ))}
    </ol>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
