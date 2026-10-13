import { For, type JSX } from "solid-js";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default function StepList(
  props: StepListProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ol
      class={props.class ? `step-list ${props.class}` : "step-list"}
      aria-label={props.title}
      style={props.style}
    >
      <For each={props.steps}>
        {(step, index) => (
          <li data-step={index() + 1}>
            Step {index() + 1}: {step}
          </li>
        )}
      </For>
    </ol>
  );
}
