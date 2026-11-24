import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface LayoutSlots {
  title$?: QRL<() => JSXOutput>;
}

export const Layout = component$<
  LayoutSlots &
    Omit<PropsOf<"main">, "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title$, class: className, style, ...attributes }) => {
  return (
    <main class={className} style={style} {...attributes}>
      <h1>{title$?.()}</h1>
      <Slot />
    </main>
  );
});
