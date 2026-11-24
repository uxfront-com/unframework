import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface BoxSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  BoxSlots &
    Omit<PropsOf<"div">, "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title$, class: className, style, ...attributes }) => {
  return (
    <div class={["box", className]} style={style} {...attributes}>
      <h3>{title$?.() ?? "Untitled"}</h3>
      <Slot>
        <p>No content</p>
      </Slot>
    </div>
  );
});
