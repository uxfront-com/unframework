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
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
