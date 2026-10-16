import Notice from "./Notice";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ unread: number } & { class?: ClassList; style?: CSSProperties }>(
  ({ unread, class: className, style }) => {
    const count = useSignal(unread);

    return (
      <div class={["inbox", className]} style={style}>
        <>
          {count.value > 0 ? (
            <Notice text={`${count.value} unread`} tone="info" />
          ) : (
            <Notice text="All read" tone="quiet" />
          )}
        </>
        <button type="button" onClick$={() => (count.value = 0)}>
          Mark all read
        </button>
      </div>
    );
  },
);
