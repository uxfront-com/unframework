import { useTotal } from "./useTotal";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  { price: number } & Omit<PropsOf<"section">, "price" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ price, class: className, style, ...attributes }) => {
  const quantity = useSignal(1);
  const { total, label } = useTotal(
    useComputed$(() => price),
    useComputed$(() => quantity.value),
  );

  return (
    <section class={["basket", className]} aria-label="Basket" style={style} {...attributes}>
      <p role="status">Total: {total.value}</p>
      <p>{label.value}</p>
      <button type="button" onClick$={() => quantity.value++}>
        Add one
      </button>
    </section>
  );
});
