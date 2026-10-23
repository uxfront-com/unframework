import PriceRange from "./PriceRange";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const low = useSignal(20);
    const high = useSignal(50);

    return (
      <section aria-label="Search" {...scopeAttributes(attributes)} class={className} style={style}>
        <PriceRange
          label="Price"
          min={low.value}
          onMinChange$={(value) => (low.value = value)}
          max={high.value}
          onMaxChange$={(value) => (high.value = value)}
        />
        <output>
          Between {low.value} and {high.value}
        </output>
        <button type="button" onClick$={() => (high.value = 40)}>
          Cheaper
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
