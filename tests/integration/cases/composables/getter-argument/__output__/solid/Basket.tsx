import { useTotal } from "./useTotal";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export default function Basket(
  props: { price: number } & Omit<ComponentProps<"section">, "price" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["price", "class"]);

  const [quantity, setQuantity] = createSignal(1);
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
