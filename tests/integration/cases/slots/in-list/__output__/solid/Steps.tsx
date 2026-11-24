import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface StepsSlots {
  marker?: JSX.Element;
}

export default function Steps(
  props: { steps: string[] } & StepsSlots &
    Omit<ComponentProps<"ol">, "steps" | "marker" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["steps", "marker", "class"]);

  return (
    <ol class={props.class ? `steps ${props.class}` : "steps"} {...others}>
      <KeyedFor each={props.steps} by={(step) => step}>
        {(step) => (
          <li>
            {props.marker}
            {step.value}
          </li>
        )}
      </KeyedFor>
    </ol>
  );
}
