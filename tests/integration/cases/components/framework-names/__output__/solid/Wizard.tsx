import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import type { JSX } from "solid-js";

export default function Wizard(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      aria-label="Wizard"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
