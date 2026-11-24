import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default component$<
  StepListProps &
    Omit<PropsOf<"ol">, "title" | "steps" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, steps, class: className, style, ...attributes }) => {
  return (
    <ol class={["step-list", className]} aria-label={title} style={style} {...attributes}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
        </li>
      ))}
    </ol>
  );
});
