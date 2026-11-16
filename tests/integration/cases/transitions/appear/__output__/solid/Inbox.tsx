import Toast from "./Toast";
import { type JSX, Show, createSignal } from "solid-js";

export default function Inbox(props: { class?: string; style?: JSX.CSSProperties }) {
  const [shown, setShown] = createSignal(true);

  return (
    <section aria-label="Inbox" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <button type="button" onClick={() => setShown(!shown())}>
        {shown() ? "Hide" : "Show"}
      </button>
      <Show when={shown()}>
        <Toast />
      </Show>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
