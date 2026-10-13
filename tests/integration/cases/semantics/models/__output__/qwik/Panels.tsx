import Disclosure from "./Disclosure";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const shipping = useSignal(true);

    return (
      <section aria-label="Panels" class={className} style={style}>
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
  },
);
