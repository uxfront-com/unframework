import Stepper from "./Stepper";
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
  const cups = useSignal(2);

  return (
    <section aria-label="Order" class={className} style={style} {...attributes}>
      <Stepper label="Cups" value={cups.value} onValueChange$={(value) => (cups.value = value)} />
      <output>Ordered: {cups.value}</output>
      <button type="button" onClick$={() => (cups.value = 0)}>
        Clear
      </button>
    </section>
  );
});
