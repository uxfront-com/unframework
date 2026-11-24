import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  header$?: QRL<() => JSXOutput>;
  footer$?: QRL<() => JSXOutput>;
}

export default component$<
  CardSlots &
    Omit<PropsOf<"article">, "header$" | "footer$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ header$, footer$, class: className, style, ...attributes }) => {
  return (
    <article class={["card", className]} style={style} {...attributes}>
      <header>{header$?.()}</header>
      <div class="body">
        <Slot />
      </div>
      <footer>{footer$?.()}</footer>
    </article>
  );
});
