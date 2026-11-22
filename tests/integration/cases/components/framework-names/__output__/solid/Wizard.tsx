import KeepAlive from "./KeepAlive";
import Transition from "./Transition";
import TransitionComponent from "./TransitionComponent";
import type { ComponentProps, JSX } from "solid-js";

export default function Wizard(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <section aria-label="Wizard" {...props}>
      <Transition step="details" />
      <TransitionComponent />
      <KeepAlive level={2} />
    </section>
  );
}
