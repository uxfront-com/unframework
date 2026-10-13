import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface NoticeSlots {
  action$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & NoticeSlots & { class?: ClassList; style?: CSSProperties }
>(({ label, action$: actionSlot$, class: className, style }) => {
  return (
    <div role="note" aria-label={label} class={["notice", className]} style={style}>
      <p>
        <Slot>
          <em>Nothing to report.</em>
        </Slot>
      </p>
      {actionSlot$?.() ?? <span class="muted">No action</span>}
    </div>
  );
});
