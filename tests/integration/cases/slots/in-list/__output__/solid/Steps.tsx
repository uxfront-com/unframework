import { For, type JSX } from "solid-js";

export interface StepsSlots {
  marker?: JSX.Element;
}

export default function Steps(
  props: { steps: string[] } & StepsSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ol
      class={props.class ? `steps ${props.class}` : "steps"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <For each={props.steps}>
        {(step) => (
          <li>
            {props.marker}
            {step}
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
