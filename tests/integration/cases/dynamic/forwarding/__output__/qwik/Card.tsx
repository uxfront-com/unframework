import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  CardSlots &
    Omit<PropsOf<"div">, "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title$, class: className, style, ...attributes }) => {
  return (
    <div class={["card", className]} style={style} {...attributes}>
      <h3>{title$?.() ?? "Untitled"}</h3>
    </div>
  );
});
