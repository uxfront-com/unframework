import Disclosure from "./Disclosure";
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
  const shipping = useSignal(true);

  return (
    <section aria-label="Panels" class={className} style={style} {...attributes}>
      <Disclosure
        title="Shipping"
        open={shipping.value}
        onOpenChange$={(value) => (shipping.value = value)}
      />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping.value ? "open" : "closed"}</output>
      <button type="button" onClick$={() => (shipping.value = !shipping.value)}>
        Toggle shipping
      </button>
    </section>
  );
});
