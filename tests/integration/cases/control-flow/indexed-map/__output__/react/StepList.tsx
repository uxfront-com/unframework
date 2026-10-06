export interface StepListProps {
  title: string;
  steps: string[];
}

export default function StepList({ title, steps }: StepListProps) {
  return (
    <ol className="step-list" aria-label={title}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
        </li>
      ))}
    </ol>
  );
}
