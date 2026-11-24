import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit, untrack } from "solid-js";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange?: (value: number) => void;
}

export default function Stepper(
  rawProps: StepperProps &
    StepperEvents &
    Omit<ComponentProps<"div">, "start" | "onChange" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get start() {
      return rawProps.start === undefined ? 0 : rawProps.start;
    },
  });
  const others = omit(props, "start", "onChange", "class");

  const [count, setCount] = createState(untrack(() => props.start));

  function add() {
    setCount(count() + 1);
    props.onChange?.(count());
  }

  return (
    <div class={props.class ? `stepper ${props.class}` : "stepper"} {...others}>
      <output>{count()}</output>
      <button type="button" onClick={add}>
        Add one
      </button>
    </div>
  );
}
