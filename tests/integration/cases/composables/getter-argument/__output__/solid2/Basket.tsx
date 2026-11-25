import { createState } from "./_unframework/createState";
import { useTotal } from "./useTotal";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Basket(
  props: { price: number } & Omit<ComponentProps<"section">, "price" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "price", "class");

  const [quantity, setQuantity] = createState(1);
  const { total, label } = useTotal(
    () => props.price,
    () => quantity(),
  );

  return (
    <section
      class={props.class ? `basket ${props.class}` : "basket"}
      aria-label="Basket"
      {...others}
    >
      <p role="status">Total: {total()}</p>
      <p>{label()}</p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
      </button>
    </section>
  );
}
