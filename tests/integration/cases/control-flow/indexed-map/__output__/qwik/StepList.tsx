import { component$ } from "@qwik.dev/core";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default component$<StepListProps>(({ title, steps }) => {
  return (
    <ol class="step-list" aria-label={title}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
        </li>
      ))}
    </ol>
  );
});
