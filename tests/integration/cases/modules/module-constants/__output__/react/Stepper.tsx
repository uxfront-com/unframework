import { type CSSProperties, useRef, useState } from "react";

export interface StepperAttributes {
  className?: string;
  style?: CSSProperties;
}

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default function Stepper({ className, style, ...attributes }: StepperAttributes) {
  const [value, setValue] = useState(START);
  const valueRef = useRef(value);

  function add(step: number) {
    valueRef.current = Math.min(LIMITS.max, valueRef.current + step);
    setValue(valueRef.current);
  }

  return (
    <section
      className={cx("stepper", className)}
      aria-label="Stepper"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{caption(value)}</p>
      <ul>
        {STEPS.map((step) => (
          <li key={step}>
            <button type="button" onClick={() => add(step)}>
              Add {step}
            </button>
          </li>
        ))}
      </ul>
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
