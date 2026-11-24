import { cx } from "./_unframework/cx";
import { useCounter } from "./useCounter";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export interface ClickerEvents {
  onLimit?: (count: number) => void;
}

export type ClickerAttributes = Omit<ComponentPropsWithRef<"section">, "onLimit" | "children">;

export default function Clicker({
  onLimit,
  className,
  style,
  ...attributes
}: ClickerEvents & ClickerAttributes) {
  const [message, setMessage] = useState("Keep going");
  const messageRef = useRef(message);

  const { count, step, increment, reset } = useCounter(3, (reached) => {
    messageRef.current = `Reached ${reached}`;
    setMessage(messageRef.current);
    onLimit?.(reached);
  });

  return (
    <section
      className={cx("clicker", className)}
      aria-label="Clicker"
      style={style}
      {...attributes}
    >
      <p role="status">Count: {count}</p>
      <p>{message}</p>
      <button type="button" onClick={() => increment()}>
        Add {step}
      </button>
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </section>
  );
}
