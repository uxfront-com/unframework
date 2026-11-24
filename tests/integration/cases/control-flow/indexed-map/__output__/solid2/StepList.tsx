import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default function StepList(
  props: StepListProps &
    Omit<ComponentProps<"ol">, "title" | "steps" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "steps", "class");

  return (
    <ol
      class={props.class ? `step-list ${props.class}` : "step-list"}
      aria-label={props.title}
      {...others}
    >
      <KeyedFor each={props.steps} by={(step, index) => index}>
        {(step) => (
          <li data-step={step.index + 1}>
            Step {step.index + 1}: {step.value}
          </li>
        )}
      </KeyedFor>
    </ol>
  );
}
