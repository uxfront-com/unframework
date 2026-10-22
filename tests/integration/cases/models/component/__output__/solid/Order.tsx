import Stepper from "./Stepper";
import { type JSX, createSignal } from "solid-js";

export default function Order(props: { class?: string; style?: JSX.CSSProperties }) {
  const [cups, setCups] = createSignal(2);

  return (
    <section aria-label="Order" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Stepper label="Cups" value={cups()} onValueChange={setCups} />
      <output>Ordered: {cups()}</output>
      <button type="button" onClick={() => setCups(0)}>
        Clear
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
