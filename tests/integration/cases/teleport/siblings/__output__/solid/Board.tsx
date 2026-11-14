import Panel from "./Panel";
import { type JSX, Show, createSignal } from "solid-js";

export default function Board(props: { class?: string; style?: JSX.CSSProperties }) {
  const [shown, setShown] = createSignal(true);

  return (
    <main
      class={props.class ? `board ${props.class}` : "board"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={() => setShown(false)}>
        Remove panel
      </button>
      <Show when={shown()}>
        <Panel />
      </Show>
    </main>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
