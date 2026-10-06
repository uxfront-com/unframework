import { For } from "solid-js";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default function StepList(props: StepListProps) {
  return (
    <ol class="step-list" aria-label={props.title}>
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
