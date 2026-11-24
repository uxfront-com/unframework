import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface StepperModels {
  value?: number;
  onValueChange?: (value: number) => void;
}

export default function Stepper(
  props: { label: string } & StepperModels &
    Omit<ComponentProps<"div">, "label" | "value" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "value", "onValueChange", "class");

  const [localValue, setLocalValue] = createState<number>(0);
  const value = () => (props.value === undefined ? localValue() : props.value);

  function setValue(next: number) {
    setLocalValue(next);
    props.onValueChange?.(next);
  }

  return (
    <div class={props.class ? `stepper ${props.class}` : "stepper"} {...others}>
      <button
        type="button"
        aria-label={`Fewer ${props.label}`}
        onClick={() => setValue(value() - 1)}
      >
        -
      </button>
      <span>
        {props.label}: {value()}
      </span>
      <button
        type="button"
        aria-label={`More ${props.label}`}
        onClick={() => setValue(value() + 1)}
      >
        +
      </button>
    </div>
  );
}
