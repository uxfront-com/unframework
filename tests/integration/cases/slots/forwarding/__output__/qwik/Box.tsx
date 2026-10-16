import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface BoxSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<BoxSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style }) => {
    return (
      <div class={["box", className]} style={style}>
        <h3>{title$?.() ?? "Untitled"}</h3>
        <Slot>
          <p>No content</p>
        </Slot>
      </div>
    );
  },
);
