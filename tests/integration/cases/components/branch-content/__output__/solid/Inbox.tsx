import Notice from "./Notice";
import { type JSX, Show, createSignal, untrack } from "solid-js";

export default function Inbox(
  props: { unread: number } & { class?: string; style?: JSX.CSSProperties },
) {
  const [count, setCount] = createSignal(untrack(() => props.unread));

  return (
    <div
      class={props.class ? `inbox ${props.class}` : "inbox"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={count() > 0} fallback={<Notice text="All read" tone="quiet" />}>
        <Notice text={`${count()} unread`} tone="info" />
      </Show>
      <button type="button" onClick={() => setCount(0)}>
        Mark all read
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
