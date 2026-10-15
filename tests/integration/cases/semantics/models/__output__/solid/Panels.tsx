import Disclosure from "./Disclosure";
import { type JSX, createSignal } from "solid-js";

export default function Panels(props: { class?: string; style?: JSX.CSSProperties }) {
  const [shipping, setShipping] = createSignal(true);

  return (
    <section aria-label="Panels" class={props.class} style={props.style}>
      <Disclosure title="Shipping" open={shipping()} onOpenChange={setShipping} />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping() ? "open" : "closed"}</output>
      <button type="button" onClick={() => setShipping(!shipping())}>
        Toggle shipping
      </button>
    </section>
  );
}
