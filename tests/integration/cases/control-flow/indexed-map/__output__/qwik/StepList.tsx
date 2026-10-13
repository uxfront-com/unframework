import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default component$<StepListProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, steps, class: className, style }) => {
    return (
      <ol class={["step-list", className]} aria-label={title} style={style}>
        {steps.map((step, index) => (
          <li key={index} data-step={index + 1}>
            Step {index + 1}: {step}
          </li>
        ))}
      </ol>
    );
  },
);
