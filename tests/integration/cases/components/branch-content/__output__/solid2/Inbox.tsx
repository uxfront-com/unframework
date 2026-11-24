import Notice from "./Notice";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit, untrack } from "solid-js";

export default function Inbox(
  props: { unread: number } & Omit<ComponentProps<"div">, "unread" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "unread", "class");

  const [count, setCount] = createState(untrack(() => props.unread));

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
