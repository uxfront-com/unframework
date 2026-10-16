import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <section aria-label="Wizard" class={className} style={style}>
        <Transition step="details" />
        <TransitionComponent />
        <KeepAlive level={2} />
      </section>
    );
  },
);
