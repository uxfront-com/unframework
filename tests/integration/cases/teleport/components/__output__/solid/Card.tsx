import { type JSX, Show, createSignal } from "solid-js";

export interface CardSlots {
  children?: JSX.Element;
}

export default function Card(props: CardSlots & { class?: string; style?: JSX.CSSProperties }) {
  const [open, setOpen] = createSignal(false);

  return (
    <div
      class={props.class ? `card ${props.class}` : "card"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={() => setOpen(!open())}>
        Toggle card
      </button>
      <Show when={open()}>
        <div class="body">{props.children}</div>
      </Show>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
