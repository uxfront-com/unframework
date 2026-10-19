import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PanelSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<PanelSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style }) => {
    return (
      <div class={["panel", className]} style={style}>
        <h4>{title$?.() ?? "Untitled"}</h4>
      </div>
    );
  },
);
