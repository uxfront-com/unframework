import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface StepsSlots {
  marker?: JSX.Element;
}

export default function Steps(
  props: { steps: string[] } & StepsSlots &
    Omit<ComponentProps<"ol">, "steps" | "marker" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "steps", "marker", "class");

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
