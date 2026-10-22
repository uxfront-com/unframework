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
>(({ label, action$: actionSlot$, class: className, style, ...attributes }) => {
  return (
    <div
      role="note"
      aria-label={label}
      class={["notice", className]}
      {...scopeAttributes(attributes)}
      style={style}
    >
      <p>
        <Slot>
          <em>Nothing to report.</em>
        </Slot>
      </p>
      {actionSlot$?.() ?? <span class="muted">No action</span>}
    </div>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
