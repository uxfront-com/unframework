import { useTotal } from "./useTotal";
import {
  type CSSProperties,
  type ClassList,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export default component$<{ price: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ price, class: className, style, ...attributes }) => {
    const quantity = useSignal(1);
    const { total, label } = useTotal(
      useComputed$(() => price),
      useComputed$(() => quantity.value),
    );

    return (
      <section
        class={["basket", className]}
        aria-label="Basket"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">Total: {total.value}</p>
        <p>{label.value}</p>
        <button type="button" onClick$={() => quantity.value++}>
          Add one
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
