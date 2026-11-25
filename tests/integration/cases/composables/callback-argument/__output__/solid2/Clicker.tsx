import { createState } from "./_unframework/createState";
import { useCounter } from "./useCounter";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ClickerEvents {
  onLimit?: (count: number) => void;
}

export default function Clicker(
  props: ClickerEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onLimit", "class");

  const [message, setMessage] = createState("Keep going");
  const { count, step, increment, reset } = useCounter(3, (reached) => {
    setMessage(`Reached ${reached}`);
    props.onLimit?.(reached);
  });

  return (
    <section
      class={props.class ? `clicker ${props.class}` : "clicker"}
      aria-label="Clicker"
      {...others}
    >
      <p role="status">Count: {count()}</p>
      <p>{message()}</p>
      <button type="button" onClick={() => increment()}>
        Add {step}
      </button>
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </section>
  );
}
