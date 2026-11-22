import Disclosure from "./Disclosure";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function Panels(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [shipping, setShipping] = createSignal(true);

  return (
    <section aria-label="Panels" {...props}>
      <Disclosure title="Shipping" open={shipping()} onOpenChange={setShipping} />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping() ? "open" : "closed"}</output>
      <button type="button" onClick={() => setShipping(!shipping())}>
        Toggle shipping
      </button>
    </section>
  );
}
