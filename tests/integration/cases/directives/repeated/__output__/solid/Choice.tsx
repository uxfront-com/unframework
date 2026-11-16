import { type JSX, Show, createSignal } from "solid-js";

export interface ChoiceSlots {
  body?: JSX.Element;
}

export default function Choice(props: ChoiceSlots & { class?: string; style?: JSX.CSSProperties }) {
  const [first, setFirst] = createSignal(true);

  return (
    <div
      class={props.class ? `choice ${props.class}` : "choice"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={first()} fallback={<i>{props.body}</i>}>
        <b>{props.body}</b>
      </Show>
      <button type="button" onClick={() => setFirst(!first())}>
        Switch
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
