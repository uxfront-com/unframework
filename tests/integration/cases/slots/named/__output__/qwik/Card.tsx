import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  header$?: QRL<() => JSXOutput>;
  footer$?: QRL<() => JSXOutput>;
}

export default component$<CardSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ header$, footer$, class: className, style }) => {
    return (
      <article class={["card", className]} style={style}>
        <header>{header$?.()}</header>
        <div class="body">
          <Slot />
        </div>
        <footer>{footer$?.()}</footer>
      </article>
    );
  },
);
