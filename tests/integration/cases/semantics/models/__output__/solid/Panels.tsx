import Disclosure from "./Disclosure";
import { type JSX, createSignal } from "solid-js";

export default function Panels(props: { class?: string; style?: JSX.CSSProperties }) {
  const [shipping, setShipping] = createSignal(true);

  return (
    <section
      aria-label="Panels"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Disclosure title="Shipping" open={shipping()} onOpenChange={setShipping} />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping() ? "open" : "closed"}</output>
      <button type="button" onClick={() => setShipping(!shipping())}>
        Toggle shipping
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
