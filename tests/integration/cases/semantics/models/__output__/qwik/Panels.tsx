import Disclosure from "./Disclosure";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const shipping = useSignal(true);

    return (
      <section aria-label="Panels" {...scopeAttributes(attributes)} class={className} style={style}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
