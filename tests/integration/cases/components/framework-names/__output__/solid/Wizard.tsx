import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import type { JSX } from "solid-js";

export default function Wizard(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section aria-label="Wizard" class={props.class} style={props.style}>
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
