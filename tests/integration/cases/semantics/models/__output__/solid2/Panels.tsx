import Disclosure from "./Disclosure";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Panels(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [shipping, setShipping] = createState(true);

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
