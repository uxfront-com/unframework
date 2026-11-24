import Notice from "./Notice";
import { type ComponentProps, type JSX, Show, createSignal, splitProps, untrack } from "solid-js";

export default function Inbox(
  props: { unread: number } & Omit<ComponentProps<"div">, "unread" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["unread", "class"]);

  const [count, setCount] = createSignal(untrack(() => props.unread));

  return (
    <div class={props.class ? `inbox ${props.class}` : "inbox"} {...others}>
      <Show when={count() > 0} fallback={<Notice text="All read" tone="quiet" />}>
        <Notice text={`${count()} unread`} tone="info" />
      </Show>
      <button type="button" onClick={() => setCount(0)}>
        Mark all read
      </button>
    </div>
  );
}
