import Stepper from "./Stepper";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const cups = useSignal(2);

    return (
      <section aria-label="Order" {...scopeAttributes(attributes)} class={className} style={style}>
        <Stepper label="Cups" value={cups.value} onValueChange$={(value) => (cups.value = value)} />
        <output>Ordered: {cups.value}</output>
        <button type="button" onClick$={() => (cups.value = 0)}>
          Clear
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
