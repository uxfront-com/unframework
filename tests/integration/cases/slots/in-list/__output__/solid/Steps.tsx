import { For, type JSX } from "solid-js";

export interface StepsSlots {
  marker?: JSX.Element;
}

export default function Steps(
  props: { steps: string[] } & StepsSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ol class={props.class ? `steps ${props.class}` : "steps"} style={props.style}>
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
