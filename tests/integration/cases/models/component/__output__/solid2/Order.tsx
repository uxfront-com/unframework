import Stepper from "./Stepper";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Order(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [cups, setCups] = createState(2);

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
