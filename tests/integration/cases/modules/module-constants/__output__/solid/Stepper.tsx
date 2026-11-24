import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default function Stepper(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [value, setValue] = createSignal(START);

  function add(step: number) {
    setValue(Math.min(LIMITS.max, value() + step));
  }

  return (
    <section
      class={props.class ? `stepper ${props.class}` : "stepper"}
      aria-label="Stepper"
      {...others}
    >
      <p role="status">{caption(value())}</p>
      <ul>
        <KeyedFor each={STEPS} by={(step) => step}>
          {(step) => (
            <li>
              <button type="button" onClick={() => add(step.value)}>
                Add {step.value}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
    </section>
  );
}
