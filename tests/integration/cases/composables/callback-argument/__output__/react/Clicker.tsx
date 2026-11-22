import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useCounter } from "./useCounter";
import { type CSSProperties, useRef, useState } from "react";

export interface ClickerEvents {
  onLimit?: (count: number) => void;
}

export interface ClickerAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
