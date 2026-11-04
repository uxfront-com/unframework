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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
