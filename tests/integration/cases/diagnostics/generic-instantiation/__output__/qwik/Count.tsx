import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export const Count = component$<
  { items: Fruit[] } & Omit<PropsOf<"p">, "items" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ items, class: className, style, ...attributes }) => {
  return (
    <p class={className} style={style} {...attributes}>
      {items.length} fruits
    </p>
  );
});
