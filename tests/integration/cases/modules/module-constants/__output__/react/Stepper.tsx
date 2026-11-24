import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type StepperAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

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
      {...attributes}
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
