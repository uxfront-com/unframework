import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface NoticeSlots {
  action$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & NoticeSlots &
    Omit<PropsOf<"div">, "label" | "action$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, action$: actionSlot$, class: className, style, ...attributes }) => {
  return (
    <div role="note" aria-label={label} class={["notice", className]} style={style} {...attributes}>
      <p>
        <Slot>
          <em>Nothing to report.</em>
        </Slot>
      </p>
      {actionSlot$?.() ?? <span class="muted">No action</span>}
    </div>
  );
});
