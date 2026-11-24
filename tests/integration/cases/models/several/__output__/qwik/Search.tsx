import PriceRange from "./PriceRange";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const low = useSignal(20);
  const high = useSignal(50);

  return (
    <section aria-label="Search" class={className} style={style} {...attributes}>
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
});
