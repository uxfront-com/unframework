import Stepper from "./Stepper";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function Order(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [cups, setCups] = createSignal(2);

  return (
    <section aria-label="Order" {...props}>
      <Stepper label="Cups" value={cups()} onValueChange={setCups} />
      <output>Ordered: {cups()}</output>
      <button type="button" onClick={() => setCups(0)}>
        Clear
      </button>
    </section>
  );
}
