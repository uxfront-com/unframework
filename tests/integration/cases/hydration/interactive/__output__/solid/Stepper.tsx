import {
  type ComponentProps,
  type JSX,
  createSignal,
  mergeProps,
  splitProps,
  untrack,
} from "solid-js";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange?: (value: number) => void;
}

export default function Stepper(
  rawProps: StepperProps &
    StepperEvents &
    Omit<ComponentProps<"div">, "start" | "onChange" | "style"> & { style?: JSX.CSSProperties },
) {
  const props = mergeProps({ start: 0 } satisfies Partial<StepperProps>, rawProps);
  const [, others] = splitProps(props, ["start", "onChange", "class"]);

  const [count, setCount] = createSignal(untrack(() => props.start));

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
