import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface StepListProps {
  title: string;
  steps: string[];
}

export default component$<StepListProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, steps, class: className, style, ...attributes }) => {
    return (
      <ol
        class={["step-list", className]}
        aria-label={title}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {steps.map((step, index) => (
          <li key={index} data-step={index + 1}>
            Step {index + 1}: {step}
          </li>
        ))}
      </ol>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
